package app.finon.web;

import app.finon.service.AccountService;
import app.finon.service.SessionService;
import app.finon.web.Dtos.*;
import jakarta.validation.Valid;
import java.util.List;
import app.finon.service.AccountService.StoredFile;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AccountController {

    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping("/providers")
    public List<ProviderDto> providers(@RequestHeader(SessionService.HEADER) String session) {
        return service.availableProviders(session);
    }

    @GetMapping("/accounts")
    public AccountsResponse accounts(@RequestHeader(SessionService.HEADER) String session) {
        return service.overview(session);
    }

    @PostMapping("/accounts")
    public ResponseEntity<AccountsResponse> add(@RequestHeader(SessionService.HEADER) String session,
                                                @Valid @RequestBody AddAccountsRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.add(session, body.providerIds(), body.customNames(), body.choices()));
    }

    @PutMapping(path = "/accounts/{id}/category", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AccountDto category(@RequestHeader(SessionService.HEADER) String session, @PathVariable Long id,
                               @Valid @RequestBody CategoryRequest body) {
        return service.setCategory(session, id, body.category());
    }

    @DeleteMapping("/accounts/{id}")
    public ResponseEntity<Void> remove(@RequestHeader(SessionService.HEADER) String session, @PathVariable Long id) {
        service.remove(session, id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping(path = "/accounts/{id}/statement", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AccountDto statement(@RequestHeader(SessionService.HEADER) String session, @PathVariable Long id,
                                @Valid @RequestBody StatementRequest body) {
        return service.setStatement(session, id, body.filename(), body.statementDate());
    }

    @PutMapping(path = "/accounts/{id}/statement", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AccountDto statementFile(
            @RequestHeader(SessionService.HEADER) String session,
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam("statementDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate statementDate)
            throws IOException {
        String original = file.getOriginalFilename();
        String name = original == null ? "" : original.replaceAll(".*[\\\\/]", "");
        return service.setStatement(session, id, name, statementDate, file.getBytes());
    }

    @GetMapping("/accounts/{id}/statement/file")
    public ResponseEntity<byte[]> file(@RequestHeader(SessionService.HEADER) String session, @PathVariable Long id) {
        StoredFile stored = service.fileFor(session, id);
        boolean inline = stored.contentType().equals("application/pdf") || stored.contentType().startsWith("image/");
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(stored.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(stored.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noStore())
                .body(stored.content());
    }

    @PostMapping("/submit")
    public SubmitResponse submit(@RequestHeader(SessionService.HEADER) String session) {
        return service.submit(session);
    }
}
