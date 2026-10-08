import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cutoffFor, parseIso, toIso, validityOf } from '@/lib/dates'
import { formatDate } from '@/lib/format'

interface Props {
  value: string
  onChange: (iso: string) => void
  today: string
  providerName: string
}

export function StatementDatePicker({ value, onChange, today, providerName }: Props) {
  const [open, setOpen] = useState(false)
  const cutoff = cutoffFor(today)
  const validity = value ? validityOf(value, today) : null
  const selected = value ? parseIso(value) : undefined

  return (
    <div className="grid gap-3">
      <button
        type="button"
        id="statement-date"
        aria-labelledby="statement-date-label statement-date-value"
        aria-expanded={open}
        aria-controls="statement-calendar"
        onClick={() => setOpen(o => !o)}
        className="flex h-11 items-center justify-between rounded-lg border border-input px-3 text-left text-sm outline-none transition-colors hover:border-primary/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span id="statement-date-value" className={value ? '' : 'text-muted-foreground'}>
          {value ? formatDate(value) : 'Select the statement date'}
        </span>
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
      </button>

      {open && (
        <div id="statement-calendar" className="rounded-xl border border-border bg-background/40 p-3">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={d => {
              if (d) onChange(toIso(d))
              setOpen(false)
            }}
            defaultMonth={selected ?? parseIso(today)}
            disabled={{ after: parseIso(today) }}
            modifiers={{ outdated: { before: parseIso(cutoff) } }}
            modifiersClassNames={{ outdated: 'is-outdated' }}
            weekStartsOn={1}
            showOutsideDays
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left' ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />,
            }}
            classNames={{
              root: 'relative w-full',
              months: 'flex flex-col',
              month: 'grid gap-2',
              month_caption: 'flex h-8 items-center px-1 text-sm font-medium',
              nav: 'absolute top-0 right-0 flex gap-1',
              button_previous: 'flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30',
              button_next: 'flex size-8 items-center justify-center rounded-md hover:bg-muted disabled:opacity-30',
              month_grid: 'w-full border-collapse',
              weekdays: '',
              weekday: 'pb-1 text-center text-xs font-normal text-muted-foreground',
              week: '',
              day: 'group/day p-0.5 text-center text-sm',
              day_button:
                'mx-auto flex size-9 items-center justify-center rounded-md outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 group-[.is-outdated]/day:text-bad group-[.is-outdated]/day:hover:bg-bad/15 group-[.is-selected]/day:bg-primary group-[.is-selected]/day:hover:bg-primary group-[.is-selected]/day:font-semibold group-[.is-selected]/day:text-primary-foreground group-[.is-selected.is-outdated]/day:bg-bad group-[.is-selected.is-outdated]/day:hover:bg-bad group-[.is-selected.is-outdated]/day:text-primary-foreground group-[.is-today]/day:ring-1 group-[.is-today]/day:ring-foreground/40 group-[.is-disabled]/day:pointer-events-none group-[.is-disabled]/day:opacity-30',
              selected: 'is-selected',
              today: 'is-today',
              disabled: 'is-disabled',
              outside: 'opacity-40',
              hidden: 'invisible',
            }}
          />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" aria-hidden />
              Current: {formatDate(cutoff)} onwards
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-bad" aria-hidden />
              Outdated: before {formatDate(cutoff)}
            </span>
            <span>Future dates aren't available</span>
          </div>
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        data-testid="date-validity"
        data-validity={validity ?? 'none'}
        className={cn(
          'flex gap-2.5 rounded-lg px-3 py-2.5 text-sm',
          validity === 'current' && 'bg-primary/10 text-foreground',
          validity === 'outdated' && 'bg-bad/10 text-foreground',
          validity === null && 'bg-muted/60 text-muted-foreground',
        )}
      >
        {validity === null && (
          <>
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              Choose the date printed on your statement. We'll tell you straight away whether it meets the three-month
              requirement.
            </p>
          </>
        )}
        {validity === 'current' && (
          <>
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">This statement is current</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Your statement meets the three-month recency requirement.
              </p>
            </div>
          </>
        )}
        {validity === 'outdated' && (
          <>
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
            <div>
              <p className="font-medium">This statement is outdated</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                It is dated before {formatDate(cutoff)}, so it won't count towards your readiness. You can still save it,
                and {providerName} will show as Outdated until you add a newer statement.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
