import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Plus, RotateCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Wordmark } from '@/components/Wordmark'
import { ReadinessHero } from '@/components/ReadinessHero'
import { FilterBar, matchesFilter, type Filter } from '@/components/FilterBar'
import { CategoryZone, categoryOfZone } from '@/components/CategoryZone'
import { DragPreview, DraggableAccount } from '@/components/DraggableAccount'
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { AddProvidersDialog } from '@/components/AddProvidersDialog'
import { UploadDialog } from '@/components/UploadDialog'
import { RemoveDialog } from '@/components/RemoveDialog'
import { SubmitBar } from '@/components/SubmitBar'
import { StatementViewDialog } from '@/components/StatementViewDialog'
import {
  useAccounts, useAddAccounts, useAvailableProviders, useRemoveAccount, useSetCategory, useSetStatement, useSubmit,
} from '@/hooks/useOnboarding'
import { ApiError } from '@/lib/api'
import { CLIENT_FIRST_NAME } from '@/lib/client'
import { CATEGORIES, plural, STATUS_LABEL } from '@/lib/format'
import { matchScore } from '@/lib/search'
import type { Account, Choice } from '@/lib/types'

function submitFailureTitle(e: unknown) {
  if (!(e instanceof ApiError) || e.status !== 422) return messageOf(e)
  if (e.issues.length === 0) return e.message
  const missing = e.issues.filter(i => i.status === 'MISSING').length
  const outdated = e.issues.filter(i => i.status === 'OUTDATED').length
  const parts = [
    missing && `${missing} ${missing === 1 ? 'statement is' : 'statements are'} missing`,
    outdated && `${outdated} ${outdated === 1 ? 'is' : 'are'} more than 3 months old`,
  ].filter(Boolean)
  return `Can't submit yet: ${parts.join(' and ')}. Add or replace ${e.issues.length === 1 ? 'it' : 'them'} to continue.`
}

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')

