package app.finon.service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Builds a one-page placeholder PDF so the demo statements have something real to open. */
public final class SamplePdf {

    private SamplePdf() {}

    public static byte[] of(String provider, String statementDate) {
        String text = String.join("\n",
                "BT /F1 24 Tf 72 760 Td (" + escape(provider) + ") Tj ET",
                "BT /F1 14 Tf 72 725 Td (Sample statement dated " + escape(statementDate) + ") Tj ET",
                "BT /F1 11 Tf 72 690 Td (Placeholder document generated for the FINON demo.) Tj ET",
                "BT /F1 11 Tf 72 672 Td (It is not a real statement and holds no account information.) Tj ET");

        List<String> objects = new ArrayList<>();
        objects.add("<< /Type /Catalog /Pages 2 0 R >>");
        objects.add("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
        objects.add("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
                + "/Resources << /Font << /F1 5 0 R >> >> >>");
        objects.add("<< /Length " + text.length() + " >>\nstream\n" + text + "\nendstream");
        objects.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

        StringBuilder pdf = new StringBuilder("%PDF-1.4\n");
        int[] offsets = new int[objects.size()];
        for (int i = 0; i < objects.size(); i++) {
            offsets[i] = pdf.length();
            pdf.append(i + 1).append(" 0 obj\n").append(objects.get(i)).append("\nendobj\n");
        }
        int xref = pdf.length();
        pdf.append("xref\n0 ").append(objects.size() + 1).append("\n0000000000 65535 f \n");
        for (int offset : offsets) {
            pdf.append(String.format("%010d 00000 n \n", offset));
        }
        pdf.append("trailer\n<< /Size ").append(objects.size() + 1).append(" /Root 1 0 R >>\nstartxref\n")
                .append(xref).append("\n%%EOF\n");
        return pdf.toString().getBytes(StandardCharsets.ISO_8859_1);
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replaceAll("[^\\x20-\\x7E]", "?");
    }
}
