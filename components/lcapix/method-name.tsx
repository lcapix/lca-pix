import React from 'react';

/**
 * Renders a string while preserving the canonical "ReCiPe" capitalization
 * even when the surrounding context applies `text-transform: uppercase`
 * (or Tailwind's `uppercase` utility). All other characters render normally
 * so the parent's uppercase styling still applies to them.
 *
 * Usage: <MethodName value="ReCiPe Midpoint (H)" />
 */
export function MethodName({
  value,
  className,
  style,
}: {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (!value) return null;
  const parts = value.split(/(ReCiPe)/g);
  return (
    <span className={className} style={style}>
      {parts.map((part, i) =>
        part === 'ReCiPe' ? (
          <span key={i} style={{ textTransform: 'none' }}>
            ReCiPe
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}

export default MethodName;
