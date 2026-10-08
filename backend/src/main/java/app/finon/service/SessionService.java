package app.finon.service;

import app.finon.domain.*;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Anonymous, per-browser sessions. A session id is a random UUID the browser generates and sends with every
 * request. It is a private, unguessable key to that visitor's data, not a login.
 */
@Service
public class SessionService {

    public static final String HEADER = "X-Session-Id";

    private static final Pattern UUID_FORMAT =
            Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$");
    private static final Duration TOUCH_EVERY = Duration.ofMinutes(1);

    private final ClientSessionRepository sessions;
    private final ClientAccountRepository accounts;
    private final StatementFileRepository files;
    private final DemoSeeder demo;
    private final Clock clock;
    private final TransactionTemplate tx;
    private final Duration idleLimit;
    private final int maxSessions;
    private final Object lock = new Object();

    public SessionService(ClientSessionRepository sessions, ClientAccountRepository accounts,
                          StatementFileRepository files, DemoSeeder demo, Clock clock,
                          PlatformTransactionManager transactions,
                          @Value("${finon.sessions.idle-minutes:120}") long idleMinutes,
                          @Value("${finon.sessions.max:200}") int maxSessions) {
        this.sessions = sessions;
        this.accounts = accounts;
        this.files = files;
        this.demo = demo;
        this.clock = clock;
        this.tx = new TransactionTemplate(transactions);
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.idleLimit = Duration.ofMinutes(idleMinutes);
        this.maxSessions = maxSessions;
    }

    /** Checks the id, creates the session (with the four sample providers) on first sight, and marks it as in use. */
    public String open(String rawId) {
        String id = rawId == null ? "" : rawId.trim().toLowerCase(Locale.ROOT);
        if (!UUID_FORMAT.matcher(id).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SESSION",
                    "Your browser did not send a valid session. Please reload the page.");
        }
        synchronized (lock) {
            tx.executeWithoutResult(status -> {
                Instant now = Instant.now(clock);
                ClientSession existing = sessions.findById(id).orElse(null);
                if (existing == null) {
                    makeRoom(now);
                    sessions.save(new ClientSession(id, now));
                    demo.seed(id);
                } else if (Duration.between(existing.getLastSeen(), now).compareTo(TOUCH_EVERY) > 0) {
                    existing.touch(now);
                    sessions.save(existing);
                }
            });
        }
        return id;
    }

    /** Removes sessions idle for longer than the limit, together with everything they own. */
    @Scheduled(fixedDelayString = "${finon.sessions.cleanup-ms:600000}")
    public void purgeIdle() {
        purgeIdleSince(Instant.now(clock).minus(idleLimit));
    }

    public int purgeIdleSince(Instant cutoff) {
        synchronized (lock) {
            Integer removed = tx.execute(status -> {
                List<ClientSession> stale = sessions.findByLastSeenBefore(cutoff);
                stale.forEach(this::deleteSession);
                return stale.size();
            });
            return removed == null ? 0 : removed;
        }
    }

    private void makeRoom(Instant now) {
        sessions.findByLastSeenBefore(now.minus(idleLimit)).forEach(this::deleteSession);
        List<ClientSession> oldestFirst = sessions.findAllByOrderByLastSeenAsc();
        int surplus = oldestFirst.size() - (maxSessions - 1);
        for (int i = 0; i < surplus; i++) {
            deleteSession(oldestFirst.get(i));
        }
    }

    private void deleteSession(ClientSession session) {
        List<ClientAccount> owned = accounts.findAllBySessionId(session.getId());
        files.deleteAllById(owned.stream().map(ClientAccount::getId).toList());
        accounts.deleteAll(owned);
        sessions.delete(session);
    }
}
