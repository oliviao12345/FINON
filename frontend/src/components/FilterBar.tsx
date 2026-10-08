import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/format'
import type { Account, Status } from '@/lib/types'

export type Filter = 'ALL' | 'ATTENTION' | Status

const ORDER: Filter[] = ['ALL', 'ATTENTION', 'MISSING', 'OUTDATED', 'UPLOADED']

export const matchesFilter = (a: Account, f: Filter) =>
  f === 'ALL' || (f === 'ATTENTION' ? a.status !== 'UPLOADED' : a.status === f)

export function FilterBar({ accounts, value, onChange }: { accounts: Account[]; value: Filter; onChange: (f: Filter) => void }) {
  const count = (f: Filter) => accounts.filter(a => matchesFilter(a, f)).length

  return (
    <div role="group" aria-label="Filter providers by status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {ORDER.filter(f => f !== 'ATTENTION' || count(f) > 0 || value === f).map(f => {
        const active = value === f
        return (
          <button
            key={f}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(f)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'border-primary/40 bg-primary/12 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {f === 'ALL' ? 'All' : f === 'ATTENTION' ? 'Needs attention' : STATUS_LABEL[f]}
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-primary/20' : 'bg-muted')}>{count(f)}</span>
          </button>
        )
      })}
    </div>
  )
}
