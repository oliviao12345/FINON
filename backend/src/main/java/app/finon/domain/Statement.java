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

    protected Statement() {}

    public Statement(String filename, LocalDate statementDate) {
        this.filename = filename;
        this.statementDate = statementDate;
    }

    public Long getId() { return id; }
    public String getFilename() { return filename; }
    public LocalDate getStatementDate() { return statementDate; }

    public void replaceWith(String filename, LocalDate statementDate) {
        this.filename = filename;
        this.statementDate = statementDate;
    }
}
