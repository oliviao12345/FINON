package app.finon.domain;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientSessionRepository extends JpaRepository<ClientSession, String> {
    List<ClientSession> findByLastSeenBefore(Instant cutoff);
    List<ClientSession> findAllByOrderByLastSeenAsc();
}
