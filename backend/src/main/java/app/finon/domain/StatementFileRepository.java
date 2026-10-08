package app.finon.domain;

import java.util.Collection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface StatementFileRepository extends JpaRepository<StatementFile, Long> {

    @Query("select coalesce(sum(f.sizeBytes), 0) from StatementFile f where f.accountId in :accountIds")
    long totalBytesFor(Collection<Long> accountIds);
}
