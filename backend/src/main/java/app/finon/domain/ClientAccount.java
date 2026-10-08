package app.finon.domain;

import jakarta.persistence.*;

@Entity
public class ClientAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(optional = false, fetch = FetchType.EAGER)
    @JoinColumn(name = "provider_id", unique = true, nullable = false)
    private Provider provider;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "statement_id")
    private Statement statement;

    protected ClientAccount() {}

    public ClientAccount(Provider provider) {
        this.provider = provider;
    }

    public Long getId() { return id; }
    public Provider getProvider() { return provider; }
    public Statement getStatement() { return statement; }

    public void attach(String filename, java.time.LocalDate date) {
        if (statement == null) {
            statement = new Statement(filename, date);
        } else {
            statement.replaceWith(filename, date);
        }
    }
}
