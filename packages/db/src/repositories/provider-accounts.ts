import { asc, eq } from 'drizzle-orm'
import { getDb, schema } from '../index.js'
import { generateId } from './utils.js'

type AccountRow = typeof schema.providerAccounts.$inferSelect
type AccountInsert = Partial<typeof schema.providerAccounts.$inferInsert> & {
  providerId: string
  name: string
}

export interface PublicAccountRow extends Omit<AccountRow, 'apiCredentials'> {
  apiCredentialsSet: boolean
}

function sanitize(row: AccountRow | undefined): PublicAccountRow | undefined {
  if (!row) return undefined
  const { apiCredentials, ...rest } = row
  return { ...rest, apiCredentialsSet: Boolean(apiCredentials) }
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
      input.apiCredentials !== undefined
        ? String(input.apiCredentials || '')
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
