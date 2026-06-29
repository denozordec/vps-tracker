export interface RuvdsPagination {
  page: number
  per_page: number
  previous_page: number | null
  next_page: number | null
  last_page: number
  total_entries: number
}

export interface RuvdsNetworkV4 {
  ip_address: string
  netmask?: string
  gateway?: string
}

export interface RuvdsServer {
  virtual_server_id: number
  status?: string
  create_progress?: number
  datacenter?: number
  tariff_id?: number
  payment_period?: number
  os_id?: number
  template_id?: string | null
  cpu?: number
  ram?: number
  vram?: number
  drive?: number
  drive_tariff_id?: number
  additional_drive?: number | null
  additional_drive_tariff_id?: number | null
  ip?: number
  ddos_protection?: number
  user_comment?: string
  paid_till?: string
  network_v4?: RuvdsNetworkV4[]
}

export interface RuvdsServersResponse {
  servers: RuvdsServer[]
  pagination?: RuvdsPagination
}

export interface RuvdsBalanceResponse {
  amount: number
  currency: number
  type?: string
}

export interface RuvdsPayment {
  dt: string
  direction: number
  pay_source?: string
  amount: number
  currency: number
  type?: string
}

export interface RuvdsPaymentsResponse {
  payments: RuvdsPayment[]
  pagination?: RuvdsPagination
}

export interface RuvdsVpsTariff {
  id: number
  name: string
  cpu?: number
  ram?: number
  vram?: number
  ip?: number
  is_active?: boolean
}

export interface RuvdsDriveTariff {
  id: number
  name: string
  price?: number
  is_active?: boolean
}

export interface RuvdsTariffsResponse {
  vps?: RuvdsVpsTariff[]
  drive?: RuvdsDriveTariff[]
  additional_drive?: RuvdsDriveTariff[]
  additional_service?: { id: number; name: string; price?: number; is_active?: boolean }[]
  payment_period_discount?: { payment_period: number; discount: number }[]
}

export interface RuvdsDatacenter {
  id: number
  name: string
  country?: string
}

export interface RuvdsDatacentersResponse {
  datacenters?: RuvdsDatacenter[]
}

export interface RuvdsOsItem {
  id: number
  name: string
}

export interface RuvdsOsResponse {
  os?: RuvdsOsItem[]
}

export interface RuvdsServerCostResponse {
  cost_rub?: number
}

export interface RuvdsApiErrorBody {
  id?: string
  message?: string
}
