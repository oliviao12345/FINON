package app.finon.web;

import app.finon.domain.StatementStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class Dtos {

    private Dtos() {}

    public record ProviderDto(Long id, String name, String category, String statementHelpUrl, String supportPhone,
                         String websiteUrl) {}

    public record StatementDto(String filename, LocalDate statementDate, boolean hasFile, Long storedAt,
                               String contentType) {}

    public record AccountDto(Long id, ProviderDto provider, String category, boolean manual, StatementStatus status,
                             StatementDto statement) {}

    public record Issue(Long accountId, String provider, StatementStatus status) {}

    public record Readiness(int ready, int total, boolean canSubmit, List<Issue> issues) {}

    public record AccountsResponse(List<AccountDto> accounts, Readiness readiness) {}

    /** Optional category for one selection: identify it by providerId or by the typed name. */
    public record Choice(Long providerId, String name, String category) {}

    public record AddAccountsRequest(
            @Size(max = 50) List<@NotNull Long> providerIds,
            @Size(max = 20) List<@NotNull String> customNames,
            @Size(max = 70) List<@NotNull Choice> choices) {}

    public record CategoryRequest(@NotBlank String category) {}

    public record StatementRequest(
            @NotBlank @Size(max = 200) String filename,
            @NotNull LocalDate statementDate) {}

    public record SubmitResponse(boolean submitted, Instant submittedAt, int accounts) {}

    public record ApiError(String code, String message, List<Issue> issues) {}
}
