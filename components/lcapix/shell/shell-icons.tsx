// The shell's icons: 24-unit strokes in currentColor, decorative (aria-hidden).

import type { ReactElement } from 'react'

const paths: Record<string, ReactElement> = {
  home: <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  pin: (
    <>
      <path d="M12 21s-6-5.4-6-11a6 6 0 1 1 12 0c0 5.6-6 11-6 11z" />
      <circle cx="12" cy="10" r="2.2" />
    </>
  ),
  report: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M10 12h5M10 16h5" />
    </>
  ),
  analytics: <path d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />,
  grid: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2.1-2.4 3.6M12 17.2v.3" />
    </>
  ),
  updown: <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  out: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
}

export function ShellIcon({ name, size = 18 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {paths[name] ?? null}
    </svg>
  )
}

/** The six-pixel mark on a dark tile (sidebar.md 1). */
export function PixelMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden focusable="false">
      <rect width="30" height="30" rx="8" fill="#141816" />
      {[
        [13, 6],
        [9, 12],
        [17, 12],
        [6, 18],
        [13, 18],
        [20, 18],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="4.5" height="4.5" rx="1" fill={i === 5 ? '#5DDDA1' : '#fff'} />
      ))}
    </svg>
  )
}

/** The guide face used for Guided mode. */
export function GuideFace({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden focusable="false">
      <rect width="22" height="22" rx="6" fill="#141816" />
      <rect x="6" y="8" width="3" height="3" rx="0.8" fill="#fff" />
      <rect x="13" y="8" width="3" height="3" rx="0.8" fill="#fff" />
      <rect x="8" y="14" width="6" height="1.6" rx="0.8" fill="#5DDDA1" />
    </svg>
  )
}
