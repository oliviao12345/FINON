import { cn } from '@/lib/utils'
import { CATEGORIES } from '@/lib/format'

export function CategorySelect({ label, value, suggested, onChange, compact = false }: {
  label: string
  value: string
  suggested?: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn(
        'rounded-lg border border-input bg-background text-foreground outline-none transition-colors hover:border-primary/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [color-scheme:dark]',
        compact ? 'h-7 px-2 text-xs' : 'h-9 w-full min-w-0 px-2.5 text-sm',
        !value && 'text-muted-foreground',
      )}
    >
      {!value && <option value="" disabled>Choose a category…</option>}
      {CATEGORIES.map(c => (
        <option key={c} value={c}>
          {c}
          {suggested === c ? ' (suggested)' : ''}
        </option>
      ))}
    </select>
  )
}
