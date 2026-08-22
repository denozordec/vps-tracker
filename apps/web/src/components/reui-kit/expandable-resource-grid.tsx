import type { ReactNode } from 'react'

import {
  FrameDataGrid,
  type FrameDataGridProps,
} from './frame-data-grid'

/**
 * Frame + DataGrid with expandable rows.
 * Preview: https://reui.io/preview/base/components/c-data-grid-8
 * Docs: https://reui.io/docs/components/base/data-grid
 */
export function ExpandableResourceGrid<TData extends object>({
  expandedContent,
  getRowCanExpand,
  ...props
}: FrameDataGridProps<TData> & {
  expandedContent: (row: TData) => ReactNode
  getRowCanExpand?: (row: TData) => boolean
}) {
  return (
    <FrameDataGrid
      {...props}
      expandedContent={expandedContent}
      getRowCanExpand={getRowCanExpand}
    />
  )
}
