import { useMemo, useState } from 'react'
import { Check, Loader2, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CategorySelect } from '@/components/CategorySelect'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CATEGORIES, CUSTOM_NAME_PATTERN, cleanCustomName, plural } from '@/lib/format'
import { matchScore, nameKey } from '@/lib/search'
import { StatusBadge } from '@/components/StatusBadge'
import type { Account, CatalogueProvider, Choice } from '@/lib/types'

interface Props {
  open: boolean
  providers: CatalogueProvider[] | undefined
  loading: boolean
  loadError: string | null
  onRetry: () => void
  pending: boolean
  error: string | null
  onClose: () => void
  onAdd: (ids: number[], customNames: string[], choices: Choice[]) => void
  existing: Account[]
  onShow: (account: Account) => void
}

const rank = (c: string) => {
  const i = (CATEGORIES as readonly string[]).indexOf(c)
  return i < 0 ? CATEGORIES.length : i
}

function ConfirmRemove({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      role="group"
      aria-label={`Confirm removing ${name}`}
      className="col-span-2 flex items-center justify-end gap-2 rounded-lg bg-bad/10 px-2 py-1 text-xs"
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
    >
      <span className="mr-auto text-foreground">Remove {name}?</span>
      <button
        type="button"
        onClick={onCancel}
        autoFocus
        className="rounded-md border border-input px-2 py-1 font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Keep
      </button>
      <button
        type="button"
        onClick={onConfirm}
        aria-label={`Yes, remove ${name}`}
        className="rounded-md bg-bad px-2 py-1 font-medium text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Remove
      </button>
    </div>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Remove"
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-bad/15 hover:text-bad focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <X className="size-4" aria-hidden />
    </button>
  )
}

