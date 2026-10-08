package app.finon.domain;

import jakarta.persistence.*;

@Entity
@Table(uniqueConstraints = {
        @UniqueConstraint(columnNames = {"session_id", "provider_id"}),
        @UniqueConstraint(columnNames = {"session_id", "custom_name"})
})
public class ClientAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 36)
    private String sessionId;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "provider_id")
    private Provider provider;

    private String customName;

    @Column(nullable = false)
    private String category = Categories.ALL.get(Categories.ALL.size() - 1);

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "statement_id")
    private Statement statement;

    protected ClientAccount() {}

    public ClientAccount(String sessionId, Provider provider) {
        this.sessionId = sessionId;
        this.provider = provider;
        this.category = Categories.isValid(provider.getCategory()) ? provider.getCategory() : "Other";
    }

    public static ClientAccount personal(String sessionId, String customName) {
        ClientAccount account = new ClientAccount();
        account.sessionId = sessionId;
        account.customName = customName;
        return account;
    }

    public Long getId() { return id; }
    public String getSessionId() { return sessionId; }
    public Provider getProvider() { return provider; }
    public String getCustomName() { return customName; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public boolean isPersonal() { return provider == null; }
    public String displayName() { return provider != null ? provider.getName() : customName; }
    public Statement getStatement() { return statement; }

    public void attach(String filename, java.time.LocalDate date) {
        if (statement == null) {
            statement = new Statement(filename, date);
        } else {
            statement.replaceWith(filename, date);
        }
    }
}
