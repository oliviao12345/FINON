package app.finon.service;

import java.text.Normalizer;
import java.util.Locale;

/** One definition of "the same name": ignores case, accents, spacing and punctuation, and treats & as "and". */
public final class NameKey {

    private NameKey() {}

    public static String of(String name) {
        String s = Normalizer.normalize(name, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
        return s.toLowerCase(Locale.ROOT).replace("&", "and").replaceAll("[^\\p{L}\\p{N}]+", "");
    }
}
