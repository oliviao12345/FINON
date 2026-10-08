package app.finon;

import static org.assertj.core.api.Assertions.assertThat;

import app.finon.domain.Statement;
import app.finon.domain.StatementStatus;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class StatementStatusTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 8);

    private static StatementStatus at(LocalDate date) {
        return StatementStatus.of(new Statement("s.pdf", date), TODAY);
    }

    @Test
    void noStatementIsMissing() {
        assertThat(StatementStatus.of(null, TODAY)).isEqualTo(StatementStatus.MISSING);
    }

    @Test
    void exactlyThreeMonthsOldIsStillCurrent() {
        assertThat(at(LocalDate.of(2026, 7, 8))).isEqualTo(StatementStatus.UPLOADED);
    }

    @Test
    void oneDayPastThreeMonthsIsOutdated() {
        assertThat(at(LocalDate.of(2026, 7, 7))).isEqualTo(StatementStatus.OUTDATED);
    }

    @Test
    void recentStatementIsUploaded() {
        assertThat(at(TODAY)).isEqualTo(StatementStatus.UPLOADED);
    }

    @Test
    void monthEndClampsToShorterMonth() {
        LocalDate endOfMonth = LocalDate.of(2026, 5, 31);
        assertThat(StatementStatus.of(new Statement("s.pdf", LocalDate.of(2026, 2, 28)), endOfMonth))
                .isEqualTo(StatementStatus.UPLOADED);
        assertThat(StatementStatus.of(new Statement("s.pdf", LocalDate.of(2026, 2, 27)), endOfMonth))
                .isEqualTo(StatementStatus.OUTDATED);
    }
}
