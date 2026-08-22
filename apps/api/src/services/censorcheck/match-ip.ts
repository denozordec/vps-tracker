import { MAIN_SPACE_ID } from '@cfdm/db'
import { findVpsIdByIps, isPrivateOrLoopbackIp } from '@cfdm/db/repositories/ip-match'
import { vpsRepository } from '@cfdm/db/repositories/vps'

export { isPrivateOrLoopbackIp }

export function resolveProbeIp(observed: string | null | undefined, claimed: string): string {
  const obs = observed?.trim() ?? ''
  const claim = claimed.trim()
  if (obs && !isPrivateOrLoopbackIp(obs)) return obs
  return claim
}

export function matchVpsByPublicIp(ip: string): { vpsId: string | null; spaceId: string } {
  const all = vpsRepository.listAllSpaces()
  const vpsId = findVpsIdByIps(all, [ip])
  if (!vpsId) return { vpsId: null, spaceId: MAIN_SPACE_ID }
  const vps = all.find((row) => row.id === vpsId)
  return { vpsId, spaceId: vps?.spaceId ?? MAIN_SPACE_ID }
}
