import { sessionId } from './session'
import type { Account, AccountsResponse, CatalogueProvider, Choice, Issue, SubmitResult } from './types'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  status: number
  code: string
  issues: Issue[]

  constructor(status: number, code: string, message: string, issues: Issue[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    const isForm = init?.body instanceof FormData
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: {
        ...(isForm ? {} : { 'Content-Type': 'application/json' }),
        'X-Session-Id': sessionId(),
        ...init?.headers,
      },
    })
  } catch {
    throw new ApiError(0, 'NETWORK', "We couldn't reach FINON. Check your connection and try again.")
  }

  if (res.status === 204) return undefined as T

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.code ?? 'UNKNOWN',
      body?.message ?? 'Something went wrong. Please try again.',
      body?.issues ?? [],
    )
  }
  return body as T
}

/** Fetches a stored file. It needs the visitor's session, so it cannot be a plain link or image address. */
export async function fetchStatementFile(id: number, storedAt: number | null): Promise<Blob> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api/accounts/${id}/statement/file${storedAt ? `?v=${storedAt}` : ''}`, {
      headers: { 'X-Session-Id': sessionId() },
    })
  } catch {
    throw new ApiError(0, 'NETWORK', "We couldn't reach FINON. Check your connection and try again.")
  }
  if (!res.ok) throw new ApiError(res.status, 'NO_FILE', "We couldn't load that file.")
  return res.blob()
}

export const api = {
  providers: () => request<CatalogueProvider[]>('/providers'),
  accounts: () => request<AccountsResponse>('/accounts'),
  addAccounts: (providerIds: number[], customNames: string[] = [], choices: Choice[] = []) =>
    request<AccountsResponse>('/accounts', { method: 'POST', body: JSON.stringify({ providerIds, customNames, choices }) }),
  setCategory: (id: number, category: string) =>
    request<Account>(`/accounts/${id}/category`, { method: 'PUT', body: JSON.stringify({ category }) }),
  removeAccount: (id: number) => request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  setStatement: (id: number, file: File, statementDate: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('statementDate', statementDate)
    return request<Account>(`/accounts/${id}/statement`, { method: 'PUT', body: form })
  },
  submit: () => request<SubmitResult>('/submit', { method: 'POST' }),
}
