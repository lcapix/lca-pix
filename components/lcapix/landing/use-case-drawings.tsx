import type { ReactElement } from 'react'

// The landing's six use-case drawings (F1.1): plain line drawings in the
// manner of a technical sheet, one per kind of product. Decorative; each
// figure's caption says what it is.

export type DrawingKind = 'metal' | 'electronics' | 'packaging' | 'building' | 'food' | 'energy'

const S = { fill: 'none', stroke: '#3f4a44', strokeWidth: 1.6, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const T = { ...S, stroke: '#8a948e', strokeDasharray: '4 4' }

export function UseCaseDrawing({ kind }: { kind: DrawingKind }) {
  return (
    <svg className="lp-fig" viewBox="0 0 300 200" aria-hidden focusable="false">
      <defs>
        <pattern id={`grid-${kind}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.9" fill="#d5dbd7" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="300" height="200" fill={`url(#grid-${kind})`} />
      <rect x="8" y="8" width="284" height="184" fill="none" stroke="#c9d0cb" />
      {DRAW[kind]}
      <line x1="8" y1="176" x2="292" y2="176" stroke="#c9d0cb" />
    </svg>
  )
}

const DRAW: Record<DrawingKind, ReactElement> = {
  // An L-bracket in isometric with its bolt holes and a cut line.
  metal: (
    <g>
      <path d="M80 120 L150 150 L230 110 L160 80 Z" {...S} />
      <path d="M80 120 L80 135 L150 165 L230 125 L230 110" {...S} />
      <path d="M160 80 L160 30 L230 60 L230 110" {...S} />
      <path d="M150 150 L150 165" {...S} />
      <ellipse cx="195" cy="62" rx="8" ry="5" {...S} />
      <ellipse cx="140" cy="118" rx="9" ry="5" {...S} />
      <path d="M60 140 L250 60" {...T} />
    </g>
  ),
  // An enclosure, lid lifted, with a board inside.
  electronics: (
    <g>
      <path d="M70 120 L150 150 L230 120 L150 90 Z" {...S} />
      <path d="M70 120 L70 140 L150 170 L230 140 L230 120" {...S} />
      <path d="M150 150 L150 170" {...S} />
      <path d="M95 118 L150 138 L205 118 L150 98 Z" {...S} />
      <path d="M120 116 L135 122 M150 108 L175 117 M130 110 L140 106" {...S} />
      <path d="M70 70 L150 100 L230 70 L150 40 Z" {...S} />
      <path d="M150 100 L150 112" {...T} />
    </g>
  ),
  // A carton's dieline, flat, with its folds dashed.
  packaging: (
    <g>
      <rect x="60" y="70" width="180" height="60" {...S} />
      <path d="M105 70 V130 M150 70 V130 M195 70 V130" {...T} />
      <path d="M60 70 L68 50 H97 L105 70 M150 70 L158 50 H187 L195 70" {...S} />
      <path d="M60 130 L68 150 H97 L105 130 M150 130 L158 150 H187 L195 130" {...S} />
      <path d="M240 75 L255 80 V120 L240 125" {...S} />
    </g>
  ),
  // A house section with its wall and roof layers.
  building: (
    <g>
      <path d="M80 160 V95 L150 45 L220 95 V160" {...S} />
      <path d="M90 160 V100 L150 57 L210 100 V160" {...S} />
      <path d="M100 160 V105 L150 69 L200 105 V160" {...T} />
      <rect x="135" y="120" width="30" height="40" {...S} />
      <path d="M60 160 H240" {...S} />
    </g>
  ),
  // A cup and a bottle on one base line.
  food: (
    <g>
      <path d="M85 80 L95 160 H135 L145 80 Z" {...S} />
      <path d="M82 80 H148 M88 96 H142" {...S} />
      <path d="M195 160 V95 Q195 82 205 78 V55 H215 V78 Q225 82 225 95 V160 Z" {...S} />
      <path d="M195 120 H225" {...T} />
      <path d="M70 160 H240" {...S} />
    </g>
  ),
  // A battery pack: a grid of cells in a housing.
  energy: (
    <g>
      <rect x="70" y="60" width="160" height="100" rx="6" {...S} />
      {[0, 1, 2, 3, 4].map((c) =>
        [0, 1, 2].map((r) => <circle key={`${c}-${r}`} cx={95 + c * 27} cy={85 + r * 26} r="10" {...S} />),
      )}
      <path d="M230 90 H250 M230 130 H250" {...S} />
      <path d="M60 50 L240 170" {...T} />
    </g>
  ),
}
