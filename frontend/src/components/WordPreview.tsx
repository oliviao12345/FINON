import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

type State = 'loading' | 'ready' | 'failed'

export function WordPreview({ blob, name }: { blob: Blob; name: string }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    ;(async () => {
      try {
        const [{ renderAsync }, data] = await Promise.all([import('docx-preview'), blob.arrayBuffer()])
        if (cancelled || !host.current) return
        host.current.innerHTML = ''
        await renderAsync(data, host.current, undefined, {
          inWrapper: true,
          ignoreWidth: true,
          ignoreHeight: true,
          breakPages: false,
          useBase64URL: true,
        })
        if (!cancelled) setState('ready')
      } catch {
        if (!cancelled) setState('failed')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [blob])

  return (
    <div className="grid gap-2" data-testid="word-preview" data-state={state}>
      {state === 'loading' && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Preparing preview…
        </p>
      )}
      {state === 'failed' && (
        <p role="alert" className="rounded-lg bg-muted/60 px-3 py-2.5 text-xs text-muted-foreground">
          We couldn't draw a preview of this document. Use Open file or Download to see {name}.
        </p>
      )}
      <div
        ref={host}
        aria-label={`Preview of ${name}`}
        className="max-h-[28rem] overflow-auto rounded-xl border border-border bg-white text-black [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper]:p-2 [&_section.docx]:mx-auto [&_section.docx]:shadow-none"
        hidden={state !== 'ready'}
      />
    </div>
  )
}
