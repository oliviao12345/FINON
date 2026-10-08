package app.finon.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientAccountRepository extends JpaRepository<ClientAccount, Long> {
    List<ClientAccount> findAllBySessionId(String sessionId);
    Optional<ClientAccount> findByIdAndSessionId(Long id, String sessionId);
    long countBySessionId(String sessionId);
}
