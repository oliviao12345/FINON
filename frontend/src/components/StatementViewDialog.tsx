import { useState } from 'react'
import { Download, ExternalLink, FileText, Info } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge } from '@/components/StatusBadge'
import { WordPreview } from '@/components/WordPreview'
import { ageLabel, currentUntil, parseIso, toIso } from '@/lib/dates'
import { fileKind, formatDate, mimeLabel, todayIso } from '@/lib/format'
import { statementFileUrl } from '@/lib/api'
import type { Account } from '@/lib/types'

interface Props {
  account: Account | null
  onClose: () => void
  onReplace: (a: Account) => void
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground" data-testid="view-preview-failed">
        This file can't be previewed here. Use Open file or Download to see it.
      </p>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="max-h-[28rem] w-full rounded-xl border border-border bg-background object-contain"
    />
  )
}

export function StatementViewDialog({ account, onClose, onReplace }: Props) {
  return (
    <Dialog open={account !== null && account.statement !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">{account?.statement && <Body account={account} onReplace={onReplace} />}</DialogContent>
    </Dialog>
  )
}

function Body({ account, onReplace }: { account: Account; onReplace: (a: Account) => void }) {
  const statement = account.statement!
  const today = todayIso()
  const until = currentUntil(statement.statementDate)
  const dayAfter = toIso(new Date(parseIso(until).getFullYear(), parseIso(until).getMonth(), parseIso(until).getDate() + 1))
  const kind = mimeLabel(statement.contentType) ?? fileKind(statement.filename)
  const isImage = kind.endsWith('image')
  const isPdf = kind === 'PDF document'
  const isDocx = (statement.contentType ?? '').includes('wordprocessingml')
  const url = statementFileUrl(account.id, statement.storedAt)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-lg">Statement on file - {account.provider.name}</DialogTitle>
        <DialogDescription>Here is what we have recorded for this provider.</DialogDescription>
      </DialogHeader>

      <dl className="grid gap-3 rounded-xl border border-border p-4 text-sm">
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground">File</dt>
          <dd className="flex min-w-0 items-center gap-2 text-right font-medium">
            <FileText className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate" data-testid="view-filename">{statement.filename}</span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Type</dt>
          <dd>{kind}</dd>
        </div>
        {statement.hasFile && (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Your file</dt>
            <dd className="flex flex-wrap items-center justify-end gap-2">
              {(isImage || isPdf) && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ size: 'sm' }), 'gap-1.5')}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open file
                </a>
              )}
              <a
                href={url}
                download={statement.filename}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'gap-1.5')}
              >
                <Download className="size-3.5" aria-hidden />
                Download
              </a>
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Statement date</dt>
          <dd className="text-right">
            {formatDate(statement.statementDate)}
            <span className="block text-xs text-muted-foreground">{ageLabel(statement.statementDate, today)}</span>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Status</dt>
          <dd><StatusBadge status={account.status} /></dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{account.status === 'OUTDATED' ? 'Expired on' : 'Valid until'}</dt>
          <dd data-testid="view-until">{formatDate(account.status === 'OUTDATED' ? dayAfter : until)}</dd>
        </div>
      </dl>

      {statement.hasFile ? (
        <div className="grid gap-3" data-testid="view-preview">
          {isImage && <ImagePreview src={url} alt={`Your uploaded statement: ${statement.filename}`} />}
          {isPdf && (
            <iframe
              src={url}
              title={`Your uploaded statement: ${statement.filename}`}
              className="h-[28rem] w-full rounded-xl border border-border bg-background"
            />
          )}
          {isDocx && <WordPreview url={url} name={statement.filename} />}
          {!isImage && !isPdf && !isDocx && (
            <p className="text-xs text-muted-foreground">
              Older Word (.doc) files can't be previewed here. Download it to open it.
            </p>
          )}
        </div>
      ) : (
        <p className="flex gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground" data-testid="view-no-preview">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          No file is stored for this statement, only its name and date. Use Replace statement to add the file.
        </p>
      )}

      <DialogFooter>
        <DialogClose render={<Button variant="outline" size="lg" />}>Close</DialogClose>
        <Button size="lg" onClick={() => onReplace(account)}>Replace statement</Button>
      </DialogFooter>
    </>
  )
}
