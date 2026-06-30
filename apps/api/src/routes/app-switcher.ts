import type { FastifyPluginAsync } from 'fastify'
import { settingsRepository } from '@cfdm/db/repositories/settings'

export const appSwitcherRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/settings/app-switcher', async () => {
    return settingsRepository.getAppSwitcher()
  })
}
