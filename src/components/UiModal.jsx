import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function UiModal({ open, title, onClose, size = 'modal-lg', footer, scrollable = false, children }) {
  useEffect(() => {
    if (!open) {
      return undefined
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  const modalNode = (
    <div
      className="ui-modal-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-backdrop fade show"
        style={{
          position: 'absolute',
          inset: 0,
        }}
        onClick={onClose}
      />
      <div
        className="modal modal-blur fade show d-block"
        tabIndex={-1}
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
        }}
      >
        <div className={`modal-dialog ${size} modal-dialog-centered`} role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div
              className="modal-body"
              style={scrollable ? { maxHeight: '60vh', overflowY: 'auto' } : undefined}
            >
              {children}
            </div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalNode, document.body)
}
