package app.finon.domain;

import java.time.LocalDate;

public enum StatementStatus {
    MISSING, UPLOADED, OUTDATED;

    public static final int MAX_AGE_MONTHS = 3;

    /** A statement dated exactly three calendar months ago still counts. */
    public static StatementStatus of(Statement statement, LocalDate today) {
        if (statement == null) return MISSING;
        LocalDate cutoff = today.minusMonths(MAX_AGE_MONTHS);
        return statement.getStatementDate().isBefore(cutoff) ? OUTDATED : UPLOADED;
    }
}
