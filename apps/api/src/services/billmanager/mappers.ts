/**
 * BILLmanager API response → vps-tracker model mappers
 */

import { parsePricelist } from './parsers.js'

const VDS_STATUS_MAP: Record<number, string> = {
  1: 'active',
  2: 'active',
  3: 'paused',
  4: 'archived',
  5: 'active',
}

export interface MappedVps {
  externalId: string
  ip: string
  dns: string
  ipv6: string
  additionalIps: string[]
  providerId: string
  providerAccountId: string
  country: string
  city: string
  datacenter: string
  os: string
  vcpu: number
  ramGb: number
  diskGb: number
  diskType: string
  virtualization: string
  bandwidthTb: number
  sshPort: number
  rootUser: string
  purpose: string
  environment: string
  project: string
  monitoringEnabled: boolean
  backupEnabled: boolean
  status: string
  tariffType: string
  currency: string
  dailyRate: null
  monthlyRate: number | null
  createdAt: string
  paidUntil: string
  notes: string
}

export interface MappedPayment {
  externalId: string
  type: string
  date: string
  amount: number
  currency: string
  providerAccountId: string
  vpsId: null
  note: string
}

export function mapVdsToVps(
  item: Record<string, string>,
  providerId: string,
  providerAccountId: string,
): MappedVps {
  const status =
    VDS_STATUS_MAP[Number(item.item_status_orig ?? item.item_status)] ?? 'active'
  const costStr = String(item.cost || '').replace(/[^\d.-]/g, '')
  const cost = parseFloat(costStr) || parseFloat(item.item_cost) || 0
  const createdate = item.createdate || ''
  const expiredate = item.real_expiredate || item.expiredate || ''
  const ip = (item.ip || '').trim()
  const domain = (item.domain || '').trim()
  const datacenter = (item.datacentername || item.datacenter || '').trim()
  const ostempl = (item.ostempl || '').trim()
  const currency = (item.currency_str || 'RUB').toString().trim() || 'RUB'

  const pricelist = item.pricelist || item.tariff || item.plan || ''
  const parsed = parsePricelist(pricelist)

  return {
    externalId: String(item.id || ''),
    ip: ip || domain || `bm-${item.id}`,
    dns: domain || ip || '',
    ipv6: '',
    additionalIps: [],
    providerId,
    providerAccountId,
    country: '',
    city: '',
    datacenter,
    os: ostempl,
    vcpu: parsed.vcpu || 0,
    ramGb: parsed.ramGb || 0,
    diskGb: parsed.diskGb || 0,
    diskType: parsed.diskType || 'NVMe',
    virtualization: parsed.virtualization || 'KVM',
    bandwidthTb: 0,
    sshPort: 22,
    rootUser: 'root',
    purpose: '',
    environment: 'prod',
    project: '',
    monitoringEnabled: false,
    backupEnabled: false,
    status,
    tariffType: 'monthly',
    currency: currency || 'RUB',
    dailyRate: null,
    monthlyRate: cost || null,
    createdAt: createdate ? createdate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    paidUntil: expiredate ? expiredate.slice(0, 10) : '',
    notes: `bm-${item.id}`,
  }
}

export function mapPaymentToPayment(
  item: Record<string, string>,
  providerAccountId: string,
): MappedPayment | null {
  const rawAmount = item.subaccountamount_iso || item.paymethodamount_iso || '0'
  const amount = parseFloat(String(rawAmount).replace(/[^\d.-]/g, '')) || 0
  const createDate = item.create_date || item.createdate || ''
  const dateStr = createDate ? String(createDate).slice(0, 10) : new Date().toISOString().slice(0, 10)
  const statusNum = Number(item.status_orig ?? item.real_status ?? item.status)
  if (statusNum !== 4) return null
  return {
    externalId: String(item.id || ''),
    type: 'provider_balance_topup',
    date: dateStr,
    amount,
    currency:
      (String(item.subaccountamount_iso || item.paymethodamount_iso || '').match(/([A-Z]{3})\b/) || [])[1] ||
      'USD',
    providerAccountId,
    vpsId: null,
    note: `BILLmanager #${item.number || item.id}`,
  }
}
