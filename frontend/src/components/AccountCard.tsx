import type { Ref, ReactNode } from 'react'
import { Eye, FileText, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySelect } from '@/components/CategorySelect'
import { StatementHelp } from '@/components/StatementHelp'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import type { Account } from '@/lib/types'

interface Props {
  account: Account
  flagged: boolean
  highlighted?: boolean
  dragHandle?: ReactNode
  innerRef?: Ref<HTMLLIElement>
  dragging?: boolean
  onUpload: (a: Account) => void
  onView: (a: Account) => void
  onCategory: (a: Account, category: string) => void
  onRemove: (a: Account) => void
}

export function AccountCard({
  account, flagged, highlighted, dragHandle, innerRef, dragging, onUpload, onView, onCategory, onRemove,
}: Props) {
  const { provider, statement, status } = account
  const name = provider.name

  return (
    <li
      ref={innerRef}
      id={`account-card-${account.id}`}
      data-testid={`account-${name}`}
      className={cn(
        'rise group flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-[border-color,transform,background-color] duration-200 hover:bg-card/80 sm:flex-row sm:items-center sm:gap-5 sm:p-5',
        flagged ? 'border-bad/50' : 'border-border hover:border-primary/25',
        highlighted && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
        dragging && 'opacity-40',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {dragHandle}
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-sm font-semibold text-primary"
        >
          {name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="truncate font-medium">{name}</h3>
            <StatusBadge status={status} />
            {account.manual && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">Added by you</span>
            )}
          </div>
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="size-3.5 shrink-0" aria-hidden />
            {statement ? (
              <span className="truncate">
                {statement.filename}
                <span aria-hidden> · </span>
                <span className="sr-only">, dated </span>
                {formatDate(statement.statementDate)}
              </span>
            ) : (
              <span>{account.category} · no statement supplied</span>
            )}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Category</span>
            <CategorySelect
              compact
              label={`Category for ${name}`}
              value={account.category}
              onChange={v => onCategory(account, v)}
            />
          </div>
          {status === 'UPLOADED' && <p className="mt-1 text-xs text-muted-foreground">Statement on file.</p>}
          {status === 'MISSING' && (
            <p className="mt-1 text-xs text-bad">
              Your latest statement is needed. Add a statement dated within the last three months to complete this account.
            </p>
          )}
          {status === 'OUTDATED' && (
            <p className="mt-1 text-xs text-warn">
              This statement needs replacing. It's more than 3 months old, so it no longer counts. Add a newer one.
            </p>
          )}
          {status !== 'UPLOADED' && <StatementHelp provider={provider} />}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        {statement && (
          <Button variant="ghost" size="lg" onClick={() => onView(account)} aria-label={`View statement for ${name}`}>
            <Eye data-icon="inline-start" aria-hidden />
            View
          </Button>
        )}
        <Button
          variant={status === 'UPLOADED' ? 'outline' : 'default'}
          size="lg"
          onClick={() => onUpload(account)}
          aria-label={`${status === 'MISSING' ? 'Add' : 'Replace'} statement for ${name}`}
        >
          <Upload data-icon="inline-start" aria-hidden />
          {status === 'MISSING' ? 'Add statement' : 'Replace'}
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={() => onRemove(account)}
          aria-label={`Remove ${name}`}
          className="text-muted-foreground hover:text-bad"
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  )
}
