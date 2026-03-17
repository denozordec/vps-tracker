/**
 * Tabler-style empty state for tables.
 * @see https://docs.tabler.io/docs/components/empty-states.html
 */
export function EmptyState({ message = 'Нет данных', colSpan = 10 }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-secondary text-center py-4">
        {message}
      </td>
    </tr>
  )
}
