import { useEffect, useMemo, useState } from 'react'
import { fetchProjectSuggestions } from '../lib/api'

/**
 * Поле ввода проекта с datalist: подсказки из БД при вводе + локальный кэш serverProjects.
 * Новое имя сохранится на сервере при сохранении VPS (resolve-or-create).
 */
export function ProjectSuggestInput({
  value,
  onChange,
  serverProjects = [],
  id,
  className = 'form-control',
  placeholder,
  disabled,
  'aria-label': ariaLabel,
}) {
  const [remoteNames, setRemoteNames] = useState([])
  const listId = id ? `${id}-project-datalist` : 'project-datalist'

  useEffect(() => {
    const q = (value || '').trim()
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const rows = await fetchProjectSuggestions(q, 25)
        if (!cancelled) {
          setRemoteNames((rows || []).map((r) => r.name).filter(Boolean))
        }
      } catch {
        if (!cancelled) setRemoteNames([])
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [value])

  const localNames = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    const list = Array.isArray(serverProjects) ? serverProjects : []
    if (!q) {
      return list.slice(0, 30).map((p) => p.name)
    }
    return list
      .filter((p) => (p.name || '').toLowerCase().includes(q))
      .slice(0, 20)
      .map((p) => p.name)
  }, [serverProjects, value])

  const merged = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const n of [...localNames, ...remoteNames]) {
      if (!n || seen.has(n)) continue
      seen.add(n)
      out.push(n)
      if (out.length >= 45) break
    }
    return out
  }, [localNames, remoteNames])

  return (
    <>
      <input
        id={id}
        type="text"
        className={className}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        aria-label={ariaLabel}
      />
      <datalist id={listId}>
        {merged.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  )
}
