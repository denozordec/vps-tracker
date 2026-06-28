import { asc, count, eq } from 'drizzle-orm'
import { parseApiLogin } from '@cfdm/shared'
import { getDb, schema } from '../index.js'
import { generateId } from './utils.js'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type AccountInsert = Partial<typeof schema.providerAccounts.$inferInsert> & {
  providerId: string
  name: string
}

export interface PublicAccountRow extends Omit<AccountRow, 'apiCredentials'> {
  apiCredentialsSet: boolean
  apiLogin: string
}

export interface AccountDependencyCounts {
  vps: number
  payments: number
  balanceLedger: number
  activeTariffs: number
  syncLog: number
}

function sanitize(row: AccountRow | undefined): PublicAccountRow | undefined {
  if (!row) return undefined
  const { apiCredentials, ...rest } = row
  return {
    ...rest,
    apiCredentialsSet: Boolean(apiCredentials),
    apiLogin: parseApiLogin(apiCredentials),
  }
}

function normalize(input: Partial<AccountRow>) {
  const rawAlert = input.balanceAlertBelow
  const alertBelow = rawAlert != null && !Number.isNaN(Number(rawAlert)) ? Number(rawAlert) : null
  return {
    providerId: input.providerId ?? '',
    name: input.name ?? '',
    panelUrl: input.panelUrl ?? '',
    currency: input.currency ?? '',
    billingMode: input.billingMode ?? '',
    notes: input.notes ?? '',
    apiType: '',
    apiBaseUrl: '',
    apiCredentials: input.apiCredentials ?? '',
    balanceAlertBelow: Number.isFinite(alertBelow) ? alertBelow : null,
  }
}

function countVpsForAccount(id: string): number {
  return Number(
    getDb().select({ count: count() }).from(schema.vps).where(eq(schema.vps.providerAccountId, id)).get()?.count ?? 0,
  )
}

function countPaymentsForAccount(id: string): number {
  return Number(
    getDb().select({ count: count() }).from(schema.payments).where(eq(schema.payments.providerAccountId, id)).get()?.count ?? 0,
  )
}

function countLedgerForAccount(id: string): number {
  return Number(
    getDb().select({ count: count() }).from(schema.balanceLedger).where(eq(schema.balanceLedger.providerAccountId, id)).get()?.count ?? 0,
  )
}

function countTariffsForAccount(id: string): number {
  return Number(
    getDb().select({ count: count() }).from(schema.activeTariffs).where(eq(schema.activeTariffs.providerAccountId, id)).get()?.count ?? 0,
  )
}

function countSyncLogForAccount(id: string): number {
  return Number(
    getDb().select({ count: count() }).from(schema.syncLog).where(eq(schema.syncLog.accountId, id)).get()?.count ?? 0,
  )
}

export const providerAccountsRepository = {
  list(): PublicAccountRow[] {
    const rows = getDb()
      .select()
      .from(schema.providerAccounts)
      .orderBy(asc(schema.providerAccounts.name))
      .all()
    return rows.map((r) => sanitize(r)!) as PublicAccountRow[]
  },

  get(id: string): PublicAccountRow | undefined {
    const row = getDb()
      .select()
      .from(schema.providerAccounts)
      .where(eq(schema.providerAccounts.id, id))
      .get()
    return sanitize(row)
  },

  getWithCredentials(id: string): AccountRow | undefined {
    return getDb()
      .select()
      .from(schema.providerAccounts)
      .where(eq(schema.providerAccounts.id, id))
      .get()
  },

  getDependencyCounts(id: string): AccountDependencyCounts {
    return {
      vps: countVpsForAccount(id),
      payments: countPaymentsForAccount(id),
      balanceLedger: countLedgerForAccount(id),
      activeTariffs: countTariffsForAccount(id),
      syncLog: countSyncLogForAccount(id),
    }
  },

  create(input: AccountInsert, id?: string): PublicAccountRow {
    const db = getDb()
    const finalId = id ?? input.id ?? generateId('account')
    db.insert(schema.providerAccounts)
      .values({ id: finalId, ...normalize(input) })
      .run()
    return this.get(finalId)!
  },

  update(id: string, input: Partial<AccountRow>): PublicAccountRow | undefined {
    const db = getDb()
    const existing = this.getWithCredentials(id)
    if (!existing) return undefined
    const apiCredentials =
      input.apiCredentials !== undefined && String(input.apiCredentials || '').trim() !== ''
        ? String(input.apiCredentials)
        : (existing.apiCredentials || '')

    let balanceAlertBelow = existing.balanceAlertBelow
    if (input.balanceAlertBelow !== undefined) {
      const v = input.balanceAlertBelow
      balanceAlertBelow = v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null
    }

    db.update(schema.providerAccounts)
      .set({
        providerId: input.providerId ?? existing.providerId,
        name: input.name ?? existing.name,
        panelUrl: input.panelUrl ?? existing.panelUrl,
        currency: input.currency ?? existing.currency,
        billingMode: input.billingMode ?? existing.billingMode,
        notes: input.notes ?? existing.notes,
        apiType: '',
        apiBaseUrl: '',
        apiCredentials,
        balanceAlertBelow,
      })
      .where(eq(schema.providerAccounts.id, id))
      .run()
    return this.get(id)
  },

  delete(id: string): boolean {
    const res = getDb()
      .delete(schema.providerAccounts)
      .where(eq(schema.providerAccounts.id, id))
      .run()
    return res.changes > 0
  },
}

export { parseApiLogin }
