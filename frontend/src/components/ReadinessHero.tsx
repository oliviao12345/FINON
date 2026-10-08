import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { joinNames, plural } from '@/lib/format'
import type { Account, Readiness } from '@/lib/types'

const SEGMENT = {
  UPLOADED: 'bg-ok',
  OUTDATED: 'bg-warn',
  MISSING: 'bg-bad/45',
} as const

export function guidance(accounts: Account[], r: Readiness) {
  if (r.total === 0) {
    return { title: 'Start by adding your providers', body: 'Add every bank, pension and investment platform you hold money with. We need one recent statement from each.' }
  }
  if (r.canSubmit) {
    return { title: "You're ready to submit", body: 'Every provider has a current statement. Review the list, then send your pack to your adviser.' }
  }
  const missing = accounts.filter(a => a.status === 'MISSING').map(a => a.provider.name)
  const outdated = accounts.filter(a => a.status === 'OUTDATED').map(a => a.provider.name)
  const parts: string[] = []
  if (missing.length) parts.push(`${joinNames(missing)} ${missing.length === 1 ? 'has' : 'have'} no statement`)
  if (outdated.length) parts.push(`${joinNames(outdated)} ${outdated.length === 1 ? 'is' : 'are'} more than 3 months old`)
  const left = r.total - r.ready
  return {
    title: `${plural(left, 'step')} to go`,
    body: `${parts.join(', and ')}. Upload ${left === 1 ? 'a current statement' : 'current statements'} to finish.`,
  }
}

export function ReadinessHero({ accounts, readiness, submitted }: { accounts: Account[]; readiness: Readiness; submitted: boolean }) {
  const { ready, total, canSubmit } = readiness
  const g = guidance(accounts, readiness)
  const pct = total === 0 ? 0 : Math.round((ready / total) * 100)

  return (
    <section
      aria-labelledby="readiness-title"
      className="rise relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8"
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl transition-opacity duration-500',
          canSubmit ? 'bg-primary/25 opacity-100' : 'bg-primary/10 opacity-70',
        )}
      />
      <div className="relative flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Onboarding progress</p>
            <h2 id="readiness-title" className="mt-2 flex items-baseline gap-3 text-4xl font-semibold tracking-tight sm:text-5xl">
              <span data-testid="ready-count" className="tabular-nums">
                {ready} of {total} ready
              </span>
            </h2>
          </div>
          {(canSubmit || submitted) && (
            <span className="rise inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <ShieldCheck className="size-6" aria-hidden />
            </span>
          )}
        </div>

        <div
          role="progressbar"
          aria-label="Providers with a current statement"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={ready}
          aria-valuetext={`${ready} of ${total} providers ready`}
          className="flex gap-1.5"
        >
          {total === 0 ? (
            <span className="h-2 w-full rounded-full bg-muted" />
          ) : (
            accounts.map(a => (
              <span
                key={a.id}
                title={`${a.provider.name}: ${a.status.toLowerCase()}`}
                className={cn('h-2 flex-1 rounded-full transition-colors duration-300', SEGMENT[a.status])}
              />
            ))
          )}
        </div>

        <div aria-live="polite">
          <p className="font-medium">{submitted ? 'Your pack has been submitted' : g.title}</p>
          <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {submitted ? "Thanks - we have everything we need. Your adviser will be in touch." : g.body}
          </p>
          <span className="sr-only">{pct}% complete</span>
        </div>
      </div>
    </section>
  )
}
