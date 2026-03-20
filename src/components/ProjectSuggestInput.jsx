import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconFolder } from '@tabler/icons-react'
import { fetchProjectSuggestions } from '../lib/api'
import { noBrowserSuggestProps } from '../lib/noBrowserSuggestProps'

function highlightMatch(text, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return text
  const lower = text.toLowerCase()
  const idx = lower.indexOf(q)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="project-suggest-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

/**
 * Поле проекта с выпадающими подсказками в стиле Tabler (list-group + dropdown-menu).
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
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const wrapRef = useRef(null)
  const listId = id ? `${id}-project-suggest-list` : 'project-suggest-list'

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

  useEffect(() => {
    setActiveIndex(-1)
  }, [merged, value])

  useEffect(() => {
    if (!open) return undefined
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  const pick = useCallback(
    (name) => {
      onChange(name)
      setOpen(false)
      setActiveIndex(-1)
    },
    [onChange],
  )

  const onKeyDown = (e) => {
    if (disabled) return
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && merged.length > 0) {
      setOpen(true)
      setActiveIndex(e.key === 'ArrowDown' ? 0 : merged.length - 1)
      e.preventDefault()
      return
    }
    if (!open) return

    if (e.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => (merged.length ? (i < merged.length - 1 ? i + 1 : 0) : -1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => (merged.length ? (i > 0 ? i - 1 : merged.length - 1) : -1))
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0 && merged[activeIndex]) {
      e.preventDefault()
      pick(merged[activeIndex])
    }
  }

  const showPanel = open && !disabled && (merged.length > 0 || (value || '').trim().length > 0)
  const queryTrim = (value || '').trim()

  return (
    <div ref={wrapRef} className="position-relative project-suggest-wrap">
      <input
        {...noBrowserSuggestProps}
        id={id}
        type="text"
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
        aria-label={ariaLabel}
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        role="combobox"
      />
      {showPanel ? (
        <div
          id={listId}
          className="dropdown-menu show shadow-lg border rounded-2 project-suggest-panel"
          role="listbox"
        >
          {merged.length > 0 ? (
            <div className="list-group list-group-flush list-group-hoverable project-suggest-scroll">
              {merged.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={`list-group-item list-group-item-action d-flex align-items-center gap-2 py-2 px-3 rounded-0 text-start ${
                    idx === activeIndex ? 'active' : ''
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(name)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <span className="text-secondary project-suggest-folder">
                    <IconFolder size={18} stroke={1.5} />
                  </span>
                  <span className="text-truncate">{highlightMatch(name, value)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-3 text-secondary small">
              Совпадений нет — при сохранении VPS будет создан проект «{queryTrim}».
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
