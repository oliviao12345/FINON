package app.finon.service;

import app.finon.web.Dtos.Issue;
import java.util.List;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<Issue> issues;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public ApiException(HttpStatus status, String code, String message, List<Issue> issues) {
        super(message);
        this.status = status;
        this.code = code;
        this.issues = issues;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public List<Issue> issues() { return issues; }
}
