import { ArrowRight, CheckCircle2, Loader2, TriangleAlert } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { STATUS_LABEL } from '@/lib/format'
import type { ApiError } from '@/lib/api'
import type { Readiness } from '@/lib/types'

interface Props {
  readiness: Readiness
  pending: boolean
  submitted: boolean
  error: ApiError | null
  onSubmit: () => void
}

export function SubmitBar({ readiness, pending, submitted, error, onSubmit }: Props) {
  const { canSubmit, total, ready } = readiness
  const hint = submitted
    ? 'Submitted. Nothing more to do right now.'
    : total === 0
      ? 'Add at least one provider to continue.'
      : canSubmit
        ? 'Everything is in order.'
        : `${ready} of ${total} ready - finish the rest to submit.`

  return (
    <section aria-label="Submit" className="rise grid gap-3">
      {error && (
        <div role="alert" className="rounded-2xl border border-bad/40 bg-bad/8 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium text-bad">
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {error.message}
          </p>
          {error.issues.length > 0 && (
            <ul className="mt-2 grid gap-1 pl-6 text-muted-foreground">
              {error.issues.map(i => (
                <li key={i.accountId} className="list-disc">
                  <span className="text-foreground">{i.provider}</span> - {STATUS_LABEL[i.status].toLowerCase()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className={cn('flex items-center gap-2 text-sm', canSubmit || submitted ? 'text-foreground' : 'text-muted-foreground')}>
          {(canSubmit || submitted) && <CheckCircle2 className="size-4 text-ok" aria-hidden />}
          {hint}
        </p>
        <button
          type="button"
          aria-disabled={!canSubmit || submitted || pending}
          onClick={() => {
            if (submitted || pending) return
            onSubmit()
          }}
          className={cn(
            buttonVariants({ size: 'lg' }),
            'h-11 px-6 text-base sm:min-w-44',
            (!canSubmit || submitted) && 'cursor-not-allowed bg-muted text-muted-foreground hover:bg-muted',
          )}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? 'Submitting…' : submitted ? 'Submitted' : 'Submit'}
          {!pending && !submitted && <ArrowRight data-icon="inline-end" aria-hidden />}
        </button>
      </div>
    </section>
  )
}
