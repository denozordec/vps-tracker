import { api } from '@/lib/api-client'

export interface DashboardStats {
  activeVpsCount: number
  totalVpsCount: number
  providerCount: number
  accountCount: number
  monthlyBurnEstimate: number
  totalBalanceApi: number
  minRunwayDays: number | null
  expiringWithin7Days: number
  issuesCount: number
  lastGlobalSyncAt: string | null
  staleSyncAccountCount: number
  lowBalanceAccountCount: number
}

export const dashboardKeys = {
  stats: ['dashboard', 'stats'] as const,
}

export const dashboardStatsQueryOptions = () => ({
  queryKey: dashboardKeys.stats,
  queryFn: () => api.fetchDashboardStats(),
  staleTime: 30_000,
})
