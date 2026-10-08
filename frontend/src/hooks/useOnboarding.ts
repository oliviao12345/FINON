import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Choice } from '@/lib/types'

export const keys = {
  accounts: ['accounts'] as const,
  providers: ['providers'] as const,
}

export function useAccounts() {
  return useQuery({ queryKey: keys.accounts, queryFn: api.accounts })
}

export function useAvailableProviders(enabled: boolean) {
  return useQuery({ queryKey: keys.providers, queryFn: api.providers, enabled, staleTime: 0 })
}

function useRefreshing<TVars, TData>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([
      qc.invalidateQueries({ queryKey: keys.accounts }),
      qc.invalidateQueries({ queryKey: keys.providers }),
    ]),
  })
}

export const useAddAccounts = () =>
  useRefreshing((v: { ids: number[]; names: string[]; choices: Choice[] }) => api.addAccounts(v.ids, v.names, v.choices))
export const useSetCategory = () =>
  useRefreshing((v: { id: number; category: string }) => api.setCategory(v.id, v.category))
export const useRemoveAccount = () => useRefreshing((id: number) => api.removeAccount(id))
export const useSetStatement = () =>
  useRefreshing((v: { id: number; file: File; statementDate: string }) =>
    api.setStatement(v.id, v.file, v.statementDate))
export const useSubmit = () => useRefreshing(() => api.submit())
