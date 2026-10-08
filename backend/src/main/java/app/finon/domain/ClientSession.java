package app.finon.domain;

import jakarta.persistence.*;
import java.time.Instant;

/** One anonymous visitor. Everything a visitor adds belongs to their session and is invisible to every other session. */
@Entity
public class ClientSession {

    @Id
    @Column(length = 36)
    private String id;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant lastSeen;

    protected ClientSession() {}

    public ClientSession(String id, Instant now) {
        this.id = id;
        this.createdAt = now;
        this.lastSeen = now;
    }

    public String getId() { return id; }
    public Instant getLastSeen() { return lastSeen; }
    public void touch(Instant now) { this.lastSeen = now; }
}
