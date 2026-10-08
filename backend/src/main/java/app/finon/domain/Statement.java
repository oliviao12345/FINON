package app.finon.domain;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
public class Statement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String filename;

    @Column(nullable = false)
    private LocalDate statementDate;

    private boolean fileStored;

    private java.time.Instant storedAt;

    private String fileContentType;

    protected Statement() {}

    public Statement(String filename, LocalDate statementDate) {
        this.filename = filename;
        this.statementDate = statementDate;
    }

    public Long getId() { return id; }
    public String getFilename() { return filename; }
    public LocalDate getStatementDate() { return statementDate; }

    public boolean isFileStored() { return fileStored; }
    public java.time.Instant getStoredAt() { return storedAt; }
    public String getFileContentType() { return fileContentType; }

    public void replaceWith(String filename, LocalDate statementDate) {
        this.filename = filename;
        this.statementDate = statementDate;
        this.fileStored = false;
        this.storedAt = null;
        this.fileContentType = null;
    }

    public void markFileStored(java.time.Instant at, String contentType) {
        this.fileStored = true;
        this.storedAt = at;
        this.fileContentType = contentType;
    }
}
