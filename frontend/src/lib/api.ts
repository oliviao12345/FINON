import type { Account, AccountsResponse, Issue, Provider, SubmitResult } from './types'

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
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
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

export const api = {
  providers: () => request<Provider[]>('/providers'),
  accounts: () => request<AccountsResponse>('/accounts'),
  addAccounts: (providerIds: number[]) =>
    request<AccountsResponse>('/accounts', { method: 'POST', body: JSON.stringify({ providerIds }) }),
  removeAccount: (id: number) => request<void>(`/accounts/${id}`, { method: 'DELETE' }),
  setStatement: (id: number, filename: string, statementDate: string) =>
    request<Account>(`/accounts/${id}/statement`, {
      method: 'PUT',
      body: JSON.stringify({ filename, statementDate }),
    }),
  submit: () => request<SubmitResult>('/submit', { method: 'POST' }),
}
