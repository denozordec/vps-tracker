import { vpsRepository, type VpsDto } from './vps.js'
import { providersRepository } from './providers.js'
import { providerAccountsRepository } from './provider-accounts.js'
import { paymentsRepository } from './payments.js'
import { balanceLedgerRepository } from './balance-ledger.js'
import { settingsRepository } from './settings.js'
import { activeTariffsRepository, tariffSyncOptionsRepository } from './tariffs.js'
import { projectsRepository } from './projects.js'
import { syncLogRepository } from './sync-log.js'
import { vpsDomainsRepository } from './vps-domains.js'
import { vpsGrantsRepository } from './spaces.js'
import { getCurrentSpaceId } from '../space-context.js'

export interface Snapshot {
  spaceId: string
  vps: VpsDto[]
  serverProjects: ReturnType<typeof projectsRepository.list>
  providers: ReturnType<typeof providersRepository.list>
  providerAccounts: ReturnType<typeof providerAccountsRepository.list>
  payments: ReturnType<typeof paymentsRepository.list>
  balanceLedger: ReturnType<typeof balanceLedgerRepository.list>
  settings: ReturnType<typeof settingsRepository.list>
  activeTariffs: ReturnType<typeof activeTariffsRepository.list>
  tariffSyncOptions: ReturnType<typeof tariffSyncOptionsRepository.list>
  syncLog: ReturnType<typeof syncLogRepository.listRecent>
  vpsDomains: ReturnType<typeof vpsDomainsRepository.list>
  vpsGrants: ReturnType<typeof vpsGrantsRepository.listToSpace>
}

function listVpsWithShared(): VpsDto[] {
  const spaceId = getCurrentSpaceId()
  const owned = vpsRepository.list()
  const ownedIds = new Set(owned.map((v) => v.id))
  const grants = vpsGrantsRepository.listToSpace(spaceId)
  const sharedIds = grants.map((g) => g.vpsId).filter((id) => !ownedIds.has(id))
  const sharedRows = vpsRepository.listByIds(sharedIds)
  const grantByVps = new Map(grants.map((g) => [g.vpsId, g]))
  const shared = sharedRows.map((v) => {
    const g = grantByVps.get(v.id)
    return {
      ...v,
      access: 'shared' as const,
      grantPermission: (g?.permission === 'write' ? 'write' : 'read') as 'read' | 'write',
      // Hide credentials linkage for shared view
      providerAccountId: '',
      providerId: v.providerId ?? '',
    }
  })
  return [...owned, ...shared]
}

export function getSnapshot(): Snapshot {
  const spaceId = getCurrentSpaceId()
  return {
    spaceId,
    vps: listVpsWithShared(),
    serverProjects: projectsRepository.list(),
    providers: providersRepository.list(),
    providerAccounts: providerAccountsRepository.list(),
    payments: paymentsRepository.list(),
    balanceLedger: balanceLedgerRepository.list(),
    settings: settingsRepository.list(),
    activeTariffs: activeTariffsRepository.list(),
    tariffSyncOptions: tariffSyncOptionsRepository.list(),
    syncLog: syncLogRepository.listRecent(50),
    vpsDomains: vpsDomainsRepository.list(),
    vpsGrants: vpsGrantsRepository.listToSpace(spaceId),
  }
}

export {
  vpsRepository,
  providersRepository,
  providerAccountsRepository,
  paymentsRepository,
  balanceLedgerRepository,
  settingsRepository,
  activeTariffsRepository,
  tariffSyncOptionsRepository,
  projectsRepository,
  syncLogRepository,
  vpsDomainsRepository,
  vpsGrantsRepository,
}
