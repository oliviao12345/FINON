package app.finon.domain;

import java.util.List;

public final class Categories {

    public static final List<String> ALL =
            List.of("Bank", "Building society", "Insurance", "Investments", "Pension", "Property", "Savings", "Other");

    private Categories() {}

    public static boolean isValid(String category) {
        return category != null && ALL.contains(category);
    }

    public static int rank(String category) {
        int i = ALL.indexOf(category);
        return i < 0 ? ALL.size() : i;
    }
}
