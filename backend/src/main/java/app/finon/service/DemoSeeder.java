package app.finon.service;

import app.finon.domain.*;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Gives every new session the same four starting providers (two ready, one missing, one outdated).
 * It always builds them fresh from this fixed template, never by copying anyone's data.
 */
@Component
public class DemoSeeder {

    private final ProviderRepository providers;
    private final ClientAccountRepository accounts;
    private final StatementFileRepository files;
    private final Clock clock;
    private final boolean enabled;

    public DemoSeeder(ProviderRepository providers, ClientAccountRepository accounts, StatementFileRepository files,
                      Clock clock, @Value("${finon.seed.demo-accounts:true}") boolean enabled) {
        this.providers = providers;
        this.accounts = accounts;
        this.files = files;
        this.clock = clock;
        this.enabled = enabled;
    }

    public void seed(String sessionId) {
        if (!enabled) return;
        LocalDate today = LocalDate.now(clock);
        add(sessionId, "Barclays", "statement_jan.pdf", today.minusWeeks(3));
        add(sessionId, "HSBC", null, null);
        add(sessionId, "Vanguard", "old_statement.pdf", today.minusMonths(5));
        add(sessionId, "Fidelity", "q4_2025.pdf", today.minusDays(40));
    }

    private void add(String sessionId, String name, String file, LocalDate date) {
        Provider provider = providers.findByNameIgnoreCase(name).orElseThrow();
        ClientAccount account = new ClientAccount(sessionId, provider);
        if (file != null) account.attach(file, date);
        ClientAccount saved = accounts.save(account);
        if (file != null) {
            files.save(new StatementFile(saved.getId(), "application/pdf", SamplePdf.of(name, date.toString())));
            saved.getStatement().markFileStored(Instant.now(clock), "application/pdf");
            accounts.save(saved);
        }
    }
}
