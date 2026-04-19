import type React from 'react';

export interface AuthLayoutProps {
  /** Form markup shown on the left pane. */
  children: React.ReactNode;
  /** Visual pane shown on the right (hidden below lg). */
  rightPane?: React.ReactNode;
}

export function AuthLayout({ children, rightPane }: AuthLayoutProps) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,420px)_1fr] bg-background">
      {/* Left: form pane */}
      <div className="flex flex-col justify-between px-8 md:px-14 lg:px-12 py-10 lg:py-12 bg-background">
        <div className="flex-grow flex items-center">
          <div className="max-w-sm w-full mx-auto">{children}</div>
        </div>
      </div>

      {/* Right: editorial pane — hidden on small viewports */}
      <div className="hidden lg:block relative overflow-hidden bg-surface-container-low">
        {rightPane}
      </div>
    </div>
  );
}
