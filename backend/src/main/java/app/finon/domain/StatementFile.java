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

    @Column(nullable = false)
    private long sizeBytes;

    protected StatementFile() {}

    public StatementFile(Long accountId, String contentType, byte[] content) {
        this.accountId = accountId;
        this.contentType = contentType;
        this.content = content;
        this.sizeBytes = content.length;
    }

    public Long getAccountId() { return accountId; }
    public String getContentType() { return contentType; }
    public byte[] getContent() { return content; }
    public long getSizeBytes() { return sizeBytes; }
}
