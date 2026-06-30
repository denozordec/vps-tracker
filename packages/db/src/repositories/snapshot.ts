import { vpsRepository } from './vps.js'
import { providersRepository } from './providers.js'
import { providerAccountsRepository } from './provider-accounts.js'
import { paymentsRepository } from './payments.js'
import { balanceLedgerRepository } from './balance-ledger.js'
import { settingsRepository } from './settings.js'
import { activeTariffsRepository, tariffSyncOptionsRepository } from './tariffs.js'
import { projectsRepository } from './projects.js'
import { syncLogRepository } from './sync-log.js'
import { vpsDomainsRepository } from './vps-domains.js'

export interface Snapshot {
  vps: ReturnType<typeof vpsRepository.list>
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
}

export function getSnapshot(): Snapshot {
  return {
    vps: vpsRepository.list(),
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
}
