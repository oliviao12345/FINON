package app.finon.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProviderRepository extends JpaRepository<Provider, Long> {
    List<Provider> findAllByOrderByNameAsc();
}
