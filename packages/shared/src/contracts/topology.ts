import { z } from 'zod'

export const topologyViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
})

export const topologyDocumentSchema = z.object({
  nodes: z.array(z.record(z.string(), z.unknown())),
  edges: z.array(z.record(z.string(), z.unknown())),
  viewport: topologyViewportSchema,
})

export type TopologyDocument = z.infer<typeof topologyDocumentSchema>

export const EMPTY_TOPOLOGY_DOCUMENT: TopologyDocument = {
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
}

export const topologyDiagramSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  name: z.string(),
  document: topologyDocumentSchema,
  locked: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type TopologyDiagram = z.infer<typeof topologyDiagramSchema>

export const topologyDiagramListItemSchema = topologyDiagramSchema.omit({
  document: true,
})

export type TopologyDiagramListItem = z.infer<typeof topologyDiagramListItemSchema>

export const topologyCreateSchema = z.object({
  name: z.string().min(1, 'Укажите название схемы').max(120),
  document: topologyDocumentSchema.optional(),
})

export type TopologyCreateInput = z.infer<typeof topologyCreateSchema>

export const topologyUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  document: topologyDocumentSchema.optional(),
  locked: z.boolean().optional(),
  /** Client's last known updatedAt — 409 if stale */
  expectedUpdatedAt: z.string().optional(),
})

export type TopologyUpdateInput = z.infer<typeof topologyUpdateSchema>
