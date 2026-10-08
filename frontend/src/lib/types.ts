export type Status = 'MISSING' | 'UPLOADED' | 'OUTDATED'

export interface Provider {
  id: number | null
  name: string
  category: string
  statementHelpUrl?: string | null
  supportPhone?: string | null
  websiteUrl?: string | null
}

export type CatalogueProvider = Provider & { id: number }

export interface Choice {
  providerId?: number
  name?: string
  category: string
}

export interface Statement {
  filename: string
  statementDate: string
  hasFile: boolean
  storedAt: number | null
  contentType?: string | null
}

export interface Account {
  id: number
  provider: Provider
  category: string
  manual: boolean
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
