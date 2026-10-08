package app.finon;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.assertj.core.api.Assertions.assertThat;

import app.finon.domain.*;
import app.finon.service.SessionService;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Visitors must never see, change or open each other's data, and every new visitor starts from the same four samples. */
@SpringBootTest(properties = {"finon.seed.demo-accounts=true", "finon.sessions.max-stored-kb=1024", "finon.sessions.max=4"})
@AutoConfigureMockMvc
class SessionIsolationTest {

    static final String ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    static final String BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    static final String CARA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    @TestConfiguration
    static class Clocks {
        @Bean
        @Primary
        MutableClock movableClock() {
            return new MutableClock(Instant.parse("2026-10-08T09:00:00Z"));
        }
    }

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired SessionService sessionService;
    @Autowired ProviderRepository providers;
    @Autowired ClientAccountRepository accounts;
    @Autowired StatementFileRepository files;
    @Autowired ClientSessionRepository sessions;

    @BeforeEach
    void reset() {
        accounts.deleteAll();
        files.deleteAll();
        sessions.deleteAll();
    }

    private ResultActions get(String session, String path) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get(path).header("X-Session-Id", session));
    }

    private ResultActions post(String session, String path, String json) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(path)
                .header("X-Session-Id", session).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    private long providerId(String name) {
        return providers.findAll().stream().filter(p -> p.getName().equals(name)).findFirst().orElseThrow().getId();
    }

    private long accountId(String session, String name) throws Exception {
        String body = get(session, "/api/accounts").andReturn().getResponse().getContentAsString();
        Matcher m = Pattern.compile("\\{\"id\":(\\d+),\"provider\":\\{[^}]*\"name\":\"" + Pattern.quote(name) + "\"").matcher(body);
        if (!m.find()) throw new AssertionError(name + " not found in " + body);
        return Long.parseLong(m.group(1));
    }

    private ResultActions upload(String session, long accountId, byte[] content, String name) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .multipart(org.springframework.http.HttpMethod.PUT, "/api/accounts/" + accountId + "/statement")
                .file(new MockMultipartFile("file", name, "application/pdf", content))
                .param("statementDate", "2026-10-01").header("X-Session-Id", session));
    }

    private byte[] pdf(int paddingBytes) {
        byte[] base = app.finon.service.SamplePdf.of("Test", "2026-10-01");
        String tail = "%" + "x".repeat(paddingBytes) + "\n%%EOF\n";
        byte[] extra = tail.getBytes(StandardCharsets.ISO_8859_1);
        byte[] out = java.util.Arrays.copyOf(base, base.length + extra.length);
        System.arraycopy(extra, 0, out, base.length, extra.length);
        return out;
    }

    @Test
    void everyNewVisitorStartsWithExactlyTheFourSampleProvidersAndTwoReady() throws Exception {
        get(ALICE, "/api/accounts")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readiness.total").value(4))
                .andExpect(jsonPath("$.readiness.ready").value(2))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Barclays')].status").value("UPLOADED"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Fidelity')].status").value("UPLOADED"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='HSBC')].status").value("MISSING"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Vanguard')].status").value("OUTDATED"));
    }

    @Test
    void whatOneVisitorDoesIsInvisibleToEveryoneElse() throws Exception {
        long monzo = providerId("Monzo");
        post(ALICE, "/api/accounts", "{\"providerIds\":[" + monzo + "],\"customNames\":[\"Alice Family Trust\"]}").andExpect(status().isCreated());
        upload(ALICE, accountId(ALICE, "HSBC"), pdf(0), "alice_hsbc.pdf").andExpect(status().isOk());

        get(BOB, "/api/accounts")
                .andExpect(jsonPath("$.readiness.total").value(4))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Monzo')]").isEmpty())
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Alice Family Trust')]").isEmpty())
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='HSBC')].status").value("MISSING"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='HSBC')].statement").value(org.hamcrest.Matchers.contains((Object) null)));

        get(ALICE, "/api/providers").andExpect(jsonPath("$[?(@.name=='Monzo')]").isEmpty());
        get(BOB, "/api/providers").andExpect(jsonPath("$[?(@.name=='Monzo')]").isNotEmpty());
    }

    @Test
    void someoneElsesAccountAndFileCannotBeReadChangedOrDeletedEvenWithItsId() throws Exception {
        long aliceBarclays = accountId(ALICE, "Barclays");
        get(BOB, "/api/accounts");

        get(ALICE, "/api/accounts/" + aliceBarclays + "/statement/file").andExpect(status().isOk());
        get(BOB, "/api/accounts/" + aliceBarclays + "/statement/file").andExpect(status().isNotFound());
        mvc.perform(delete("/api/accounts/" + aliceBarclays).header("X-Session-Id", BOB)).andExpect(status().isNotFound());
        mvc.perform(put("/api/accounts/" + aliceBarclays + "/category").header("X-Session-Id", BOB)
                .contentType(MediaType.APPLICATION_JSON).content("{\"category\":\"Savings\"}")).andExpect(status().isNotFound());
        upload(BOB, aliceBarclays, pdf(0), "intruder.pdf").andExpect(status().isNotFound());

        get(ALICE, "/api/accounts")
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Barclays')].statement.filename").value("statement_jan.pdf"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Barclays')].category").value("Bank"));
    }

    @Test
    void requestsWithoutAValidSessionAreRefused() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/accounts"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_SESSION"));
        for (String bad : new String[] {"", "abc", "1; DROP TABLE", "11111111-1111-1111-1111-11111111111", ALICE + "x"}) {
            get(bad, "/api/accounts").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_SESSION"));
        }
        assertThat(sessions.count()).isZero();
    }

    @Test
    void theHealthCheckAnswersWithoutASessionAndCreatesNoVisitor() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/health"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
        assertThat(sessions.count()).isZero();
        assertThat(accounts.count()).isZero();
    }

    @Test
    void theSameSessionIdInDifferentCapitalsIsTheSameVisitor() throws Exception {
        post(ALICE, "/api/accounts", "{\"providerIds\":[" + providerId("Monzo") + "]}").andExpect(status().isCreated());
        get(ALICE.toUpperCase(), "/api/accounts").andExpect(jsonPath("$.accounts[?(@.provider.name=='Monzo')]").isNotEmpty());
        assertThat(sessions.count()).isEqualTo(1);
    }

    @Test
    void theSameProviderAndTheSameTypedNameCanBelongToTwoVisitors() throws Exception {
        String body = "{\"providerIds\":[" + providerId("Monzo") + "],\"customNames\":[\"Family Trust\"]}";
        post(ALICE, "/api/accounts", body).andExpect(status().isCreated());
        post(BOB, "/api/accounts", body).andExpect(status().isCreated());
        post(ALICE, "/api/accounts", body).andExpect(status().isConflict());
    }

    @Test
    void submittingIsDecidedPerVisitor() throws Exception {
        post(ALICE, "/api/submit", "{}").andExpect(status().isUnprocessableEntity());
        upload(ALICE, accountId(ALICE, "HSBC"), pdf(0), "h.pdf").andExpect(status().isOk());
        upload(ALICE, accountId(ALICE, "Vanguard"), pdf(0), "v.pdf").andExpect(status().isOk());
        post(ALICE, "/api/submit", "{}").andExpect(status().isOk());
        post(BOB, "/api/submit", "{}").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.issues.length()").value(2));
    }

    @Test
    void aNewVisitorNeverInheritsAnotherVisitorsChanges() throws Exception {
        post(ALICE, "/api/accounts", "{\"providerIds\":[" + providerId("Monzo") + "],\"customNames\":[\"Secret Trust\"]}").andExpect(status().isCreated());
        mvc.perform(delete("/api/accounts/" + accountId(ALICE, "Barclays")).header("X-Session-Id", ALICE)).andExpect(status().isNoContent());
        upload(ALICE, accountId(ALICE, "HSBC"), pdf(0), "alice.pdf").andExpect(status().isOk());

        get(CARA, "/api/accounts")
                .andExpect(jsonPath("$.readiness.total").value(4))
                .andExpect(jsonPath("$.readiness.ready").value(2))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Barclays')].status").value("UPLOADED"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='HSBC')].status").value("MISSING"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Monzo')]").isEmpty())
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Secret Trust')]").isEmpty());
    }

    @Test
    void idleVisitorsAreRemovedWithAllTheirDataWhileActiveOnesStay() throws Exception {
        get(ALICE, "/api/accounts");
        clock.advance(Duration.ofMinutes(100));
        get(BOB, "/api/accounts");
        clock.advance(Duration.ofMinutes(30));

        assertThat(sessionService.purgeIdleSince(clock.instant().minus(Duration.ofMinutes(120)))).isEqualTo(1);
        assertThat(sessions.findById(ALICE)).isEmpty();
        assertThat(sessions.findById(BOB)).isPresent();
        assertThat(accounts.findAllBySessionId(ALICE)).isEmpty();
        assertThat(accounts.findAllBySessionId(BOB)).hasSize(4);
        assertThat(files.count()).isEqualTo(3);
    }

    @Test
    void whenTheDemoIsBusyTheLongestIdleVisitorIsReleasedSoANewOneAlwaysGetsIn() throws Exception {
        String[] ids = {ALICE, BOB, CARA, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"};
        for (String id : ids) {
            get(id, "/api/accounts");
            clock.advance(Duration.ofMinutes(1));
        }
        get("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "/api/accounts").andExpect(status().isOk()).andExpect(jsonPath("$.readiness.total").value(4));
        assertThat(sessions.count()).isEqualTo(4);
        assertThat(sessions.findById(ALICE)).isEmpty();
    }

    @Test
    void eachVisitorHasAStorageLimitThatDoesNotAffectOthers() throws Exception {
        long hsbc = accountId(ALICE, "HSBC");
        upload(ALICE, hsbc, pdf(400_000), "one.pdf").andExpect(status().isOk());
        long vanguard = accountId(ALICE, "Vanguard");
        upload(ALICE, vanguard, pdf(700_000), "two.pdf").andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("STORAGE_LIMIT"));
        upload(BOB, accountId(BOB, "Vanguard"), pdf(700_000), "bob.pdf").andExpect(status().isOk());
    }
}
