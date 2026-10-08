package app.finon.service;

import app.finon.domain.*;
import app.finon.web.Dtos.*;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AccountService {

    static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "doc", "docx", "jpg", "jpeg", "png");

    private static final Pattern CUSTOM_NAME = Pattern.compile("^[\\p{L}\\p{N} &'’.,()/+-]{2,80}$");

    private final ProviderRepository providers;
    private final ClientAccountRepository accounts;
    private final StatementFileRepository files;
    private final Clock clock;

    public AccountService(ProviderRepository providers, ClientAccountRepository accounts,
                          StatementFileRepository files, Clock clock) {
        this.providers = providers;
        this.accounts = accounts;
        this.files = files;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ProviderDto> availableProviders() {
        Set<Long> taken = accounts.findAll().stream()
                .filter(a -> !a.isPersonal())
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
        List<AccountDto> rows = accounts.findAll().stream()
                .sorted(Comparator.<ClientAccount>comparingInt(a -> a.isPersonal() ? 1 : 0)
                        .thenComparingInt(a -> Categories.rank(a.getCategory()))
                        .thenComparing(a -> a.displayName().toLowerCase(Locale.ROOT)))
                .map(a -> toDto(a, today))
                .toList();
        return new AccountsResponse(rows, readiness(rows));
    }

    public AccountsResponse add(List<Long> providerIds, List<String> customNames, List<Choice> choices) {
        List<Long> ids = providerIds == null ? List.of() : providerIds;
        List<String> names = customNames == null ? List.of() : customNames;
        if (ids.isEmpty() && names.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "NOTHING_SELECTED",
                    "Choose at least one provider to add.");
        }

        Set<Long> requested = new LinkedHashSet<>(ids);
        List<Provider> found = providers.findAllById(requested);
        if (found.size() != requested.size()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "UNKNOWN_PROVIDER",
                    "One or more of those providers are not in our catalogue.");
        }

        Map<String, Provider> catalogueTargets = new LinkedHashMap<>();
        found.forEach(p -> catalogueTargets.put(key(p.getName()), p));
        Set<String> personalTargets = new LinkedHashSet<>();
        Map<String, String> personalLabels = new LinkedHashMap<>();

        Map<Long, String> categoryById = new java.util.HashMap<>();
        Map<String, String> categoryByName = new java.util.HashMap<>();
        for (Choice c : choices == null ? List.<Choice>of() : choices) {
            if (c.category() == null) continue;
            if (!Categories.isValid(c.category())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY",
                        "Please choose one of: " + String.join(", ", Categories.ALL) + ".");
            }
            if (c.providerId() != null) categoryById.put(c.providerId(), c.category());
            if (c.name() != null) categoryByName.put(key(c.name()), c.category());
        }

        Map<String, Provider> catalogueByKey = new java.util.HashMap<>();
        providers.findAll().forEach(p -> catalogueByKey.put(key(p.getName()), p));

        for (String raw : names) {
            String name = cleanName(raw);
            Provider match = catalogueByKey.get(key(name));
            if (match != null) {
                catalogueTargets.putIfAbsent(key(match.getName()), match);
            } else if (personalTargets.add(key(name))) {
                personalLabels.put(key(name), name);
            }
        }

        List<ClientAccount> current = accounts.findAll();
        Set<Long> existingIds = current.stream().filter(a -> !a.isPersonal())
                .map(a -> a.getProvider().getId()).collect(Collectors.toSet());
        Set<String> existingPersonal = current.stream().filter(ClientAccount::isPersonal)
                .map(a -> key(a.getCustomName())).collect(Collectors.toSet());

        List<String> duplicates = new ArrayList<>();
        catalogueTargets.values().stream().filter(p -> existingIds.contains(p.getId()))
                .forEach(p -> duplicates.add(p.getName()));
        personalTargets.stream().filter(existingPersonal::contains)
                .forEach(k -> duplicates.add(personalLabels.get(k)));
        if (!duplicates.isEmpty()) {
            duplicates.sort(String::compareToIgnoreCase);
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_PROVIDER",
                    "Already added: " + String.join(", ", duplicates) + ".");
        }

        Map<Long, String> nameChoiceForCatalogue = new java.util.HashMap<>();
        for (String raw : names) {
            Provider match = catalogueByKey.get(key(cleanName(raw)));
            if (match != null && categoryByName.containsKey(key(raw))) {
                nameChoiceForCatalogue.put(match.getId(), categoryByName.get(key(raw)));
            }
        }
        catalogueTargets.values().forEach(p -> {
            ClientAccount account = new ClientAccount(p);
            String chosen = categoryById.getOrDefault(p.getId(), nameChoiceForCatalogue.get(p.getId()));
            if (chosen != null) account.setCategory(chosen);
            accounts.save(account);
        });
        personalLabels.forEach((k, n) -> {
            ClientAccount account = ClientAccount.personal(n);
            String chosen = categoryByName.get(k);
            if (chosen != null) account.setCategory(chosen);
            accounts.save(account);
        });
        return overview();
    }

    public AccountDto setCategory(Long accountId, String category) {
        if (!Categories.isValid(category)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CATEGORY",
                    "Please choose one of: " + String.join(", ", Categories.ALL) + ".");
        }
        ClientAccount account = find(accountId);
        account.setCategory(category);
        return toDto(accounts.save(account), today());
    }

    public void remove(Long accountId) {
        accounts.delete(find(accountId));
        files.deleteById(accountId);
    }

    public AccountDto setStatement(Long accountId, String filename, LocalDate date) {
        return setStatement(accountId, filename, date, null);
    }

    public AccountDto setStatement(Long accountId, String filename, LocalDate date, byte[] content) {
        LocalDate today = today();
        if (date.isAfter(today)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "STATEMENT_IN_FUTURE",
                    "The statement date can't be in the future.");
        }
        String name = filename.trim();
        if (!FileRules.isAllowedName(name)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_FILE_TYPE",
                    "Please upload a PDF, Word document (.doc or .docx), JPG or PNG file.");
        }
        if (content != null) {
            if (content.length == 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "That file is empty.");
            }
            if (content.length > FileRules.MAX_BYTES) {
                throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE",
                        "Please choose a file under 5 MB.");
            }
        }
        FileRules.Kind kind = content == null ? null : requireReadable(content);
        ClientAccount account = find(accountId);
        account.attach(name, date);
        if (kind != null) {
            files.save(new StatementFile(accountId, kind.mime, content));
            account.getStatement().markFileStored(Instant.now(clock), kind.mime);
        } else {
            files.deleteById(accountId);
        }
        return toDto(accounts.save(account), today);
    }

    @Transactional(readOnly = true)
    public StoredFile fileFor(Long accountId) {
        ClientAccount account = find(accountId);
        StatementFile file = account.getStatement() == null || !account.getStatement().isFileStored()
                ? null : files.findById(accountId).orElse(null);
        if (file == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NO_FILE", "There is no file stored for this statement.");
        }
        return new StoredFile(account.getStatement().getFilename(), file.getContentType(), file.getContent());
    }

    public record StoredFile(String filename, String contentType, byte[] content) {}

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

    private static FileRules.Kind requireReadable(byte[] content) {
        FileRules.Kind kind = FileRules.detect(content);
        if (kind == null || !FileRules.isReadable(kind, content)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "FILE_UNREADABLE",
                    "We couldn't open that file. It looks damaged or incomplete, so we haven't saved it. "
                            + "Please check it opens on your device, or choose another copy of the statement.");
        }
        return kind;
    }

    private static String key(String name) {
        return NameKey.of(name);
    }

    private static String cleanName(String raw) {
        String name = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (!CUSTOM_NAME.matcher(name).matches() || key(name).isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_PROVIDER_NAME",
                    "Provider names must be 2 to 80 characters, using letters, numbers and basic punctuation.");
        }
        return name;
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
        return new ProviderDto(p.getId(), p.getName(), p.getCategory(), p.getStatementHelpUrl(), p.getSupportPhone(), p.getWebsiteUrl());
    }

    private static AccountDto toDto(ClientAccount a, LocalDate today) {
        Statement s = a.getStatement();
        return new AccountDto(
                a.getId(),
                a.isPersonal() ? new ProviderDto(null, a.getCustomName(), Provider.OTHER, null, null, null) : toDto(a.getProvider()),
                a.getCategory(),
                a.isPersonal(),
                StatementStatus.of(s, today),
                s == null ? null : new StatementDto(s.getFilename(), s.getStatementDate(), s.isFileStored(),
                        s.getStoredAt() == null ? null : s.getStoredAt().toEpochMilli(), s.getFileContentType()));
    }
}
