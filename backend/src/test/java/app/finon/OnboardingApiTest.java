package app.finon;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import app.finon.domain.*;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "finon.seed.demo-accounts=false")
@AutoConfigureMockMvc
class OnboardingApiTest {

    @TestConfiguration
    static class FixedClock {
        @Bean
        @Primary
        Clock fixed() {
            return Clock.fixed(Instant.parse("2026-10-08T09:00:00Z"), ZoneOffset.UTC);
        }
    }

    @Autowired MockMvc mvc;
    @Autowired ProviderRepository providers;
    @Autowired ClientAccountRepository accounts;

    Long barclays;
    Long hsbc;

    @BeforeEach
    void reset() {
        accounts.deleteAll();
        barclays = providers.findAllByOrderByNameAsc().stream()
                .filter(p -> p.getName().equals("Barclays")).findFirst().orElseThrow().getId();
        hsbc = providers.findAllByOrderByNameAsc().stream()
                .filter(p -> p.getName().equals("HSBC")).findFirst().orElseThrow().getId();
    }

    private Long addAccount(Long providerId) throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"providerIds\":[" + providerId + "]}")).andExpect(status().isCreated());
        return accounts.findAll().stream()
                .filter(a -> a.getProvider().getId().equals(providerId)).findFirst().orElseThrow().getId();
    }

    private void upload(Long accountId, String date) throws Exception {
        mvc.perform(put("/api/accounts/" + accountId + "/statement").contentType(MediaType.APPLICATION_JSON)
                .content("{\"filename\":\"jan.pdf\",\"statementDate\":\"" + date + "\"}")).andExpect(status().isOk());
    }

    @Test
    void rejectsAddingAProviderTwice() throws Exception {
        addAccount(barclays);
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + barclays + "]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_PROVIDER"));
    }

    @Test
    void addedProvidersAreExcludedFromTheCatalogue() throws Exception {
        addAccount(barclays);
        mvc.perform(get("/api/providers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name=='Barclays')]").isEmpty())
                .andExpect(jsonPath("$[?(@.name=='HSBC')]").isNotEmpty());
    }

    @Test
    void emptySelectionCannotBeSubmitted() throws Exception {
        mvc.perform(post("/api/submit"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("NO_ACCOUNTS"));
    }

    @Test
    void incompleteSubmissionIsRejectedWithTheOffendingProviders() throws Exception {
        Long a = addAccount(barclays);
        addAccount(hsbc);
        upload(a, "2026-09-20");

        mvc.perform(post("/api/submit"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INCOMPLETE_SUBMISSION"))
                .andExpect(jsonPath("$.issues.length()").value(1))
                .andExpect(jsonPath("$.issues[0].provider").value("HSBC"))
                .andExpect(jsonPath("$.issues[0].status").value("MISSING"));
    }

    @Test
    void outdatedStatementBlocksSubmission() throws Exception {
        Long a = addAccount(barclays);
        upload(a, "2026-07-07");

        mvc.perform(post("/api/submit"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.issues[0].status").value("OUTDATED"));
    }

    @Test
    void completeSetIsAccepted() throws Exception {
        upload(addAccount(barclays), "2026-07-08");
        upload(addAccount(hsbc), "2026-10-01");

        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.readiness.ready").value(2))
                .andExpect(jsonPath("$.readiness.canSubmit").value(true));
        mvc.perform(post("/api/submit"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.submitted").value(true))
                .andExpect(jsonPath("$.accounts").value(2));
    }

    @Test
    void futureDatedStatementIsRejected() throws Exception {
        Long a = addAccount(barclays);
        mvc.perform(put("/api/accounts/" + a + "/statement").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"filename\":\"x.pdf\",\"statementDate\":\"2026-10-09\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("STATEMENT_IN_FUTURE"));
    }

    @Test
    void removingAnAccountDropsItFromReadiness() throws Exception {
        upload(addAccount(barclays), "2026-10-01");
        Long b = addAccount(hsbc);
        mvc.perform(delete("/api/accounts/" + b)).andExpect(status().isNoContent());
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.readiness.total").value(1))
                .andExpect(jsonPath("$.readiness.canSubmit").value(true));
    }
}
