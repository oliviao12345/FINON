export type Status = 'MISSING' | 'UPLOADED' | 'OUTDATED'

export interface Provider {
  id: number
  name: string
  category: string
}

export interface Statement {
  filename: string
  statementDate: string
}

export interface Account {
  id: number
  provider: Provider
  status: Status
  statement: Statement | null
}

export interface Issue {
  accountId: number
  provider: string
  status: Status
}

export interface Readiness {
  ready: number
  total: number
  canSubmit: boolean
  issues: Issue[]
}

export interface AccountsResponse {
  accounts: Account[]
  readiness: Readiness
}

export interface SubmitResult {
  submitted: boolean
  submittedAt: string
  accounts: number
}
