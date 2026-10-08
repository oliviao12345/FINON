import { vi } from 'vitest'
import type { Account, AccountsResponse, Provider, Status } from '@/lib/types'

export const provider = (id: number, name: string, category = 'Bank'): Provider => ({ id, name, category })

export function account(id: number, name: string, status: Status): Account {
  return {
    id,
    provider: provider(id, name),
    category: 'Bank',
    manual: false,
    status,
    statement: status === 'MISSING' ? null : {
      filename: `${name}.pdf`,
      statementDate: status === 'OUTDATED' ? '2026-04-01' : '2026-09-20',
      hasFile: true,
      storedAt: 1_790_000_000_000,
      contentType: 'application/pdf',
    },
  }
}

export function overview(accounts: Account[]): AccountsResponse {
  const issues = accounts.filter(a => a.status !== 'UPLOADED').map(a => ({ accountId: a.id, provider: a.provider.name, status: a.status }))
  return {
    accounts,
    readiness: { ready: accounts.length - issues.length, total: accounts.length, canSubmit: accounts.length > 0 && issues.length === 0, issues },
  }
}

type Handler = (body: unknown) => { status?: number; json?: unknown }
type Routes = Record<string, Handler>

export function mockApi(routes: Routes) {
  const calls: { key: string; body: unknown }[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace(/^.*\/api/, '')
    const key = `${init?.method ?? 'GET'} ${path}`
    const body = init?.body instanceof FormData
      ? { filename: (init.body.get('file') as File).name, statementDate: init.body.get('statementDate') }
      : init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ key, body })
    const handler = routes[key]
    if (!handler) throw new Error(`unmocked ${key}`)
    const { status = 200, json } = handler(body)
    return new Response(status === 204 ? null : JSON.stringify(json), { status })
  })
  vi.stubGlobal('fetch', fn)
  return { calls }
}
