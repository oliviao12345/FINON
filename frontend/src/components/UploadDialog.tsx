import { useRef, useState } from 'react'
import { FileUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FILE_ACCEPT, FILE_TYPE_MESSAGE, isAllowedFile, todayIso } from '@/lib/format'
import type { Account } from '@/lib/types'

interface Props {
  account: Account | null
  pending: boolean
  error: string | null
  onClose: () => void
  onSave: (id: number, filename: string, date: string) => void
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
  const [fileError, setFileError] = useState<string | null>(null)
  const [date, setDate] = useState(todayIso())
  const fileRef = useRef<HTMLInputElement>(null)
  const replacing = account.statement !== null
  const max = todayIso()
  const valid = filename.trim() !== '' && date !== '' && date <= max

  return (
    <form
      className="grid gap-5"
      onSubmit={e => {
        e.preventDefault()
        if (valid && !pending) onSave(account.id, filename.trim(), date)
      }}
    >
      <DialogHeader>
        <DialogTitle className="text-lg">
          {replacing ? 'Replace' : 'Upload'} statement - {account.provider.name}
        </DialogTitle>
        <DialogDescription>
          Choose the statement file and the date printed on it. Only the file name and date are recorded.
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
            const name = e.target.files?.[0]?.name ?? ''
            const ok = name === '' || isAllowedFile(name)
            setFilename(ok ? name : '')
            setFileError(ok ? null : FILE_TYPE_MESSAGE)
          }}
          aria-describedby="statement-file-help"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-14 items-center gap-3 rounded-xl border border-dashed border-input px-4 text-left text-sm transition-colors outline-none hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <FileUp className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{filename || 'Choose a file…'}</span>
        </button>
        <p id="statement-file-help" className={fileError ? 'text-xs text-bad' : 'text-xs text-muted-foreground'} role={fileError ? 'alert' : undefined}>
          {fileError ?? 'PDF, Word (.doc, .docx), JPG or PNG.'}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="statement-date" className="text-sm font-medium">Statement date</label>
        <Input
          id="statement-date"
          type="date"
          value={date}
          max={max}
          onChange={e => setDate(e.target.value)}
          className="h-10 [color-scheme:dark]"
        />
        <p className="text-xs text-muted-foreground">Statements dated more than 3 months ago are marked Outdated.</p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>
      )}

      <DialogFooter>
        <Button type="submit" size="lg" disabled={!valid || pending} className="min-w-28">
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {pending ? 'Saving…' : 'Save statement'}
        </Button>
      </DialogFooter>
    </form>
  )
}
