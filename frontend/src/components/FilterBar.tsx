import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/format'
import type { Account, Status } from '@/lib/types'

export type Filter = 'ALL' | Status

const ORDER: Filter[] = ['ALL', 'MISSING', 'OUTDATED', 'UPLOADED']

export function FilterBar({ accounts, value, onChange }: { accounts: Account[]; value: Filter; onChange: (f: Filter) => void }) {
  const count = (f: Filter) => (f === 'ALL' ? accounts.length : accounts.filter(a => a.status === f).length)

  return (
    <div role="group" aria-label="Filter providers by status" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {ORDER.map(f => {
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
            {f === 'ALL' ? 'All' : STATUS_LABEL[f]}
            <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-primary/20' : 'bg-muted')}>{count(f)}</span>
          </button>
        )
      })}
    </div>
  )
}
