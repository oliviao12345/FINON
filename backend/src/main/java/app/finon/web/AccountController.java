package app.finon.web;

import app.finon.service.AccountService;
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
    public List<ProviderDto> providers() {
        return service.availableProviders();
    }

    @GetMapping("/accounts")
    public AccountsResponse accounts() {
        return service.overview();
    }

    @PostMapping("/accounts")
    public ResponseEntity<AccountsResponse> add(@Valid @RequestBody AddAccountsRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.add(body.providerIds(), body.customNames(), body.choices()));
    }

    @PutMapping(path = "/accounts/{id}/category", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AccountDto category(@PathVariable Long id, @Valid @RequestBody CategoryRequest body) {
        return service.setCategory(id, body.category());
    }

    @DeleteMapping("/accounts/{id}")
    public ResponseEntity<Void> remove(@PathVariable Long id) {
        service.remove(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping(path = "/accounts/{id}/statement", consumes = MediaType.APPLICATION_JSON_VALUE)
    public AccountDto statement(@PathVariable Long id, @Valid @RequestBody StatementRequest body) {
        return service.setStatement(id, body.filename(), body.statementDate());
    }

    @PutMapping(path = "/accounts/{id}/statement", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AccountDto statementFile(
            @PathVariable Long id,
            @RequestPart("file") MultipartFile file,
            @RequestParam("statementDate") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate statementDate)
            throws IOException {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().replaceAll(".*[\\\\/]", "");
        return service.setStatement(id, name, statementDate, file.getBytes());
    }

    @GetMapping("/accounts/{id}/statement/file")
    public ResponseEntity<byte[]> file(@PathVariable Long id) {
        StoredFile stored = service.fileFor(id);
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
    public SubmitResponse submit() {
        return service.submit();
    }
}
