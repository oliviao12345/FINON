package app.finon.web;

import app.finon.service.AccountService;
import app.finon.web.Dtos.*;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
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
        return ResponseEntity.status(HttpStatus.CREATED).body(service.add(body.providerIds()));
    }

    @DeleteMapping("/accounts/{id}")
    public ResponseEntity<Void> remove(@PathVariable Long id) {
        service.remove(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/accounts/{id}/statement")
    public AccountDto statement(@PathVariable Long id, @Valid @RequestBody StatementRequest body) {
        return service.setStatement(id, body.filename(), body.statementDate());
    }

    @PostMapping("/submit")
    public SubmitResponse submit() {
        return service.submit();
    }
}
