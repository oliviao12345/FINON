package app.finon.domain;

import jakarta.persistence.*;

@Entity
public class ClientAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "provider_id", unique = true)
    private Provider provider;

    @Column(unique = true)
    private String customName;

    @Column(nullable = false)
    private String category = Categories.ALL.get(Categories.ALL.size() - 1);

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JoinColumn(name = "statement_id")
    private Statement statement;

    protected ClientAccount() {}

    public ClientAccount(Provider provider) {
        this.provider = provider;
        this.category = Categories.isValid(provider.getCategory()) ? provider.getCategory() : "Other";
    }

    public static ClientAccount personal(String customName) {
        ClientAccount account = new ClientAccount();
        account.customName = customName;
        return account;
    }

    public Long getId() { return id; }
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
