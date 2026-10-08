package app.finon.domain;

import jakarta.persistence.*;

@Entity
public class StatementFile {

    @Id
    private Long accountId;

    @Column(nullable = false)
    private String contentType;

    @Column(nullable = false, length = 5_242_880)
    private byte[] content;

    protected StatementFile() {}

    public StatementFile(Long accountId, String contentType, byte[] content) {
        this.accountId = accountId;
        this.contentType = contentType;
        this.content = content;
    }

    public Long getAccountId() { return accountId; }
    public String getContentType() { return contentType; }
    public byte[] getContent() { return content; }
}
