import { useMemo, useState } from 'react'
import { Check, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { plural } from '@/lib/format'
import type { Provider } from '@/lib/types'

interface Props {
  open: boolean
  providers: Provider[] | undefined
  loading: boolean
  loadError: string | null
  onRetry: () => void
  pending: boolean
  error: string | null
  onClose: () => void
  onAdd: (ids: number[]) => void
}

const CATEGORY_ORDER = ['Bank', 'Investments', 'Pension']
const rank = (c: string) => (CATEGORY_ORDER.includes(c) ? CATEGORY_ORDER.indexOf(c) : CATEGORY_ORDER.length)

export function AddProvidersDialog(props: Props) {
  const { open, onClose, pending } = props
  return (
    <Dialog open={open} onOpenChange={o => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">{open && <Body {...props} />}</DialogContent>
    </Dialog>
  )
}

function Body({ providers, loading, loadError, onRetry, pending, error, onAdd }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = (providers ?? []).filter(p => !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    const map = new Map<string, Provider[]>()
    filtered.forEach(p => map.set(p.category, [...(map.get(p.category) ?? []), p]))
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
  }, [providers, query])

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const none = !loading && !loadError && (providers?.length ?? 0) === 0

  return (
    <form
      className="grid gap-4"
      onSubmit={e => {
        e.preventDefault()
        if (selected.size && !pending) onAdd([...selected])
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">Add providers</DialogTitle>
        <DialogDescription>Search and tick everyone you hold money with. You can pick several at once.</DialogDescription>
      </DialogHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          placeholder="Search providers"
          aria-label="Search providers"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-10 pl-9"
          autoFocus
        />
      </div>

      <div className="max-h-[min(22rem,50dvh)] overflow-y-auto rounded-xl border border-border" aria-busy={loading}>
        {loading && (
          <div className="grid gap-2 p-3">
            {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-11 w-full" />)}
          </div>
        )}
        {loadError && (
          <div role="alert" className="grid justify-items-start gap-3 p-4 text-sm">
            <p className="text-bad">{loadError}</p>
            <Button type="button" variant="outline" onClick={onRetry}>Try again</Button>
          </div>
        )}
        {none && <p className="p-4 text-sm text-muted-foreground">Every provider in our catalogue is already on your list.</p>}
        {!loading && !loadError && !none && groups.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No providers match “{query}”.</p>
        )}
        {groups.map(([category, items]) => (
          <fieldset key={category} className="border-b border-border last:border-0">
            <legend className="sticky top-0 w-full bg-popover px-4 py-2 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              {category}
            </legend>
            {items.map(p => {
              const on = selected.has(p.id)
              return (
                <label
                  key={p.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 px-4 py-3 text-sm transition-colors duration-150 hover:bg-muted has-focus-visible:bg-muted',
                    on && 'bg-primary/8',
                  )}
                >
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(p.id)} />
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                    )}
                  >
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="font-medium">{p.name}</span>
                </label>
              )
            })}
          </fieldset>
        ))}
      </div>

      {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      <DialogFooter>
        <Button type="submit" size="lg" disabled={selected.size === 0 || pending} className="min-w-36">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? 'Adding…' : selected.size ? `Add ${plural(selected.size, 'provider')}` : 'Add providers'}
        </Button>
      </DialogFooter>
    </form>
  )
}
