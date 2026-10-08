package app.finon.web;

import app.finon.domain.StatementStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class Dtos {

    private Dtos() {}

    public record ProviderDto(Long id, String name, String category) {}

    public record StatementDto(String filename, LocalDate statementDate) {}

    public record AccountDto(Long id, ProviderDto provider, StatementStatus status, StatementDto statement) {}

    public record Issue(Long accountId, String provider, StatementStatus status) {}

    public record Readiness(int ready, int total, boolean canSubmit, List<Issue> issues) {}

    public record AccountsResponse(List<AccountDto> accounts, Readiness readiness) {}

    public record AddAccountsRequest(@NotEmpty @Size(max = 50) List<@NotNull Long> providerIds) {}

    public record StatementRequest(
            @NotBlank @Size(max = 200) String filename,
            @NotNull LocalDate statementDate) {}

    public record SubmitResponse(boolean submitted, Instant submittedAt, int accounts) {}

    public record ApiError(String code, String message, List<Issue> issues) {}
}
