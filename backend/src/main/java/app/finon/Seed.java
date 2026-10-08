package app.finon;

import app.finon.domain.*;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import app.finon.service.NameKey;
import java.util.List;
import java.util.Objects;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class Seed implements CommandLineRunner {

    private final ProviderRepository providers;
    Seed(ProviderRepository providers) {
        this.providers = providers;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (providers.count() > 0) return;

        List<Provider> loaded = loadCatalogue();
        requireUniqueNames(loaded);
        applyHelp(loaded);
        applyWebsites(loaded);
        providers.saveAll(loaded);
    }

    private static void requireUniqueNames(List<Provider> catalogue) {
        var seen = new java.util.HashMap<String, String>();
        for (Provider p : catalogue) {
            String other = seen.put(NameKey.of(p.getName()), p.getName());
            if (other != null) {
                throw new IllegalStateException("Duplicate provider names in the catalogue: " + other + " / " + p.getName());
            }
        }
    }

    private static List<Provider> loadCatalogue() {
        try (var in = Seed.class.getResourceAsStream("/providers.csv")) {
            var reader = new BufferedReader(new InputStreamReader(Objects.requireNonNull(in), StandardCharsets.UTF_8));
            return reader.lines().skip(1)
                    .map(String::trim)
                    .filter(l -> !l.isEmpty())
                    .map(l -> {
                        int cut = l.lastIndexOf(',');
                        return new Provider(l.substring(0, cut).trim(), l.substring(cut + 1).trim());
                    })
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void applyWebsites(List<Provider> catalogue) {
        try (var in = Seed.class.getResourceAsStream("/provider-websites.csv")) {
            var reader = new BufferedReader(new InputStreamReader(Objects.requireNonNull(in), StandardCharsets.UTF_8));
            reader.lines().skip(1).map(String::trim).filter(l -> !l.isEmpty()).forEach(line -> {
                int cut = line.lastIndexOf(',');
                String name = line.substring(0, cut);
                String url = line.substring(cut + 1);
                Provider p = catalogue.stream().filter(x -> x.getName().equals(name)).findFirst()
                        .orElseThrow(() -> new IllegalStateException("Website for unknown provider: " + name));
                if (!url.startsWith("https://")) {
                    throw new IllegalStateException("Website must be https: " + name);
                }
                p.setWebsiteUrl(url);
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static void applyHelp(List<Provider> catalogue) {
        try (var in = Seed.class.getResourceAsStream("/provider-help.csv")) {
            var reader = new BufferedReader(new InputStreamReader(Objects.requireNonNull(in), StandardCharsets.UTF_8));
            reader.lines().skip(1).map(String::trim).filter(l -> !l.isEmpty()).forEach(line -> {
                String[] c = line.split(",", -1);
                Provider p = catalogue.stream().filter(x -> x.getName().equals(c[0])).findFirst()
                        .orElseThrow(() -> new IllegalStateException("Help data for unknown provider: " + c[0]));
                if (!c[1].startsWith("https://") || c[3].isBlank()) {
                    throw new IllegalStateException("Help link must be https and carry a verified date: " + c[0]);
                }
                p.setHelp(c[1], c[2].isBlank() ? null : c[2]);
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
