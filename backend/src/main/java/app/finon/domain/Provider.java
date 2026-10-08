package app.finon.domain;

import jakarta.persistence.*;

@Entity
public class Provider {

    public static final String OTHER = "Other";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String name;

    @Column(nullable = false)
    private String category;

    private String statementHelpUrl;

    private String supportPhone;

    private String websiteUrl;

    protected Provider() {}

    public Provider(String name, String category) {
        this.name = name;
        this.category = category;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public String getStatementHelpUrl() { return statementHelpUrl; }
    public String getSupportPhone() { return supportPhone; }
    public String getWebsiteUrl() { return websiteUrl; }

    public void setWebsiteUrl(String websiteUrl) {
        this.websiteUrl = websiteUrl;
    }

    public void setHelp(String statementHelpUrl, String supportPhone) {
        this.statementHelpUrl = statementHelpUrl;
        this.supportPhone = supportPhone;
    }
}