export default function App() {
  const accounts = useAccounts()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState<Account | null>(null)
  const [removing, setRemoving] = useState<Account | null>(null)
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const providers = useAvailableProviders(adding)
  const add = useAddAccounts()
  const setCategory = useSetCategory()
  const remove = useRemoveAccount()
  const statement = useSetStatement()
  const submit = useSubmit()

  const changed = () => {
    setSubmitted(false)
    setSubmitError(null)
  }

  const data = accounts.data
  const list = data?.accounts ?? []
  const visible = list
    .filter(a => matchesFilter(a, filter))
    .map(a => ({
      a,
      score: matchScore(query, [a.provider.name, a.category, a.statement?.filename ?? '', STATUS_LABEL[a.status]]),
    }))
    .filter(x => x.score > 0)
    .sort((x, y) => (query.trim() ? y.score - x.score : 0))
    .map(x => x.a)
  const dragging = draggingId !== null
  const draggedAccount = list.find(a => a.id === draggingId) ?? null
  const grouped = [
    ...CATEGORIES.map(c => ({
      key: c.toLowerCase().replace(/\s+/g, '-'),
      title: c,
      category: c as string | null,
      note: '',
      items: visible.filter(a => !a.manual && a.category === c),
    })),
    {
      key: 'added-by-you',
      title: 'Added by you',
      category: null as string | null,
      note: 'Providers you typed in yourself. Each keeps the category you chose.',
      items: visible.filter(a => a.manual),
    },
  ].filter(g => g.items.length > 0 || (dragging && g.category !== null))
  const emptyMessage = query.trim()
    ? `No providers match “${query.trim()}”.`
    : filter === 'ATTENTION'
      ? 'Nothing needs attention. Every statement is current.'
      : filter === 'ALL'
        ? ''
        : `Nothing is ${STATUS_LABEL[filter].toLowerCase()} right now.`
  const flagged = new Set(submitError?.issues.map(i => i.accountId))

  const showAttention = () => {
    setFilter('ATTENTION')
    setQuery('')
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      document.getElementById('providers-title')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const jumpTo = (a: Account) => {
    setFilter('ALL')
    setQuery('')
    setHighlightId(a.id)
    window.setTimeout(() => setHighlightId(null), 1800)
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      document.getElementById(`account-card-${a.id}`)?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      })
      if (a.status !== 'UPLOADED') setUploading(a)
    })
  }

  const changeCategory = (a: Account, category: string) => {
    if (category === a.category) return
    setCategory.mutate({ id: a.id, category }, {
      onSuccess: () => toast.success(a.manual ? `${a.provider.name} set to ${category}` : `${a.provider.name} moved to ${category}`),
      onError: e => toast.error(messageOf(e)),
    })
  }

  const showAccount = (a: Account) => {
    setFilter('ALL')
    setQuery('')
    setHighlightId(a.id)
    window.setTimeout(() => setHighlightId(null), 1800)
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      document.getElementById(`account-card-${a.id}`)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })
    })
  }

  const doAdd = (ids: number[], names: string[], choices: Choice[]) =>
    add.mutate({ ids, names, choices }, {
      onSuccess: () => {
        changed()
        setAdding(false)
        toast.success(`${plural(ids.length + names.length, 'provider')} added`)
      },
    })

  const doUpload = (id: number, file: File, date: string) =>
    statement.mutate({ id, file, statementDate: date }, {
      onSuccess: saved => {
        changed()
        setUploading(null)
        if (saved.status === 'OUTDATED') {
          toast.warning(`Saved, but it's more than 3 months old. ${saved.provider.name} still needs a newer statement.`)
        } else {
          toast.success(`Statement saved for ${saved.provider.name}`)
        }
      },
    })

  const doRemove = (a: Account) =>
    remove.mutate(a.id, {
      onSuccess: () => {
        changed()
        setRemoving(null)
        toast.success(`${a.provider.name} removed`)
      },
      onError: e => {
        if (e instanceof ApiError && e.status === 404) {
          setRemoving(null)
          toast.info(`${a.provider.name} was already removed`)
        }
      },
    })

  const doSubmit = () => {
    setSubmitError(null)
    submit.mutate(undefined, {
      onSuccess: () => {
        setSubmitted(true)
        toast.success('Submitted - thank you')
      },
      onError: e => {
        setSubmitError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', messageOf(e)))
        toast.error(submitFailureTitle(e))
      },
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 pb-24 sm:px-6">
      <header className="flex items-center justify-between py-6">
        <Wordmark />
        <p className="hidden text-sm text-muted-foreground sm:block">Your finances, one step closer.</p>
      </header>

      <main className="grid gap-8">
        <div className="rise">
          <p className="text-lg font-medium text-primary" data-testid="welcome">Welcome, {CLIENT_FIRST_NAME}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">Connect your accounts</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            You are one step closer to having your wealth looked after with the care it deserves. Share a recent statement from each of your providers, and your adviser can begin shaping a plan around you.
          </p>
        </div>

        {accounts.isPending && <LoadingState />}

        {accounts.isError && !data && (
          <div role="alert" className="grid justify-items-start gap-4 rounded-2xl border border-bad/40 bg-bad/8 p-6">
            <p className="flex items-center gap-2 font-medium text-bad">
              <AlertCircle className="size-5" aria-hidden />
              {messageOf(accounts.error)}
            </p>
            <Button variant="outline" size="lg" onClick={() => accounts.refetch()} disabled={accounts.isFetching}>
              <RotateCw className={accounts.isFetching ? 'animate-spin' : ''} data-icon="inline-start" aria-hidden />
              Try again
            </Button>
          </div>
        )}

        {data && (
          <>
            <ReadinessHero accounts={list} readiness={data.readiness} submitted={submitted} onSelect={jumpTo} />

            <section aria-labelledby="providers-title" className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="providers-title" className="text-lg font-semibold">Your financial providers</h2>
                <Button size="lg" onClick={() => setAdding(true)} className="h-10 px-4 text-sm font-semibold shadow-[0_0_0_4px_rgb(101_217_176/0.12)]">
                  <Plus data-icon="inline-start" aria-hidden />
                  Add provider
                </Button>
              </div>

              {list.length > 0 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    type="search"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search your providers"
                    aria-label="Search your providers"
                    className="h-11 pr-10 pl-9 text-base [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Clear the search box"
                      className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </div>
              )}

              {list.length > 0 && <FilterBar accounts={list} value={filter} onChange={setFilter} />}

              {accounts.isError && (
                <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
                  {messageOf(accounts.error)} Showing the last information we have.
                </p>
              )}

              {list.length === 0 ? (
                <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-input p-10 text-center">
                  <p className="font-medium">No providers yet</p>
                  <p className="max-w-sm text-sm text-muted-foreground">Add your banks, pensions and investment platforms to see what we need from each.</p>
                  <Button size="lg" onClick={() => setAdding(true)}>
                    <Plus data-icon="inline-start" aria-hidden />
                    Add provider
                  </Button>
                </div>
              ) : visible.length === 0 ? (
                <div className="grid justify-items-center gap-3 rounded-2xl border border-dashed border-input p-8 text-center">
                  <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                  <Button variant="ghost" onClick={() => { setFilter('ALL'); setQuery('') }}>
                    {query.trim() ? 'Clear search' : 'Show all providers'}
                  </Button>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  onDragStart={e => setDraggingId(Number(e.active.id))}
                  onDragCancel={() => setDraggingId(null)}
                  onDragEnd={e => {
                    setDraggingId(null)
                    const target = categoryOfZone(e.over?.id)
                    const account = list.find(a => a.id === Number(e.active.id))
                    if (target && account) changeCategory(account, target)
                  }}
                >
                  <div className="grid gap-7">
                    {grouped.map(g => (
                      <CategoryZone
                        key={g.key}
                        category={g.category ?? ''}
                        testId={`group-${g.key}`}
                        labelledBy={`group-${g.key}`}
                        droppable={g.category !== null}
                      >
                        <div>
                          <h3 id={`group-${g.key}`} className="flex items-baseline gap-2 text-sm font-semibold tracking-wide">
                            {g.title}
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground tabular-nums">
                              {g.items.length}
                            </span>
                          </h3>
                          {g.note && <p className="mt-0.5 text-xs text-muted-foreground">{g.note}</p>}
                        </div>
                        {g.items.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-primary/40 px-4 py-5 text-center text-sm text-muted-foreground">
                            Drop here to move {draggedAccount?.provider.name} to {g.title}
                          </p>
                        ) : (
                          <ul className="grid gap-3" aria-label={g.title}>
                            {g.items.map(a => (
                              <DraggableAccount
                                key={a.id}
                                account={a}
                                flagged={flagged.has(a.id)}
                                highlighted={highlightId === a.id}
                                onUpload={setUploading}
                                onView={x => setViewingId(x.id)}
                                onCategory={changeCategory}
                                onRemove={setRemoving}
                              />
                            ))}
                          </ul>
                        )}
                      </CategoryZone>
                    ))}
                  </div>
                  <DragOverlay>{draggedAccount ? <DragPreview account={draggedAccount} /> : null}</DragOverlay>
                </DndContext>
              )}

              {list.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 text-sm font-medium text-primary transition-colors duration-200 outline-none hover:border-primary hover:bg-primary/8 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Plus className="size-4" aria-hidden />
                  Add another provider
                </button>
              )}
            </section>

            <SubmitBar readiness={data.readiness} pending={submit.isPending} submitted={submitted} error={submitError} onSubmit={doSubmit} onShowAttention={showAttention} />
          </>
        )}
      </main>

      <AddProvidersDialog
        open={adding}
        providers={providers.data}
        loading={providers.isPending}
        loadError={providers.isError ? messageOf(providers.error) : null}
        onRetry={() => providers.refetch()}
        pending={add.isPending}
        error={add.isError ? messageOf(add.error) : null}
        onClose={() => { setAdding(false); add.reset() }}
        onAdd={doAdd}
        existing={list}
        onShow={a => {
          setAdding(false)
          add.reset()
          showAccount(a)
        }}
      />
      <StatementViewDialog
        account={list.find(a => a.id === viewingId) ?? null}
        onClose={() => setViewingId(null)}
        onReplace={a => {
          setViewingId(null)
          setUploading(a)
        }}
      />
      <UploadDialog
        account={uploading}
        pending={statement.isPending}
        error={statement.isError ? messageOf(statement.error) : null}
        onClose={() => { setUploading(null); statement.reset() }}
        onSave={doUpload}
      />
      <RemoveDialog
        account={removing}
        pending={remove.isPending}
        error={remove.isError && !(remove.error instanceof ApiError && remove.error.status === 404) ? messageOf(remove.error) : null}
        onClose={() => { setRemoving(null); remove.reset() }}
        onConfirm={doRemove}
      />
    </div>
  )
}

function LoadingState() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 4000)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading your providers">
      {slow && (
        <p role="status" data-testid="waking-up" className="rounded-xl border border-primary/30 bg-primary/8 px-4 py-3 text-sm">
          <span className="font-medium">Waking up the demo backend.</span>{' '}
          <span className="text-muted-foreground">
            It runs on free hosting that sleeps when it has not been used for a while, so the first load can take up to a minute. Please keep this page open.
          </span>
        </p>
      )}
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-9 w-72 rounded-full" />
      {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  )
}
