import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, MAIN_SPACE_ID, runWithSpace } from '@cfdm/db'
import { resetTestDb, seedTestProvider, seedTestProviderAccount } from '@cfdm/db/test-setup'
import { spacesRepository, vpsGrantsRepository } from '@cfdm/db/repositories/spaces'
import { vpsRepository } from '@cfdm/db/repositories/vps'
import { buildApp } from '../index.js'

describe('spaces API', () => {
  beforeEach(() => {
    resetTestDb()
    seedTestProvider()
    seedTestProviderAccount()
    spacesRepository.getMain()
  })

  afterEach(() => {
    closeDb()
  })

  it('lists spaces and creates personal space', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/spaces' })
    expect(res.statusCode).toBe(200)
    const list = res.json() as { id: string }[]
    expect(list.some((s) => s.id === MAIN_SPACE_ID)).toBe(true)
    await app.close()
  })

  it('shares and assigns VPS between spaces', async () => {
    const personal = spacesRepository.create({
      id: 'space-user-u1',
      name: 'User 1',
      slug: 'user-u1',
      kind: 'personal',
      ownerUserId: 'u1',
    })

    const vps = runWithSpace(MAIN_SPACE_ID, () =>
      vpsRepository.create({
        ip: '1.2.3.4',
        providerId: 'prov-1',
        providerAccountId: 'acc-1',
        status: 'active',
      }),
    )

    const grant = vpsGrantsRepository.create({
      vpsId: vps.id,
      fromSpaceId: MAIN_SPACE_ID,
      toSpaceId: personal.id,
      permission: 'write',
      grantedByUserId: 'admin',
    })
    expect(grant.permission).toBe('write')

    const sharedList = runWithSpace(personal.id, () => {
      const grants = vpsGrantsRepository.listToSpace(personal.id)
      return vpsRepository.listByIds(grants.map((g) => g.vpsId))
    })
    expect(sharedList).toHaveLength(1)
    expect(sharedList[0]?.id).toBe(vps.id)

    vpsGrantsRepository.deleteByVps(vps.id)
    const moved = vpsRepository.assignToSpace(vps.id, personal.id)
    expect(moved?.spaceId).toBe(personal.id)
    expect(moved?.providerAccountId).toBeFalsy()

    const stillInMain = runWithSpace(MAIN_SPACE_ID, () => vpsRepository.get(vps.id))
    expect(stillInMain).toBeUndefined()

    const inPersonal = runWithSpace(personal.id, () => vpsRepository.get(vps.id))
    expect(inPersonal?.id).toBe(vps.id)
  })

  it('share endpoint via inject', async () => {
    const personal = spacesRepository.create({
      id: 'space-user-u2',
      name: 'User 2',
      slug: 'user-u2',
      kind: 'personal',
      ownerUserId: 'u2',
    })
    const vps = runWithSpace(MAIN_SPACE_ID, () =>
      vpsRepository.create({
        ip: '10.0.0.1',
        providerId: 'prov-1',
        providerAccountId: 'acc-1',
        status: 'active',
      }),
    )

    // Same process DB as resetTestDb (:memory: already set)
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/api/spaces/${MAIN_SPACE_ID}/vps/${vps.id}/share`,
      headers: { 'x-space-id': MAIN_SPACE_ID },
      payload: { toSpaceId: personal.id, permission: 'read' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { toSpaceId: string; permission: string }
    expect(body.toSpaceId).toBe(personal.id)
    expect(body.permission).toBe('read')
    await app.close()
  })
})
