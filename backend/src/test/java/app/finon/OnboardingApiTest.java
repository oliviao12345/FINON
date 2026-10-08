package app.finon;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import app.finon.domain.*;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockMultipartFile;
import java.time.Instant;
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
    @Autowired StatementFileRepository files;

    Long barclays;
    Long hsbc;

    @BeforeEach
    void reset() {
        accounts.deleteAll();
        files.deleteAll();
        barclays = providers.findAll().stream()
                .filter(p -> p.getName().equals("Barclays")).findFirst().orElseThrow().getId();
        hsbc = providers.findAll().stream()
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
    void acceptsPdfWordAndImageFilesInAnyCase() throws Exception {
        Long a = addAccount(barclays);
        for (String name : new String[] {"s.pdf", "s.doc", "s.docx", "s.jpg", "s.jpeg", "s.png", "SCAN.PDF", "Statement.DocX"}) {
            mvc.perform(put("/api/accounts/" + a + "/statement").contentType(MediaType.APPLICATION_JSON)
                    .content("{\"filename\":\"" + name + "\",\"statementDate\":\"2026-10-01\"}"))
                    .andExpect(status().isOk());
        }
    }

    @Test
    void rejectsUnsupportedFileTypesWithoutChangingTheAccount() throws Exception {
        Long a = addAccount(barclays);
        for (String name : new String[] {"notes.txt", "sheet.xlsx", "archive.zip", "script.exe", "noextension", "statement.pdf.exe", ".pdf"}) {
            mvc.perform(put("/api/accounts/" + a + "/statement").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"filename\":\"" + name + "\",\"statementDate\":\"2026-10-01\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        }
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.accounts[0].status").value("MISSING"));
    }

    private void addCustom(String name) throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                .content("{\"customNames\":[\"" + name + "\"]}")).andExpect(status().isCreated());
    }

    @Test
    void catalogueIsLargeAndGroupedIntoCategories() throws Exception {
        mvc.perform(get("/api/providers"))
                .andExpect(jsonPath("$.length()").value(org.hamcrest.Matchers.greaterThan(200)))
                .andExpect(jsonPath("$[?(@.category=='Building society')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.category=='Pension')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.category=='Investments')]").isNotEmpty())
                .andExpect(jsonPath("$[?(@.category=='Other')]").isEmpty());
    }

    @Test
    void customProviderIsPersonalAndNeverWrittenToTheProviderList() throws Exception {
        long catalogueSize = providers.count();
        addCustom("  Hartley   Family  Trust ");
        org.junit.jupiter.api.Assertions.assertEquals(catalogueSize, providers.count());
        org.junit.jupiter.api.Assertions.assertTrue(providers.findByNameIgnoreCase("Hartley Family Trust").isEmpty());
        org.junit.jupiter.api.Assertions.assertTrue(
                providers.findAll().stream().noneMatch(p -> p.getName().contains("Hartley")));
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.accounts[0].provider.name").value("Hartley Family Trust"))
                .andExpect(jsonPath("$.accounts[0].provider.category").value("Other"))
                .andExpect(jsonPath("$.accounts[0].provider.id").doesNotExist())
                .andExpect(jsonPath("$.accounts[0].status").value("MISSING"));
        mvc.perform(get("/api/providers"))
                .andExpect(jsonPath("$[?(@.name=='Hartley Family Trust')]").isEmpty());
    }

    @Test
    void customNameMatchingTheCatalogueUsesTheCatalogueEntry() throws Exception {
        addCustom("monzo");
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.accounts[0].provider.name").value("Monzo"))
                .andExpect(jsonPath("$.accounts[0].provider.category").value("Bank"));
    }

    @Test
    void customNameIsRejectedWhenAlreadyAddedInAnyCase() throws Exception {
        addCustom("Hartley Family Trust");
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customNames\":[\"HARTLEY family trust\"]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_PROVIDER"));
        addCustom("Monzo");
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customNames\":[\"MONZO\"]}"))
                .andExpect(status().isConflict());
    }

    @Test
    void theCatalogueItselfNeverContainsTwoNamesThatAreTheSameThing() {
        var seen = new java.util.HashSet<String>();
        providers.findAll().forEach(p ->
                org.junit.jupiter.api.Assertions.assertTrue(seen.add(app.finon.service.NameKey.of(p.getName())), p.getName()));
        org.junit.jupiter.api.Assertions.assertTrue(providers.findByNameIgnoreCase("Hargreaves Lansdown SIPP").isEmpty());
    }

    @Test
    void aTypedNameThatIsTheSameProviderUnderAnyDisguiseIsRefusedAsADuplicate() throws Exception {
        addAccount(hsbc);
        for (String disguise : new String[] {"hsbc", "HSBC ", "H.S.B.C.", "h s b c", "  Hsbc  "}) {
            mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"customNames\":[\"" + disguise + "\"]}"))
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.code").value("DUPLICATE_PROVIDER"))
                    .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("HSBC")));
        }
        org.junit.jupiter.api.Assertions.assertEquals(1, accounts.count());
    }

    @Test
    void personalNamesAreDuplicatesTooRegardlessOfPunctuationAndSpacing() throws Exception {
        addCustom("Hartley Family Trust");
        for (String disguise : new String[] {"hartley-family trust", "HARTLEY FAMILY TRUST", "Hartley  Family  Trust.", "hartleyfamilytrust"}) {
            mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"customNames\":[\"" + disguise + "\"]}"))
                    .andExpect(status().isConflict());
        }
        org.junit.jupiter.api.Assertions.assertEquals(1, accounts.count());
    }

    @Test
    void theSameNameTwiceInOneRequestIsAddedOnlyOnce() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + barclays + "],\"customNames\":[\"barclays\",\"Smith Trust\",\"SMITH TRUST\"]}"))
                .andExpect(status().isCreated());
        org.junit.jupiter.api.Assertions.assertEquals(2, accounts.count());
    }

    @Test
    void theClientsChosenCategoryWinsOverTheCatalogueSuggestion() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + hsbc + "],\"choices\":[{\"providerId\":" + hsbc + ",\"category\":\"Savings\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accounts[0].category").value("Savings"))
                .andExpect(jsonPath("$.accounts[0].provider.category").value("Bank"));
    }

    @Test
    void categoriesAreAlphabeticalWithOtherAlwaysLastAndIncludeProperty() throws Exception {
        java.util.List<String> all = app.finon.domain.Categories.ALL;
        java.util.List<String> withoutOther = new java.util.ArrayList<>(all.subList(0, all.size() - 1));
        java.util.List<String> sorted = new java.util.ArrayList<>(withoutOther);
        java.util.Collections.sort(sorted);
        org.junit.jupiter.api.Assertions.assertEquals(sorted, withoutOther);
        org.junit.jupiter.api.Assertions.assertEquals("Other", all.get(all.size() - 1));
        org.junit.jupiter.api.Assertions.assertTrue(app.finon.domain.Categories.isValid("Property"));

        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + barclays + "],\"customNames\":[\"Kensington Flat\"],\"choices\":["
                                + "{\"providerId\":" + barclays + ",\"category\":\"Savings\"},"
                                + "{\"name\":\"Kensington Flat\",\"category\":\"Property\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accounts[0].provider.name").value("Barclays"))
                .andExpect(jsonPath("$.accounts[1].category").value("Property"));
    }

    @Test
    void typedProvidersGetTheCategoryTheClientPicked() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"customNames\":[\"Hartley Family Trust\",\"monzo\"],\"choices\":["
                                + "{\"name\":\"Hartley Family Trust\",\"category\":\"Investments\"},"
                                + "{\"name\":\"monzo\",\"category\":\"Savings\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Hartley Family Trust')].category").value("Investments"))
                .andExpect(jsonPath("$.accounts[?(@.provider.name=='Monzo')].category").value("Savings"));
    }

    @Test
    void anUnknownCategoryIsRefusedAndNothingIsAdded() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + hsbc + "],\"choices\":[{\"providerId\":" + hsbc + ",\"category\":\"Crypto\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CATEGORY"));
        org.junit.jupiter.api.Assertions.assertEquals(0, accounts.count());
    }

    @Test
    void theCategoryCanBeChangedLaterAndListIsOrderedByCategoryThenName() throws Exception {
        Long a = addAccount(barclays);
        Long b = addAccount(hsbc);
        mvc.perform(put("/api/accounts/" + b + "/category").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Pension\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.category").value("Pension"));
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.accounts[0].provider.name").value("Barclays"))
                .andExpect(jsonPath("$.accounts[1].provider.name").value("HSBC"))
                .andExpect(jsonPath("$.accounts[1].category").value("Pension"));
        mvc.perform(put("/api/accounts/" + a + "/category").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Nonsense\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/accounts/999999/category").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Bank\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void manuallyAddedProvidersAreFlaggedAndListedAfterEverythingElse() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + hsbc + "," + barclays + "],\"customNames\":[\"Aardvark Family Trust\"],"
                                + "\"choices\":[{\"name\":\"Aardvark Family Trust\",\"category\":\"Bank\"}]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accounts[0].manual").value(false))
                .andExpect(jsonPath("$.accounts[1].manual").value(false))
                .andExpect(jsonPath("$.accounts[2].provider.name").value("Aardvark Family Trust"))
                .andExpect(jsonPath("$.accounts[2].manual").value(true))
                .andExpect(jsonPath("$.accounts[2].category").value("Bank"));
    }

    @Test
    void changingTheCategoryDoesNotDisturbReadinessOrTheStatement() throws Exception {
        Long a = addAccount(barclays);
        upload(a, "2026-10-01");
        mvc.perform(put("/api/accounts/" + a + "/category").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"Investments\"}"))
                .andExpect(jsonPath("$.status").value("UPLOADED"))
                .andExpect(jsonPath("$.statement.filename").value("jan.pdf"));
        mvc.perform(get("/api/accounts")).andExpect(jsonPath("$.readiness.canSubmit").value(true));
    }

    @Test
    void invalidCustomNamesAreRejected() throws Exception {
        for (String name : new String[] {"", "a", "<script>alert(1)</script>", "x".repeat(81), "   ", "...", "- -"}) {
            mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"customNames\":[\"" + name + "\"]}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_PROVIDER_NAME"));
        }
    }

    @Test
    void emptyAddRequestIsRejected() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("NOTHING_SELECTED"));
    }

    @Test
    void catalogueAndPersonalProvidersCanBeAddedTogetherAndPersonalOnesVanishOnRemoval() throws Exception {
        mvc.perform(post("/api/accounts").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"providerIds\":[" + barclays + "],\"customNames\":[\"Smith Family Office\"]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.readiness.total").value(2));
        Long custom = accounts.findAll().stream()
                .filter(a -> a.isPersonal()).findFirst().orElseThrow().getId();
        mvc.perform(delete("/api/accounts/" + custom)).andExpect(status().isNoContent());
        mvc.perform(get("/api/accounts")).andExpect(jsonPath("$.readiness.total").value(1));
        addCustom("Smith Family Office");
        org.junit.jupiter.api.Assertions.assertTrue(providers.findByNameIgnoreCase("Smith Family Office").isEmpty());
    }

    @Test
    void verifiedHelpLinksAreSeededForOnlyAFewProviders() throws Exception {
        mvc.perform(get("/api/providers"))
                .andExpect(jsonPath("$[?(@.name=='HSBC')].statementHelpUrl").value(
                        "https://www.hsbc.co.uk/help/banking-made-easy/online-statements/"))
                .andExpect(jsonPath("$[?(@.name=='Barclays')].supportPhone").value("0345 734 5345"))
                .andExpect(jsonPath("$[?(@.name=='Monzo')].statementHelpUrl").value(org.hamcrest.Matchers.contains((Object) null)))
                .andExpect(jsonPath("$[?(@.statementHelpUrl != null)]").value(org.hamcrest.Matchers.hasSize(5)));
    }

    @Test
    void mostCatalogueProvidersCarryAnHttpsWebsite() throws Exception {
        mvc.perform(get("/api/providers"))
                .andExpect(jsonPath("$[?(@.websiteUrl != null)]").value(org.hamcrest.Matchers.hasSize(org.hamcrest.Matchers.greaterThan(200))))
                .andExpect(jsonPath("$[?(@.websiteUrl =~ /^(?!https:\\/\\/).+/)]").isEmpty())
                .andExpect(jsonPath("$[?(@.name=='Barclays')].websiteUrl").value("https://www.barclays.co.uk"));
    }

    @Test
    void personalProvidersHaveNoWebsite() throws Exception {
        addCustom("Hartley Family Trust");
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.accounts[0].provider.websiteUrl").doesNotExist());
    }

    @Test
    void helpDetailsTravelWithTheAccount() throws Exception {
        addAccount(hsbc);
        mvc.perform(get("/api/accounts"))
                .andExpect(jsonPath("$.accounts[0].provider.statementHelpUrl").value(org.hamcrest.Matchers.startsWith("https://")));
    }

    private static final byte[] PDF = app.finon.service.SamplePdf.of("Test provider", "2026-10-01");
    private static final byte[] PNG = image("png");
    private static final byte[] JPEG = image("jpg");
    private static final byte[] DOCX = docx();
    private static final byte[] DOC = ole();

    private static byte[] image(String format) {
        try {
            var img = new java.awt.image.BufferedImage(8, 8, java.awt.image.BufferedImage.TYPE_INT_RGB);
            var out = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(img, format, out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] docx() {
        try {
            var out = new java.io.ByteArrayOutputStream();
            try (var zip = new java.util.zip.ZipOutputStream(out)) {
                for (String name : new String[] {"[Content_Types].xml", "word/document.xml"}) {
                    zip.putNextEntry(new java.util.zip.ZipEntry(name));
                    zip.write("<x/>".getBytes(StandardCharsets.UTF_8));
                    zip.closeEntry();
                }
            }
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] ole() {
        byte[] d = new byte[512 * 4];
        byte[] magic = {(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1};
        System.arraycopy(magic, 0, d, 0, magic.length);
        d[30] = 9;
        return d;
    }

    private static byte[] cut(byte[] d, double fraction) {
        return java.util.Arrays.copyOf(d, (int) (d.length * fraction));
    }

    private org.springframework.test.web.servlet.ResultActions uploadFile(Long id, String name, byte[] bytes) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .multipart(HttpMethod.PUT, "/api/accounts/" + id + "/statement")
                .file(new MockMultipartFile("file", name, "application/octet-stream", bytes))
                .param("statementDate", "2026-10-01"));
    }

    @Test
    void uploadedPdfIsStoredAndCanBeViewedInline() throws Exception {
        Long a = addAccount(barclays);
        uploadFile(a, "jan.pdf", PDF)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UPLOADED"))
                .andExpect(jsonPath("$.statement.hasFile").value(true));
        mvc.perform(get("/api/accounts/" + a + "/statement/file"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")))
                .andExpect(content().bytes(PDF));
    }

    @Test
    void imagesAreServedInlineAndWordDocumentsAsDownloads() throws Exception {
        Long a = addAccount(barclays);
        uploadFile(a, "scan.png", PNG).andExpect(status().isOk());
        mvc.perform(get("/api/accounts/" + a + "/statement/file"))
                .andExpect(content().contentType("image/png"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")));
        uploadFile(a, "letter.docx", DOCX).andExpect(status().isOk());
        mvc.perform(get("/api/accounts/" + a + "/statement/file"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));
    }

    @Test
    void everySupportedKindOfRealFileIsAcceptedUnderItsOwnName() throws Exception {
        Long a = addAccount(barclays);
        uploadFile(a, "s.pdf", PDF).andExpect(status().isOk());
        uploadFile(a, "s.png", PNG).andExpect(status().isOk());
        uploadFile(a, "s.jpg", JPEG).andExpect(status().isOk());
        uploadFile(a, "S.JPEG", JPEG).andExpect(status().isOk());
        uploadFile(a, "s.docx", DOCX).andExpect(status().isOk());
        uploadFile(a, "s.doc", DOC).andExpect(status().isOk());
    }

    @Test
    void aRenamedButGenuineFileIsAcceptedAndServedAsWhatItReallyIs() throws Exception {
        Long a = addAccount(barclays);
        uploadFile(a, "STATEMENT.jpeg", DOCX).andExpect(status().isOk())
                .andExpect(jsonPath("$.statement.contentType")
                        .value("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
        mvc.perform(get("/api/accounts/" + a + "/statement/file"))
                .andExpect(content().contentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));

        uploadFile(a, "scan.pdf", JPEG).andExpect(status().isOk());
        mvc.perform(get("/api/accounts/" + a + "/statement/file"))
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")));
    }

    @Test
    void damagedOrUnreadableFilesAreRefusedAndNothingIsSaved() throws Exception {
        Long a = addAccount(barclays);
        byte[][] broken = {
            cut(PDF, 0.5),                 // truncated PDF
            "%PDF-1.4 not really a pdf".getBytes(StandardCharsets.UTF_8),
            cut(PNG, 0.6),                 // truncated PNG
            cut(JPEG, 0.5),                // truncated JPEG
            cut(DOCX, 0.5),                // truncated zip
            cut(DOC, 0.7),                 // truncated Word 97 file
            "<script>alert(1)</script>".getBytes(StandardCharsets.UTF_8),
            new byte[] {1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
        };
        String[] names = {"a.pdf", "b.pdf", "c.png", "d.jpg", "e.docx", "f.doc", "g.pdf", "h.jpeg"};
        for (int i = 0; i < broken.length; i++) {
            final String label = names[i];
            uploadFile(a, label, broken[i])
                    .andDo(r -> org.junit.jupiter.api.Assertions.assertEquals(400, r.getResponse().getStatus(), label))
                    .andExpect(jsonPath("$.code").value("FILE_UNREADABLE"));
        }
        mvc.perform(get("/api/accounts")).andExpect(jsonPath("$.accounts[0].status").value("MISSING"));
        org.junit.jupiter.api.Assertions.assertEquals(0, files.count());
    }

    @Test
    void aZipThatIsNotAWordDocumentIsRefused() throws Exception {
        Long a = addAccount(barclays);
        var out = new java.io.ByteArrayOutputStream();
        try (var zip = new java.util.zip.ZipOutputStream(out)) {
            zip.putNextEntry(new java.util.zip.ZipEntry("xl/workbook.xml"));
            zip.write("<x/>".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        uploadFile(a, "sheet.docx", out.toByteArray()).andExpect(status().isBadRequest());
    }

    @Test
    void aPasswordProtectedPdfIsStillAccepted() throws Exception {
        Long a = addAccount(barclays);
        var out = new java.io.ByteArrayOutputStream();
        try (var doc = new org.apache.pdfbox.pdmodel.PDDocument()) {
            doc.addPage(new org.apache.pdfbox.pdmodel.PDPage());
            var policy = new org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy(
                    "owner-secret", "user-secret", new org.apache.pdfbox.pdmodel.encryption.AccessPermission());
            policy.setEncryptionKeyLength(128);
            doc.protect(policy);
            doc.save(out);
        }
        uploadFile(a, "locked.pdf", out.toByteArray()).andExpect(status().isOk());
    }

    @Test
    void emptyOversizedAndWrongTypeFilesAreRefused() throws Exception {
        Long a = addAccount(barclays);
        uploadFile(a, "empty.pdf", new byte[0]).andExpect(status().isBadRequest());
        uploadFile(a, "notes.txt", PDF).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_FILE_TYPE"));
        byte[] big = new byte[5 * 1024 * 1024 + 1];
        System.arraycopy(PDF, 0, big, 0, PDF.length);
        uploadFile(a, "big.pdf", big).andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.code").value("FILE_TOO_LARGE"));
    }

    @Test
    void replacingAndRemovingStatementsKeepsStoredFilesInStep() throws Exception {
        Long a = addAccount(barclays);
        uploadFile(a, "one.pdf", PDF).andExpect(status().isOk());
        uploadFile(a, "two.png", PNG).andExpect(status().isOk());
        org.junit.jupiter.api.Assertions.assertEquals(1, files.count());
        mvc.perform(get("/api/accounts/" + a + "/statement/file")).andExpect(content().contentType("image/png"));

        upload(a, "2026-10-01");
        mvc.perform(get("/api/accounts/" + a + "/statement/file")).andExpect(status().isNotFound());
        org.junit.jupiter.api.Assertions.assertEquals(0, files.count());

        uploadFile(a, "three.pdf", PDF).andExpect(status().isOk());
        mvc.perform(delete("/api/accounts/" + a)).andExpect(status().isNoContent());
        org.junit.jupiter.api.Assertions.assertEquals(0, files.count());
    }

    @Test
    void anAccountWithNoStatementHasNoFile() throws Exception {
        Long a = addAccount(barclays);
        mvc.perform(get("/api/accounts/" + a + "/statement/file"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NO_FILE"));
    }

    @Test
    void thePlaceholderPdfUsedForDemoStatementsIsWellFormed() {
        byte[] pdf = app.finon.service.SamplePdf.of("Barclays (demo)", "2026-09-17");
        String text = new String(pdf, StandardCharsets.ISO_8859_1);
        org.junit.jupiter.api.Assertions.assertTrue(text.startsWith("%PDF-1.4"));
        org.junit.jupiter.api.Assertions.assertTrue(text.trim().endsWith("%%EOF"));
        int xref = Integer.parseInt(text.substring(text.indexOf("startxref") + 10).trim().split("\\s")[0]);
        org.junit.jupiter.api.Assertions.assertTrue(text.substring(xref).startsWith("xref"));
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
