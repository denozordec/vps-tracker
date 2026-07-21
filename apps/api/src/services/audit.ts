import { randomUUID } from 'node:crypto'
import { auditLogRepository } from '@cfdm/db/repositories/audit-log'
import type { AuditActorContext } from '../lib/audit-actor.js'

type AuditOp = 'create' | 'update' | 'delete'

export type AuditIngestConfig = {
  portalUrl: string
  ingestSecret: string | undefined
}

export function loadAuditIngestConfig(
  env: NodeJS.ProcessEnv = process.env,
): AuditIngestConfig {
  const isProd = env.NODE_ENV === 'production'
  const portalUrl = (
    env.AUTH_PORTAL_URL ??
    env.VITE_AUTH_PORTAL_URL ??
    'http://localhost:5175'
  ).replace(/\/$/, '')
  const ingestSecret =
    env.AUTH_AUDIT_INGEST_SECRET ??
    (isProd ? undefined : 'dev-audit-ingest-secret')
  return { portalUrl, ingestSecret }
}

const ENTITY_LABELS: Record<string, string> = {
  vps: 'VPS',
  payment: 'Платёж',
  providerAccount: 'Аккаунт',
  provider: 'Хостер',
  settings: 'Настройки',
  balanceLedger: 'Баланс',
  serverProject: 'Проект',
}

const ACTION_LABELS: Record<AuditOp, string> = {
  create: 'создание',
  update: 'изменение',
  delete: 'удаление',
}

function auditSummary(entity: string, op: AuditOp, entityId: string): string {
  const label = ENTITY_LABELS[entity] ?? entity
  const verb = ACTION_LABELS[op]
  return `${label}: ${verb} (${entityId})`
}

function portalAction(entity: string, op: AuditOp): string {
  return `vps.${entity}.${op}`
}

function recordAudit(
  entity: string,
  entityId: string,
  op: AuditOp,
  diff: Record<string, unknown> | undefined,
  ctx?: AuditActorContext,
): void {
  const eventId = randomUUID()
  const createdAt = new Date().toISOString()
  const actorUserId = ctx?.actorUserId ?? null

  try {
    auditLogRepository.append({
      eventId,
      entity,
      entityId,
      action: op,
      diff,
      actorUserId,
      createdAt,
    })
  } catch {
    // Local audit must not break CRUD; swallow repository errors too.
    return
  }

  pushAuditToPortal({
    eventId,
    entity,
    entityId,
    op,
    diff,
    ctx,
    createdAt,
  })
}

type PortalPushInput = {
  eventId: string
  entity: string
  entityId: string
  op: AuditOp
  diff?: Record<string, unknown>
  ctx?: AuditActorContext
  createdAt: string
}

export function pushAuditToPortal(input: PortalPushInput): void {
  const config = loadAuditIngestConfig()
  if (!config.ingestSecret) return

  const body = {
    events: [
      {
        event_id: input.eventId,
        source_app: 'vps' as const,
        action: portalAction(input.entity, input.op),
        severity: 'info' as const,
        actor_user_id: input.ctx?.actorUserId ?? null,
        actor_email: input.ctx?.actorEmail ?? null,
        actor_name: input.ctx?.actorName ?? null,
        target_type: 'app_resource' as const,
        target_id: input.entityId,
        summary: auditSummary(input.entity, input.op, input.entityId),
        details: input.diff ?? null,
        ip: input.ctx?.ip ?? null,
        created_at: input.createdAt,
      },
    ],
  }

  void fetch(`${config.portalUrl}/api/v1/ingest/audit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ingestSecret}`,
    },
    body: JSON.stringify(body),
  }).catch(() => {
    // Fire-and-forget: portal ingest failures must not affect CRUD.
  })
}

export function auditCreate(
  entity: string,
  entityId: string,
  data?: Record<string, unknown>,
  ctx?: AuditActorContext,
): void {
  recordAudit(entity, entityId, 'create', data, ctx)
}

export function auditUpdate(
  entity: string,
  entityId: string,
  patch: Record<string, unknown>,
  ctx?: AuditActorContext,
): void {
  recordAudit(entity, entityId, 'update', patch, ctx)
}

export function auditDelete(
  entity: string,
  entityId: string,
  ctx?: AuditActorContext,
): void {
  recordAudit(entity, entityId, 'delete', undefined, ctx)
}
