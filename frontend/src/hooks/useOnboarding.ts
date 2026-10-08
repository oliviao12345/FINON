import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

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

export const useAddAccounts = () => useRefreshing((ids: number[]) => api.addAccounts(ids))
export const useRemoveAccount = () => useRefreshing((id: number) => api.removeAccount(id))
export const useSetStatement = () =>
  useRefreshing((v: { id: number; filename: string; statementDate: string }) =>
    api.setStatement(v.id, v.filename, v.statementDate))
export const useSubmit = () => useRefreshing(() => api.submit())
