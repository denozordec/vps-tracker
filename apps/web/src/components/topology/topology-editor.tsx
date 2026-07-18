import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MarkerType,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesChange,
  type OnEdgesChange,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { cn } from '@cfdm/ui/lib/utils'
import { topologyNodeTypes } from './node-types'
import { topologyEdgeTypes } from './edge-types'
import { TopologyPalette, parsePaletteDrag, shapeLabel } from './palette'
import { TopologyToolbar } from './toolbar'
import { AddVpsSheet } from './add-vps-sheet'
import { VpsDetailSheet } from './vps-detail-sheet'
import { ElementEditSheet, type EditableElement } from './element-edit-sheet'
import { EdgeEditSheet } from './edge-edit-sheet'
import { applyEdgeVisuals, createConnectedEdge } from './edge-utils'
import {
  normalizeGroupLayers,
  placeWithOptionalParent,
  reconcileNodeParenting,
  sortParentsFirst,
} from './group-utils'
import {
  defaultEdgeData,
  isGroupNodeData,
  isNoteNodeData,
  isShapeNodeData,
  isVpsNodeData,
  newNodeId,
  type GroupNodeData,
  type NoteNodeData,
  type PaletteItem,
  type ShapeNodeData,
  type TopologyEdgeData,
  type TopologyFlowNode,
  type TopologyNodeType,
} from './types'

type FlowNode = TopologyFlowNode
type FlowEdge = Edge<TopologyEdgeData>

interface TopologyEditorProps {
  diagramId: string
  initialNodes: FlowNode[]
  initialEdges: Edge[]
  initialViewport?: Viewport
  locked: boolean
  onDocumentChange: (doc: {
    nodes: FlowNode[]
    edges: Edge[]
    viewport: Viewport
  }) => void
  onLockedChange: (locked: boolean) => void
  className?: string
}

