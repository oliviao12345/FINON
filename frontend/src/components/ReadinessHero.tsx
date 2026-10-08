import { CheckCircle2, CircleDashed, Clock, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { plural, STATUS_LABEL } from '@/lib/format'
import type { Account, Readiness } from '@/lib/types'

const SEGMENT = {
  UPLOADED: 'bg-ok',
  OUTDATED: 'bg-warn',
  MISSING: 'bg-bad/45',
} as const

function NameLinks({ items, onSelect }: { items: Account[]; onSelect: (a: Account) => void }) {
  return (
    <>
      {items.map((a, i) => (
        <span key={a.id}>
          {i > 0 && (i === items.length - 1 ? ' and ' : ', ')}
          <button
            type="button"
            onClick={() => onSelect(a)}
            className="rounded font-medium text-foreground underline decoration-primary/60 decoration-dotted underline-offset-4 outline-none transition-colors hover:text-primary hover:decoration-solid focus-visible:ring-3 focus-visible:ring-ring/60"
          >
            {a.provider.name}
          </button>
        </span>
      ))}
    </>
  )
}

export function guidance(accounts: Account[], r: Readiness, onSelect: (a: Account) => void) {
  if (r.total === 0) {
    return { title: 'Start by adding your providers', body: <>Add every bank, pension and investment platform you hold money with. We need one recent statement from each.</> }
  }
  if (r.canSubmit) {
    return { title: "You're ready to submit", body: <>Every provider has a current statement. Review the list, then send your pack to your adviser.</> }
  }
  const missing = accounts.filter(a => a.status === 'MISSING')
  const outdated = accounts.filter(a => a.status === 'OUTDATED')
  const left = r.total - r.ready
  return {
    title: `${plural(left, 'step')} to go`,
    body: (
      <>
        {missing.length > 0 && (
          <>
            <NameLinks items={missing} onSelect={onSelect} /> {missing.length === 1 ? 'has' : 'have'} no statement
          </>
        )}
        {missing.length > 0 && outdated.length > 0 && ', and '}
        {outdated.length > 0 && (
          <>
            <NameLinks items={outdated} onSelect={onSelect} /> {outdated.length === 1 ? 'is' : 'are'} more than 3 months old
          </>
        )}
        . Select a name to add {left === 1 ? 'a current statement' : 'current statements'} straight away.
      </>
    ),
  }
}

interface HeroProps {
  accounts: Account[]
  readiness: Readiness
  submitted: boolean
  onSelect: (account: Account) => void
}

const HINT = {
  UPLOADED: 'statement on file. Select to view it',
  OUTDATED: 'statement is outdated. Select to replace it',
  MISSING: 'no statement. Select to add one',
} as const

const ACTION = {
  UPLOADED: 'View statement on file',
  OUTDATED: 'Replace statement?',
  MISSING: 'Add statement?',
} as const

const TIP_ICON = {
  UPLOADED: { icon: CheckCircle2, cls: 'text-ok' },
  OUTDATED: { icon: Clock, cls: 'text-warn' },
  MISSING: { icon: CircleDashed, cls: 'text-bad' },
} as const

function tooltipAlign(index: number, count: number) {
  if (count < 4) return 'left-1/2 -translate-x-1/2'
  if (index < count / 3) return 'left-0'
  if (index >= (count * 2) / 3) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}

export function ReadinessHero({ accounts, readiness, submitted, onSelect }: HeroProps) {
  const { ready, total, canSubmit } = readiness
  const g = guidance(accounts, readiness, onSelect)
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
            <p className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">Statements ready</p>
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

        <span
          role="progressbar"
          aria-label="Providers with a current statement"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={ready}
          aria-valuetext={`${ready} of ${total} providers ready`}
          className="sr-only"
        />
        {total === 0 ? (
          <span className="h-2 w-full rounded-full bg-muted" aria-hidden />
        ) : (
          <ul className="-my-2 flex gap-1.5" aria-label="Your providers. Select one to jump to it">
            {accounts.map((a, i) => (
              <li key={a.id} className="relative min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSelect(a)}
                  aria-label={`${a.provider.name}: ${HINT[a.status]}`}
                  className="group/seg flex h-6 w-full cursor-pointer items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  <span
                    className={cn(
                      'h-2 w-full rounded-full transition-all duration-200 group-hover/seg:h-3 group-focus-visible/seg:h-3',
                      SEGMENT[a.status],
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute bottom-full z-10 mb-1 w-max max-w-64 rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs opacity-0 shadow-lg transition-opacity duration-150 group-hover/seg:opacity-100 group-focus-visible/seg:opacity-100',
                      tooltipAlign(i, accounts.length),
                    )}
                  >
                    <span className="block font-medium text-foreground">{a.provider.name}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
                      {(() => {
                        const { icon: Icon, cls } = TIP_ICON[a.status]
                        return <Icon className={cn('size-3.5 shrink-0', cls)} aria-hidden />
                      })()}
                      <span>{STATUS_LABEL[a.status]}</span>
                      <span aria-hidden>·</span>
                      <span>{ACTION[a.status]}</span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div aria-live="polite" data-testid="readiness-summary">
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
