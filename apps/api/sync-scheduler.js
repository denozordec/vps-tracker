/**
 * @deprecated Используйте Fastify scheduler: apps/api/dist/services/scheduler.js (RUNTIME=fastify).
 * Legacy Express entry re-exports compiled scheduler для совместимости.
 */
export {
  startScheduler,
  stopScheduler,
  restartScheduler,
  runScheduledSync,
  runScheduledSyncTariffs,
  runScheduledUptimeChecks,
  runNotificationTick,
} from './dist/services/scheduler.js'