export function AddProvidersDialog(props: Props) {
  const { open, onClose, pending } = props
  return (
    <Dialog open={open} onOpenChange={o => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">{open && <Body {...props} />}</DialogContent>
    </Dialog>
  )
}

function Body({ providers, loading, loadError, onRetry, pending, error, onAdd, existing, onShow }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [customNames, setCustomNames] = useState<string[]>([])
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [otherError, setOtherError] = useState<string | null>(null)
  const [otherNote, setOtherNote] = useState<string | null>(null)
  const [selQuery, setSelQuery] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [categoryById, setCategoryById] = useState<Record<number, string>>({})
  const [categoryByName, setCategoryByName] = useState<Record<string, string>>({})
  const [otherDuplicate, setOtherDuplicate] = useState<Account | null>(null)

  const groups = useMemo(() => {
    const scored = (providers ?? [])
      .map(p => ({ p, score: matchScore(query, [p.name, p.category]) }))
      .filter(x => x.score > 0)
    if (query.trim()) scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name))
    const map = new Map<string, CatalogueProvider[]>()
    scored.forEach(({ p }) => map.set(p.category, [...(map.get(p.category) ?? []), p]))
    return [...map.entries()].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
  }, [providers, query])

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const total = selected.size + customNames.length
  const chosen = (providers ?? []).filter(p => selected.has(p.id))
  const suggestionFor = (p: CatalogueProvider) =>
    (CATEGORIES as readonly string[]).includes(p.category) ? p.category : 'Other'
  const categoryOf = (p: CatalogueProvider) => categoryById[p.id] ?? suggestionFor(p)
  const categoryOfName = (n: string) => categoryByName[nameKey(n)] ?? 'Other'
  const shownChosen = chosen.filter(p => matchScore(selQuery, [p.name, categoryOf(p)]) > 0)
  const shownCustom = customNames.filter(n => matchScore(selQuery, [n, categoryOfName(n)]) > 0)
  const removeChosen = (id: number) => {
    setConfirming(null)
    setSelected(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
  const removeCustom = (name: string) => {
    setConfirming(null)
    setCustomNames(prev => prev.filter(n => n !== name))
  }
  const submit = () => {
    const choices: Choice[] = [
      ...chosen.map(p => ({ providerId: p.id, category: categoryOf(p) })),
      ...customNames.map(n => ({ name: n, category: categoryOfName(n) })),
    ]
    onAdd([...selected], customNames, choices)
  }

  const addCustom = (raw: string) => {
    const name = cleanCustomName(raw)
    if (!CUSTOM_NAME_PATTERN.test(name)) {
      setOtherError('Use 2 to 80 characters: letters, numbers and basic punctuation.')
      return
    }
    const key = nameKey(name)
    if (!key) {
      setOtherError('Use 2 to 80 characters: letters, numbers and basic punctuation.')
      return
    }
    const already = existing.find(a => nameKey(a.provider.name) === key)
    if (already) {
      setOtherError(`${already.provider.name} is already on your list.`)
      setOtherDuplicate(already)
      return
    }
    if (customNames.some(n => nameKey(n) === key)) {
      setOtherError(`${name} is already in your selection.`)
      return
    }
    const listed = (providers ?? []).find(p => nameKey(p.name) === key)
    if (listed) {
      setSelected(prev => new Set(prev).add(listed.id))
      setOtherNote(`${listed.name} is in our list, so we've ticked it for you.`)
      setOtherText('')
      setOtherError(null)
      setOtherDuplicate(null)
      setOtherOpen(false)
      return
    }
    setCustomNames(prev => [...prev, name])
    setOtherText('')
    setOtherError(null)
    setOtherDuplicate(null)
    setOtherNote(null)
    setOtherOpen(false)
  }

  const alreadyOnList = useMemo(
    () => (query.trim() ? existing.filter(a => matchScore(query, [a.provider.name, a.provider.category]) > 0) : []),
    [existing, query],
  )
  const exactExists =
    nameKey(query) !== '' &&
    (existing.some(a => nameKey(a.provider.name) === nameKey(query)) ||
      (providers ?? []).some(p => nameKey(p.name) === nameKey(query)))
  const none = !loading && !loadError && (providers?.length ?? 0) === 0 && alreadyOnList.length === 0

  return (
    <form
      className="grid gap-4"
      onSubmit={e => {
        e.preventDefault()
        if (total && !pending) submit()
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
          placeholder="Search providers, e.g. “lloyds” or “hl”"
          aria-label="Search providers"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="h-10 pl-9"
          autoFocus
        />
      </div>

      <div className="relative max-h-[min(22rem,50dvh)] overflow-y-auto rounded-xl border border-border" aria-busy={loading}>
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
        {!loading && !loadError && !none && groups.length === 0 && alreadyOnList.length === 0 && (
          <div className="grid justify-items-start gap-2 p-4 text-sm text-muted-foreground">
            <p>No providers match “{query}”.</p>
            {!exactExists && (
              <Button type="button" variant="outline" onClick={() => { setOtherOpen(true); setOtherText(query); setOtherError(null) }}>
                <Plus data-icon="inline-start" aria-hidden />
                Add “{query.trim()}” as another provider
              </Button>
            )}
          </div>
        )}
        {!loading && !loadError && groups.length === 0 && alreadyOnList.length > 0 && (
          <p className="p-4 pb-0 text-sm text-foreground" data-testid="already-added-summary">
            {alreadyOnList.map(a => a.provider.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}{' '}
            {alreadyOnList.length === 1 ? 'is' : 'are'} already on your list.
          </p>
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
        {!loading && !loadError && alreadyOnList.length > 0 && (
          <section aria-label="Already on your list" className="border-t border-border first:border-0">
            <h3 className="sticky top-0 w-full bg-popover px-4 py-2 text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Already on your list
            </h3>
            <ul>
              {alreadyOnList.map(a => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">{a.provider.name}</span>
                    <StatusBadge status={a.status} />
                  </span>
                  <Button type="button" variant="outline" size="sm" onClick={() => onShow(a)}>
                    Go to {a.provider.name}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {otherNote && <p className="text-xs text-primary" role="status">{otherNote}</p>}

      <div className="grid gap-2">
        {!otherOpen ? (
          <button
            type="button"
            onClick={() => setOtherOpen(true)}
            className="flex w-fit items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-4" aria-hidden />
            Other - can't find it? Type the provider or institution
          </button>
        ) : (
          <div className="grid gap-2 rounded-xl border border-border p-3">
            <label htmlFor="other-provider" className="text-sm font-medium">Provider or institution name</label>
            <div className="flex gap-2">
              <Input
                id="other-provider"
                value={otherText}
                maxLength={80}
                placeholder="e.g. Smith Family Trust"
                onChange={e => { setOtherText(e.target.value); setOtherError(null); setOtherDuplicate(null) }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(otherText) } }}
                aria-invalid={otherError ? true : undefined}
                aria-describedby={otherError ? 'other-provider-error' : undefined}
                autoFocus
                className="h-10"
              />
              <Button type="button" size="lg" className="h-10" onClick={() => addCustom(otherText)}>Add to list</Button>
            </div>
            {otherError && (
              <p id="other-provider-error" role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-bad">
                {otherError}
                {otherDuplicate && (
                  <button
                    type="button"
                    onClick={() => onShow(otherDuplicate)}
                    className="rounded font-medium text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    Go to {otherDuplicate.provider.name}
                  </button>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      {total > 0 && (
        <section aria-label="Your selection" className="grid gap-2 rounded-xl border border-border p-3">
          <div>
            <h3 className="text-sm font-medium">Check the category for each</h3>
            <p className="text-xs text-muted-foreground">We've suggested one for each. Change it if you file it differently - it helps your adviser find things quickly.</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={selQuery}
              onChange={e => setSelQuery(e.target.value)}
              placeholder={`Search your ${total} selected`}
              aria-label="Search your selection"
              className="h-8 pl-8 text-sm [&::-webkit-search-cancel-button]:hidden"
            />
          </div>
          <ul className="grid max-h-64 gap-1 overflow-y-auto pr-1">
            {shownChosen.length + shownCustom.length === 0 && (
              <li className="px-1 py-2 text-sm text-muted-foreground">No selected providers match “{selQuery.trim()}”.</li>
            )}
            {shownChosen.map(p => (
              <li key={p.id} className="grid grid-cols-[minmax(0,1fr)_10rem_1.75rem] items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
                <span className="min-w-0 font-medium leading-snug [overflow-wrap:anywhere]">{p.name}</span>
                {confirming === `id:${p.id}` ? (
                  <ConfirmRemove name={p.name} onConfirm={() => removeChosen(p.id)} onCancel={() => setConfirming(null)} />
                ) : (
                  <>
                    <CategorySelect
                      label={`Category for ${p.name}`}
                      value={categoryOf(p)}
                      suggested={p.category}
                      onChange={v => setCategoryById(prev => ({ ...prev, [p.id]: v }))}
                    />
                    <RemoveButton label={`Remove ${p.name} from selection`} onClick={() => setConfirming(`id:${p.id}`)} />
                  </>
                )}
              </li>
            ))}
            {shownCustom.map(n => (
              <li key={n} className="grid grid-cols-[minmax(0,1fr)_10rem_1.75rem] items-center gap-2 rounded-lg px-1 py-1.5 text-sm">
                <span className="min-w-0 leading-snug">
                  <span className="font-medium [overflow-wrap:anywhere]">{n}</span>
                  <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">Added by you</span>
                </span>
                {confirming === `name:${nameKey(n)}` ? (
                  <ConfirmRemove name={n} onConfirm={() => removeCustom(n)} onCancel={() => setConfirming(null)} />
                ) : (
                  <>
                    <CategorySelect
                      label={`Category for ${n}`}
                      value={categoryOfName(n)}
                      onChange={v => setCategoryByName(prev => ({ ...prev, [nameKey(n)]: v }))}
                    />
                    <RemoveButton label={`Remove ${n} from selection`} onClick={() => setConfirming(`name:${nameKey(n)}`)} />
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}

      <DialogFooter>
        <Button type="submit" size="lg" disabled={total === 0 || pending} className="min-w-36">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? 'Adding…' : total ? `Add ${plural(total, 'provider')}` : 'Add providers'}
        </Button>
      </DialogFooter>
    </form>
  )
}
