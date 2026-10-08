import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Account } from '@/lib/types'

interface Props {
  account: Account | null
  pending: boolean
  error: string | null
  onClose: () => void
  onConfirm: (a: Account) => void
}

export function RemoveDialog({ account, pending, error, onClose, onConfirm }: Props) {
  return (
    <Dialog open={account !== null} onOpenChange={open => !open && !pending && onClose()}>
      <DialogContent>
        {account && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg">Remove {account.provider.name}?</DialogTitle>
              <DialogDescription>
                It will come off your list{account.statement ? ' and its statement will be discarded' : ''}. You can add it back at any time.
              </DialogDescription>
            </DialogHeader>
            {error && <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" size="lg" disabled={pending} />}>Keep it</DialogClose>
              <Button variant="destructive" size="lg" disabled={pending} onClick={() => onConfirm(account)}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {pending ? 'Removing…' : 'Remove'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
