package app.finon;

import app.finon.domain.*;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class Seed implements CommandLineRunner {

    private final ProviderRepository providers;
    private final ClientAccountRepository accounts;
    private final Clock clock;
    private final boolean demoAccounts;

    Seed(ProviderRepository providers, ClientAccountRepository accounts, Clock clock,
         @Value("${finon.seed.demo-accounts:true}") boolean demoAccounts) {
        this.providers = providers;
        this.accounts = accounts;
        this.clock = clock;
        this.demoAccounts = demoAccounts;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (providers.count() > 0) return;

        List<Provider> catalogue = providers.saveAll(List.of(
                new Provider("Barclays", "Bank"),
                new Provider("HSBC", "Bank"),
                new Provider("Lloyds Bank", "Bank"),
                new Provider("NatWest", "Bank"),
                new Provider("Santander", "Bank"),
                new Provider("Monzo", "Bank"),
                new Provider("Starling Bank", "Bank"),
                new Provider("Vanguard", "Investments"),
                new Provider("Fidelity", "Investments"),
                new Provider("Hargreaves Lansdown", "Investments"),
                new Provider("AJ Bell", "Investments"),
                new Provider("Interactive Investor", "Investments"),
                new Provider("Nutmeg", "Investments"),
                new Provider("Aviva", "Pension"),
                new Provider("Legal & General", "Pension"),
                new Provider("Scottish Widows", "Pension"),
                new Provider("Standard Life", "Pension"),
                new Provider("NEST", "Pension")));

        if (!demoAccounts) return;

        LocalDate today = LocalDate.now(clock);
        seed(catalogue, "Barclays", "statement_jan.pdf", today.minusWeeks(3));
        seed(catalogue, "HSBC", null, null);
        seed(catalogue, "Vanguard", "old_statement.pdf", today.minusMonths(5));
        seed(catalogue, "Fidelity", "q4_2025.pdf", today.minusDays(40));
    }

    private void seed(List<Provider> catalogue, String name, String file, LocalDate date) {
        Provider p = catalogue.stream().filter(c -> c.getName().equals(name)).findFirst().orElseThrow();
        ClientAccount account = new ClientAccount(p);
        if (file != null) account.attach(file, date);
        accounts.save(account);
    }
}
