'use client'

// Zoom controls overlay: −, the zoom level, +, Fit, and Reset (layout).
// Stops mousedown so a click never pans the canvas.

import type React from 'react'

export function ZoomControls({
  zoom,
  onZoomOut,
  onZoomIn,
  onFit,
  onReset,
}: {
  zoom: number
  onZoomOut: () => void
  onZoomIn: () => void
  onFit: () => void
  onReset: () => void
}) {
  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        zIndex: 5,
        display: 'flex',
        gap: 4,
        background: 'var(--surface-raised)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        padding: 4,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <button
        type="button"
        onClick={onZoomOut}
        style={zoomBtn}
        aria-label="Zoom out"
      >
        −
      </button>
      <div
        className="mono"
        style={{
          width: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'var(--text-secondary)',
        }}
      >
        {Math.round(zoom * 100)}%
      </div>
      <button
        type="button"
        onClick={onZoomIn}
        style={zoomBtn}
        aria-label="Zoom in"
      >
        +
      </button>
      <div style={{ width: 1, background: 'var(--border-subtle)', margin: '4px 2px' }} />
      <button
        type="button"
        onClick={onFit}
        style={{ ...zoomBtn, width: 'auto', padding: '0 10px', fontSize: 11 }}
        aria-label="Fit to view"
      >
        Fit
      </button>
      <button
        type="button"
        onClick={onReset}
        style={{ ...zoomBtn, width: 'auto', padding: '0 10px', fontSize: 11 }}
        aria-label="Reset layout"
      >
        Reset
      </button>
    </div>
  )
}

const zoomBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 14,
}
