import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatementDatePicker } from '@/components/StatementDatePicker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FILE_ACCEPT, FILE_TOO_LARGE_MESSAGE, FILE_TYPE_MESSAGE, MAX_FILE_BYTES, formatDate, isAllowedFile, todayIso } from '@/lib/format'
import type { Account } from '@/lib/types'

interface Props {
  account: Account | null
  pending: boolean
  error: string | null
  onClose: () => void
  onSave: (id: number, file: File, date: string) => void
}

export function UploadDialog({ account, pending, error, onClose, onSave }: Props) {
  return (
    <Dialog open={account !== null} onOpenChange={open => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        {account && <Form key={account.id} {...{ account, pending, error, onSave }} />}
      </DialogContent>
    </Dialog>
  )
}

function Form({ account, pending, error, onSave }: Omit<Props, 'onClose' | 'account'> & { account: Account }) {
  const [filename, setFilename] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const replacing = account.statement !== null
  const max = todayIso()
  const valid = file !== null && filename.trim() !== '' && date !== '' && date <= max

  return (
    <form
      className="grid gap-5"
      onSubmit={e => {
        e.preventDefault()
        if (valid && file && !pending) onSave(account.id, file, date)
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">
          {replacing ? 'Replace' : 'Add'} statement - {account.provider.name}
        </DialogTitle>
        <DialogDescription>
          Choose the statement file and the date printed on it. Your file is kept so you can view it again.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <label htmlFor="statement-file" className="text-sm font-medium">Statement file</label>
        <input
          ref={fileRef}
          id="statement-file"
          type="file"
          accept={FILE_ACCEPT}
          className="sr-only"
          onChange={e => {
            const picked = e.target.files?.[0] ?? null
            const name = picked?.name ?? ''
            const typeOk = name === '' || isAllowedFile(name)
            const sizeOk = !picked || picked.size <= MAX_FILE_BYTES
            const ok = typeOk && sizeOk
            setFilename(ok ? name : '')
            setFile(ok ? picked : null)
            setFileError(!typeOk ? FILE_TYPE_MESSAGE : !sizeOk ? FILE_TOO_LARGE_MESSAGE : null)
          }}
          aria-describedby="statement-file-help"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-14 items-center gap-3 rounded-xl border border-dashed border-input px-4 text-left text-sm transition-colors outline-none hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <FileUp className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="truncate" data-testid="statement-file-name">{filename || 'Choose a file…'}</span>
        </button>
        <p id="statement-file-help" className={fileError ? 'text-xs text-bad' : 'text-xs text-muted-foreground'} role={fileError ? 'alert' : undefined}>
          {fileError ?? 'PDF, Word (.doc, .docx), JPG or PNG, up to 5 MB.'}
        </p>
      </div>

      <div className="grid gap-2">
        <label id="statement-date-label" htmlFor="statement-date" className="text-sm font-medium">Statement date</label>
        <p className="-mt-1 text-xs text-muted-foreground">Select the date shown on your statement.</p>
        <StatementDatePicker value={date} onChange={setDate} today={max} providerName={account.provider.name} />
      </div>

      {valid && !error && (
        <p className="rounded-lg bg-primary/8 px-3 py-2 text-sm text-primary" data-testid="ready-to-save">
          Ready to save: {filename} · dated {formatDate(date)}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">
          <p>{error}</p>
          <p className="mt-0.5 text-xs">Your file and date are still here, so you can try again without re-entering anything.</p>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" size="lg" disabled={!valid || pending} className="min-w-28">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? 'Saving…' : error ? 'Try again' : 'Save statement'}
        </Button>
      </DialogFooter>
    </form>
  )
}
