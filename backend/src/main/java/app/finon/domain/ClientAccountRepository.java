package app.finon.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientAccountRepository extends JpaRepository<ClientAccount, Long> {
    List<ClientAccount> findAllByOrderByProviderNameAsc();
}