function TopologyEditorInner({
  diagramId,
  initialNodes,
  initialEdges,
  initialViewport,
  locked,
  onDocumentChange,
  onLockedChange,
  className,
}: TopologyEditorProps) {
  const { resolvedTheme } = useTheme()
  const colorMode = resolvedTheme === 'dark' ? 'dark' : 'light'
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView, zoomIn, zoomOut, getViewport, setViewport } =
    useReactFlow()

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>(
    normalizeGroupLayers(sortParentsFirst(initialNodes)),
  )
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<FlowEdge>(
    normalizeEdges(initialEdges),
  )
  const [zoomPercent, setZoomPercent] = useState(100)
  const [addVpsOpen, setAddVpsOpen] = useState(false)
  const [detailVpsId, setDetailVpsId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editElement, setEditElement] = useState<EditableElement | null>(null)
  const [elementOpen, setElementOpen] = useState(false)
  const [editEdgeId, setEditEdgeId] = useState<string | null>(null)
  const [editEdgeData, setEditEdgeData] = useState<TopologyEdgeData | null>(null)
  const [edgeOpen, setEdgeOpen] = useState(false)
  const skipSave = useRef(false)
  const hydrated = useRef(false)

  useEffect(() => {
    skipSave.current = true
    hydrated.current = false
    setNodes(normalizeGroupLayers(sortParentsFirst(initialNodes)))
    setEdges(normalizeEdges(initialEdges))
    setEditElement(null)
    setElementOpen(false)
    setEditEdgeId(null)
    setEditEdgeData(null)
    setEdgeOpen(false)
    if (initialViewport) {
      void setViewport(initialViewport)
      setZoomPercent(Math.round((initialViewport.zoom || 1) * 100))
    }
    const t = window.setTimeout(() => {
      skipSave.current = false
      hydrated.current = true
    }, 100)
    return () => window.clearTimeout(t)
  }, [diagramId]) // eslint-disable-line react-hooks/exhaustive-deps -- remount on diagram switch

  const emitSave = useCallback(() => {
    if (skipSave.current || !hydrated.current || locked) return
    onDocumentChange({
      nodes,
      edges,
      viewport: getViewport(),
    })
  }, [nodes, edges, getViewport, locked, onDocumentChange])

  useEffect(() => {
    if (!hydrated.current || locked) return
    const t = window.setTimeout(emitSave, 700)
    return () => window.clearTimeout(t)
  }, [nodes, edges, emitSave, locked])

  const onNodesChange: OnNodesChange<FlowNode> = useCallback(
    (changes) => {
      if (locked) return
      onNodesChangeBase(changes)
      const touchesSelection = changes.some(
        (c) => c.type === 'select' || c.type === 'dimensions' || c.type === 'replace',
      )
      if (touchesSelection) {
        // Keep groups on back layer after select/resize updates settle
        queueMicrotask(() => {
          setNodes((ns) => normalizeGroupLayers(ns))
        })
      }
    },
    [locked, onNodesChangeBase, setNodes],
  )

  const onEdgesChange: OnEdgesChange<FlowEdge> = useCallback(
    (changes) => {
      if (locked) return
      onEdgesChangeBase(changes)
    },
    [locked, onEdgesChangeBase],
  )

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (locked) return
      if (!connection.source || !connection.target) return
      setEdges((eds) =>
        addEdge(
          createConnectedEdge({
            source: connection.source,
            target: connection.target,
            sourceHandle: connection.sourceHandle,
            targetHandle: connection.targetHandle,
          }),
          eds,
        ),
      )
    },
    [locked, setEdges],
  )

  const onNodeDragStop: OnNodeDrag<FlowNode> = useCallback(
    (_e, node) => {
      if (locked) return
      setNodes((ns) => {
        const current = ns.find((n) => n.id === node.id) ?? node
        const next = reconcileNodeParenting(current, ns)
        if (next === current && next.parentId === current.parentId) {
          const samePos =
            next.position.x === current.position.x && next.position.y === current.position.y
          if (samePos) return normalizeGroupLayers(ns)
        }
        const updated = ns.map((n) => (n.id === next.id ? next : n))
        return normalizeGroupLayers(sortParentsFirst(updated))
      })
    },
    [locked, setNodes],
  )

  const existingVpsIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of nodes) {
      if (n.type === 'vps' && isVpsNodeData(n.data)) ids.add(n.data.vpsId)
    }
    return ids
  }, [nodes])

  function placeNode(item: PaletteItem, position: { x: number; y: number }) {
    if (item.kind === 'vps-picker') {
      setAddVpsOpen(true)
      return
    }
    setNodes((ns) => {
      let draft: FlowNode | null = null
      if (item.kind === 'shape') {
        draft = {
          id: newNodeId('shape'),
          type: 'shape',
          position,
          data: { kind: item.shape, label: shapeLabel(item.shape) },
        }
      } else if (item.kind === 'note') {
        draft = {
          id: newNodeId('note'),
          type: 'note',
          position,
          data: { text: 'Заметка' },
        }
      } else if (item.kind === 'group') {
        draft = {
          id: newNodeId('group'),
          type: 'group',
          position,
          style: { width: 320, height: 200 },
          data: { label: 'Группа' },
          zIndex: -1,
        }
      }
      if (!draft) return ns
      const placed = placeWithOptionalParent(draft, position, ns)
      return normalizeGroupLayers(sortParentsFirst([...ns, placed]))
    })
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (locked) return
    const item = parsePaletteDrag(e.dataTransfer)
    if (!item) return
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    placeNode(item, position)
  }

  function handleAddVps(vpsIds: string[]) {
    const origin = screenToFlowPosition({
      x: (wrapperRef.current?.clientWidth ?? 400) / 2 + 80,
      y: (wrapperRef.current?.clientHeight ?? 300) / 2,
    })
    setNodes((ns) => {
      const created = vpsIds.map((vpsId, i) => {
        const pos = {
          x: origin.x + (i % 3) * 240,
          y: origin.y + Math.floor(i / 3) * 110,
        }
        const draft: FlowNode = {
          id: newNodeId('vps'),
          type: 'vps',
          position: pos,
          data: { vpsId },
        }
        return placeWithOptionalParent(draft, pos, ns)
      })
      return normalizeGroupLayers(sortParentsFirst([...ns, ...created]))
    })
  }

  function placeItemAtCenter(item: PaletteItem) {
    if (locked) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    const position = screenToFlowPosition({
      x: (rect?.left ?? 0) + (rect?.width ?? 400) / 2,
      y: (rect?.top ?? 0) + (rect?.height ?? 300) / 2,
    })
    placeNode(item, position)
  }

  function onNodeClick(_e: ReactMouseEvent, node: FlowNode) {
    if (node.type === 'vps' && isVpsNodeData(node.data)) {
      setDetailVpsId(node.data.vpsId)
      setDetailOpen(true)
      return
    }
    if (node.type === 'shape' && isShapeNodeData(node.data)) {
      setEditElement({ kind: 'shape', id: node.id, data: node.data })
      setElementOpen(true)
      return
    }
    if (node.type === 'note' && isNoteNodeData(node.data)) {
      setEditElement({ kind: 'note', id: node.id, data: node.data })
      setElementOpen(true)
      return
    }
    if (node.type === 'group' && isGroupNodeData(node.data)) {
      setEditElement({ kind: 'group', id: node.id, data: node.data })
      setElementOpen(true)
    }
  }

  function onEdgeClick(_e: ReactMouseEvent, edge: FlowEdge) {
    const data = edge.data ?? defaultEdgeData()
    setEditEdgeId(edge.id)
    setEditEdgeData(data)
    setEdgeOpen(true)
  }

  function handleSaveElement(
    id: string,
    type: TopologyNodeType,
    data: ShapeNodeData | NoteNodeData | GroupNodeData,
  ) {
    setNodes((ns) =>
      ns.map((n) => (n.id === id && n.type === type ? { ...n, data } : n)),
    )
  }

  function handleSaveEdge(edgeId: string, data: TopologyEdgeData) {
    setEdges((eds) =>
      eds.map((e) => (e.id === edgeId ? applyEdgeVisuals(e, data) : e)),
    )
  }

  async function handleExport() {
    const el = wrapperRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!el) {
      toast.error('Не удалось экспортировать схему')
      return
    }
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: colorMode === 'dark' ? '#0a0a0a' : '#ffffff',
        pixelRatio: 2,
      })
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `topology-${diagramId}.png`
      a.click()
      toast.success('PNG сохранён')
    } catch {
      toast.error('Ошибка экспорта PNG')
    }
  }

  async function handleFullscreen() {
    const el = wrapperRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await el.requestFullscreen()
    } catch {
      toast.error('Полный экран недоступен')
    }
  }

  return (
    <div
      ref={wrapperRef}
      className={cn('relative h-full min-h-[480px] w-full overflow-hidden rounded-lg', className)}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDragStop={onNodeDragStop}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onMoveEnd={(_, vp) => {
          setZoomPercent(Math.round(vp.zoom * 100))
          if (hydrated.current && !locked) {
            onDocumentChange({ nodes, edges, viewport: vp })
          }
        }}
        nodeTypes={topologyNodeTypes}
        edgeTypes={topologyEdgeTypes}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        elementsSelectable={!locked}
        edgesReconnectable={!locked}
        deleteKeyCode={locked ? null : ['Backspace', 'Delete']}
        fitView
        colorMode={colorMode}
        defaultEdgeOptions={{
          type: 'topology',
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        }}
        proOptions={{ hideAttribution: true }}
        className="bg-muted/30 h-full"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
      </ReactFlow>

      <div className="pointer-events-auto absolute top-3 left-3 z-10">
        <TopologyPalette
          disabled={locked}
          onPickVps={() => setAddVpsOpen(true)}
          onPlaceItem={placeItemAtCenter}
        />
      </div>
      <div className="pointer-events-auto absolute bottom-3 left-3 z-10">
        <TopologyToolbar
          zoomPercent={zoomPercent}
          locked={locked}
          onZoomIn={() => void zoomIn()}
          onZoomOut={() => void zoomOut()}
          onFitView={() => void fitView({ padding: 0.2 })}
          onToggleLock={() => onLockedChange(!locked)}
          onFullscreen={() => void handleFullscreen()}
          onExport={() => void handleExport()}
        />
      </div>

      <AddVpsSheet
        open={addVpsOpen}
        onOpenChange={setAddVpsOpen}
        existingVpsIds={existingVpsIds}
        onAdd={handleAddVps}
      />
      <VpsDetailSheet
        vpsId={detailVpsId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <ElementEditSheet
        element={editElement}
        open={elementOpen}
        locked={locked}
        onOpenChange={setElementOpen}
        onSave={handleSaveElement}
      />
      <EdgeEditSheet
        edgeId={editEdgeId}
        data={editEdgeData}
        open={edgeOpen}
        locked={locked}
        onOpenChange={setEdgeOpen}
        onSave={handleSaveEdge}
      />
    </div>
  )
}

function normalizeEdges(edges: Edge[]): FlowEdge[] {
  return edges.map((edge) => {
    const data = { ...defaultEdgeData(), ...(edge.data as TopologyEdgeData | undefined) }
    return applyEdgeVisuals({ ...edge, data }, data)
  })
}

export function TopologyEditor(props: TopologyEditorProps) {
  return (
    <ReactFlowProvider>
      <TopologyEditorInner {...props} />
    </ReactFlowProvider>
  )
}
