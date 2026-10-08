import { useEffect, useState } from 'react'
import { fetchStatementFile } from '@/lib/api'

type FileState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; blob: Blob; url: string }

/** Loads a stored file for this visitor and gives back a temporary address the page can show. */
export function useStatementFile(accountId: number, storedAt: number | null, enabled: boolean): FileState {
  const [state, setState] = useState<FileState>({ status: 'loading' })

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    let created: string | null = null
    setState({ status: 'loading' })
    fetchStatementFile(accountId, storedAt)
      .then(blob => {
        if (cancelled) return
        created = URL.createObjectURL(blob)
        setState({ status: 'ready', blob, url: created })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed' })
      })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [accountId, storedAt, enabled])

  return state
}
