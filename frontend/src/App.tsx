import { useState } from 'react'
import { toast } from 'sonner'
import { AlertCircle, Plus, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Wordmark } from '@/components/Wordmark'
import { ReadinessHero } from '@/components/ReadinessHero'
import { FilterBar, type Filter } from '@/components/FilterBar'
import { AccountCard } from '@/components/AccountCard'
import { AddProvidersDialog } from '@/components/AddProvidersDialog'
import { UploadDialog } from '@/components/UploadDialog'
import { RemoveDialog } from '@/components/RemoveDialog'
import { SubmitBar } from '@/components/SubmitBar'
import {
  useAccounts, useAddAccounts, useAvailableProviders, useRemoveAccount, useSetStatement, useSubmit,
} from '@/hooks/useOnboarding'
import { ApiError } from '@/lib/api'
import { plural, STATUS_LABEL } from '@/lib/format'
import type { Account } from '@/lib/types'

const messageOf = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')

export default function App() {
  const accounts = useAccounts()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [adding, setAdding] = useState(false)
  const [uploading, setUploading] = useState<Account | null>(null)
  const [removing, setRemoving] = useState<Account | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<ApiError | null>(null)

  const providers = useAvailableProviders(adding)
  const add = useAddAccounts()
  const remove = useRemoveAccount()
  const statement = useSetStatement()
  const submit = useSubmit()

  const changed = () => {
    setSubmitted(false)
    setSubmitError(null)
  }

  const data = accounts.data
  const list = data?.accounts ?? []
  const visible = filter === 'ALL' ? list : list.filter(a => a.status === filter)
  const flagged = new Set(submitError?.issues.map(i => i.accountId))

  const doAdd = (ids: number[]) =>
    add.mutate(ids, {
      onSuccess: () => {
        changed()
        setAdding(false)
        toast.success(`${plural(ids.length, 'provider')} added`)
      },
    })

  const doUpload = (id: number, filename: string, date: string) =>
    statement.mutate({ id, filename, statementDate: date }, {
      onSuccess: () => {
        changed()
        setUploading(null)
        toast.success('Statement saved')
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
        toast.error("We couldn't submit yet")
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
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Connect your accounts</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Before we can advise you, we need a recent statement from every provider you hold money with. Add them below and we'll show you exactly what's left.
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
            <ReadinessHero accounts={list} readiness={data.readiness} submitted={submitted} />

            <section aria-labelledby="providers-title" className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="providers-title" className="text-lg font-semibold">Your providers</h2>
                <Button size="lg" variant="outline" onClick={() => setAdding(true)}>
                  <Plus data-icon="inline-start" aria-hidden />
                  Add provider
                </Button>
              </div>

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
                  <p className="text-sm text-muted-foreground">
                    Nothing is {STATUS_LABEL[filter as Exclude<Filter, 'ALL'>].toLowerCase()} right now.
                  </p>
                  <Button variant="ghost" onClick={() => setFilter('ALL')}>Show all providers</Button>
                </div>
              ) : (
                <ul className="grid gap-3" aria-label="Providers">
                  {visible.map(a => (
                    <AccountCard key={a.id} account={a} flagged={flagged.has(a.id)} onUpload={setUploading} onRemove={setRemoving} />
                  ))}
                </ul>
              )}
            </section>

            <SubmitBar readiness={data.readiness} pending={submit.isPending} submitted={submitted} error={submitError} onSubmit={doSubmit} />
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
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading your providers">
      <Skeleton className="h-52 rounded-3xl" />
      <Skeleton className="h-9 w-72 rounded-full" />
      {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
    </div>
  )
}
