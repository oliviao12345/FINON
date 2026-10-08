package app.finon.service;

import app.finon.domain.*;
import app.finon.web.Dtos.*;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AccountService {

    private final ProviderRepository providers;
    private final ClientAccountRepository accounts;
    private final Clock clock;

    public AccountService(ProviderRepository providers, ClientAccountRepository accounts, Clock clock) {
        this.providers = providers;
        this.accounts = accounts;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ProviderDto> availableProviders() {
        Set<Long> taken = accounts.findAll().stream()
                .map(a -> a.getProvider().getId())
                .collect(Collectors.toSet());
        return providers.findAllByOrderByNameAsc().stream()
                .filter(p -> !taken.contains(p.getId()))
                .map(AccountService::toDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public AccountsResponse overview() {
        LocalDate today = today();
        List<AccountDto> rows = accounts.findAllByOrderByProviderNameAsc().stream()
                .map(a -> toDto(a, today))
                .toList();
        return new AccountsResponse(rows, readiness(rows));
    }

    public AccountsResponse add(List<Long> providerIds) {
        Set<Long> requested = new LinkedHashSet<>(providerIds);
        Set<Long> existing = accounts.findAll().stream()
                .map(a -> a.getProvider().getId())
                .collect(Collectors.toSet());

        List<Provider> found = providers.findAllById(requested);
        if (found.size() != requested.size()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "UNKNOWN_PROVIDER",
                    "One or more of those providers are not in our catalogue.");
        }

        List<String> duplicates = found.stream()
                .filter(p -> existing.contains(p.getId()))
                .map(Provider::getName)
                .sorted()
                .toList();
        if (!duplicates.isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_PROVIDER",
                    "Already added: " + String.join(", ", duplicates) + ".");
        }

        found.forEach(p -> accounts.save(new ClientAccount(p)));
        return overview();
    }

    public void remove(Long accountId) {
        accounts.delete(find(accountId));
    }

    public AccountDto setStatement(Long accountId, String filename, LocalDate date) {
        LocalDate today = today();
        if (date.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "STATEMENT_IN_FUTURE",
                    "The statement date can't be in the future.");
        }
        ClientAccount account = find(accountId);
        account.attach(filename.trim(), date);
        return toDto(accounts.save(account), today);
    }

    public SubmitResponse submit() {
        AccountsResponse current = overview();
        Readiness r = current.readiness();
        if (r.total() == 0) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "NO_ACCOUNTS",
                    "Add at least one provider before submitting.");
        }
        if (!r.canSubmit()) {
            int n = r.issues().size();
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INCOMPLETE_SUBMISSION",
                    n == 1 ? "1 provider still needs a current statement."
                           : n + " providers still need a current statement.",
                    r.issues());
        }
        return new SubmitResponse(true, Instant.now(clock), r.total());
    }

    private ClientAccount find(Long id) {
        return accounts.findById(id).orElseThrow(() ->
                new ApiException(HttpStatus.NOT_FOUND, "ACCOUNT_NOT_FOUND", "That provider isn't on your list."));
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private static Readiness readiness(List<AccountDto> rows) {
        List<Issue> issues = rows.stream()
                .filter(r -> r.status() != StatementStatus.UPLOADED)
                .map(r -> new Issue(r.id(), r.provider().name(), r.status()))
                .toList();
        int total = rows.size();
        int ready = total - issues.size();
        return new Readiness(ready, total, total > 0 && issues.isEmpty(), issues);
    }

    private static ProviderDto toDto(Provider p) {
        return new ProviderDto(p.getId(), p.getName(), p.getCategory());
    }

    private static AccountDto toDto(ClientAccount a, LocalDate today) {
        Statement s = a.getStatement();
        return new AccountDto(
                a.getId(),
                toDto(a.getProvider()),
                StatementStatus.of(s, today),
                s == null ? null : new StatementDto(s.getFilename(), s.getStatementDate()));
    }
}
