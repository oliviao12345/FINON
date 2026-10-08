package app.finon.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.imageio.ImageIO;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;

final class FileRules {

    static final int MAX_BYTES = 5 * 1024 * 1024;

    private static final Set<String> EXTENSIONS = Set.of("pdf", "doc", "docx", "jpg", "jpeg", "png");
    private static final long MAX_UNZIPPED_BYTES = 100L * 1024 * 1024;

    enum Kind {
        PDF("application/pdf", "PDF"),
        PNG("image/png", "PNG image"),
        JPEG("image/jpeg", "JPG image"),
        DOC("application/msword", "Word document"),
        DOCX("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word document");

        final String mime;
        final String label;

        Kind(String mime, String label) {
            this.mime = mime;
            this.label = label;
        }
    }

    private FileRules() {}

    static boolean isAllowedName(String name) {
        int dot = name.lastIndexOf('.');
        return dot > 0 && EXTENSIONS.contains(name.substring(dot + 1).toLowerCase(Locale.ROOT));
    }

    /** What the file really is, judged by its contents rather than its name. Null if unrecognised. */
    static Kind detect(byte[] d) {
        if (starts(d, '%', 'P', 'D', 'F', '-')) return Kind.PDF;
        if (starts(d, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)) return Kind.PNG;
        if (starts(d, 0xFF, 0xD8, 0xFF)) return Kind.JPEG;
        if (starts(d, 0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1)) return Kind.DOC;
        if (starts(d, 'P', 'K', 0x03, 0x04)) return hasWordEntries(d) ? Kind.DOCX : null;
        return null;
    }

    /** True when the file is intact and can be opened by an ordinary viewer. */
    static boolean isReadable(Kind kind, byte[] d) {
        return switch (kind) {
            case PDF -> hasPdfEnd(d) && pdfOpens(d);
            case PNG -> imageDecodes(d);
            case JPEG -> jpegIsComplete(d);
            case DOC -> oleIsComplete(d);
            case DOCX -> hasZipEnd(d) && zipIsIntact(d);
        };
    }

    /** Every complete PDF finishes with an end-of-file marker; a cut-off download doesn't. */
    private static boolean hasPdfEnd(byte[] d) {
        int from = Math.max(0, d.length - 2048);
        String tail = new String(d, from, d.length - from, java.nio.charset.StandardCharsets.ISO_8859_1);
        return tail.contains("%%EOF");
    }

    private static boolean pdfOpens(byte[] d) {
        try (PDDocument doc = Loader.loadPDF(d)) {
            return doc.getNumberOfPages() > 0;
        } catch (InvalidPasswordException e) {
            return true; // intact, just password protected
        } catch (IOException | RuntimeException e) {
            return false;
        }
    }

    private static boolean imageDecodes(byte[] d) {
        try {
            var image = ImageIO.read(new ByteArrayInputStream(d));
            return image != null && image.getWidth() > 0 && image.getHeight() > 0;
        } catch (IOException | RuntimeException e) {
            return false;
        }
    }

    /** A finished JPEG ends with the end-of-image marker. (Checked directly because some valid CMYK JPEGs can't be decoded by the JDK.) */
    private static boolean jpegIsComplete(byte[] d) {
        int end = d.length;
        while (end > 2 && d[end - 1] == 0) end--;
        return end > 4 && (d[end - 2] & 0xFF) == 0xFF && (d[end - 1] & 0xFF) == 0xD9;
    }

    private static boolean oleIsComplete(byte[] d) {
        if (d.length < 512 * 3) return false;
        int shift = (d[30] & 0xFF) | ((d[31] & 0xFF) << 8);
        if (shift != 9 && shift != 12) return false;
        int sector = 1 << shift;
        return (d.length - sector) % sector == 0;
    }

    private static boolean hasWordEntries(byte[] d) {
        boolean content = false;
        boolean document = false;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(d))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                content |= entry.getName().equals("[Content_Types].xml");
                document |= entry.getName().equals("word/document.xml");
            }
        } catch (IOException | RuntimeException e) {
            return false;
        }
        return content && document;
    }

    /** A complete zip finishes with an "end of central directory" record; a cut-off one doesn't. */
    private static boolean hasZipEnd(byte[] d) {
        int from = Math.max(0, d.length - 65_557);
        for (int i = d.length - 22; i >= from; i--) {
            if (d[i] == 'P' && d[i + 1] == 'K' && d[i + 2] == 0x05 && d[i + 3] == 0x06) return true;
        }
        return false;
    }

    private static boolean zipIsIntact(byte[] d) {
        long total = 0;
        byte[] buffer = new byte[8192];
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(d))) {
            while (zip.getNextEntry() != null) {
                int n;
                while ((n = zip.read(buffer)) > 0) {
                    total += n;
                    if (total > MAX_UNZIPPED_BYTES) return false;
                }
            }
            return true;
        } catch (IOException | RuntimeException e) {
            return false;
        }
    }

    private static boolean starts(byte[] data, int... prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if ((data[i] & 0xFF) != prefix[i]) return false;
        }
        return true;
    }
}
