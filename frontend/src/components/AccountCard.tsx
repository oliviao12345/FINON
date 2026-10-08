import { FileText, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/format'
import type { Account } from '@/lib/types'

interface Props {
  account: Account
  flagged: boolean
  onUpload: (a: Account) => void
  onRemove: (a: Account) => void
}

export function AccountCard({ account, flagged, onUpload, onRemove }: Props) {
  const { provider, statement, status } = account
  const name = provider.name

  return (
    <li
      data-testid={`account-${name}`}
      className={cn(
        'rise group flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-[border-color,transform,background-color] duration-200 hover:bg-card/80 sm:flex-row sm:items-center sm:gap-5 sm:p-5',
        flagged ? 'border-bad/50' : 'border-border hover:border-primary/25',
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
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
              <span>{provider.category} · no statement yet</span>
            )}
          </p>
          {status === 'OUTDATED' && (
            <p className="mt-1 text-xs text-warn">More than 3 months old - please replace it.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Button
          variant={status === 'UPLOADED' ? 'outline' : 'default'}
          size="lg"
          onClick={() => onUpload(account)}
          aria-label={`${status === 'MISSING' ? 'Upload' : 'Replace'} statement for ${name}`}
        >
          <Upload data-icon="inline-start" aria-hidden />
          {status === 'MISSING' ? 'Upload' : 'Replace'}
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
