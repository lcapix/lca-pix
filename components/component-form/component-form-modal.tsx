'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/lcapix';
import { ComponentForm, type ComponentFormInitialValues } from './component-form';

export interface ComponentFormModalProps {
  projectId: string;
  caseId: string;
  mode: 'create' | 'edit';
  initial?: ComponentFormInitialValues;
  suggestedParentId?: string | null;
  suggestedType?: string | null;
}

export function ComponentFormModal(props: ComponentFormModalProps) {
  const router = useRouter();
  const [mountNode, setMountNode] = React.useState<HTMLElement | null>(null);

  // Find the case-canvas host so we can portal the modal inside it (scoping the
  // dim backdrop to the canvas area and keeping sidebars/inspector visible).
  // Falls back to document.body when the host isn't present (e.g. direct URL
  // visits that don't render the case page).
  React.useEffect(() => {
    const host = document.getElementById('case-canvas-host');
    // Scope into the canvas only when it is tall enough to hold a usable
    // dialog. On short/stacked layouts the absolutely-positioned overlay
    // collapsed with its host to a ~40px strip (live-verified bug) — fall
    // back to a fixed full-viewport modal instead.
    const hostUsable = !!host && host.clientHeight >= 480;
    setMountNode(hostUsable ? host : document.body);
  }, []);

  const scoped = mountNode?.id === 'case-canvas-host';

  const close = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/project/${props.projectId}/case/${props.caseId}`);
    }
  }, [router, props.projectId, props.caseId]);

  // On successful create/edit: tell the case editor to re-fetch its component
  // list, THEN close the modal. Without this, the new node only appeared after
  // a full page reload (the editor fetches client-side once on mount and the
  // intercepting-route modal closing via router.back() doesn't re-trigger it).
  const handleSuccess = React.useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lcapix:components-changed'));
    }
    close();
  }, [close]);

  // Esc to dismiss.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  // Lock body scroll only for full-viewport fallback — when scoped to the
  // canvas host the surrounding page should stay interactive.
  React.useEffect(() => {
    if (scoped) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [scoped]);

  if (!mountNode) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={props.mode === 'edit' ? 'Edit component' : 'New component'}
      onMouseDown={(e) => {
        // Click on the dim backdrop (but not the card) → dismiss.
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: scoped ? 'absolute' : 'fixed',
        inset: 0,
        background: 'rgba(12, 20, 16, 0.55)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: scoped ? '20px 16px' : '48px 24px',
        zIndex: 200,
      }}
    >
      <div
        className="card"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 780,
          maxHeight: scoped ? '100%' : 'calc(100vh - 96px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 60,
            width: 32,
            height: 32,
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            background: 'var(--surface-raised)',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          <Icon name="x" size={14} />
        </button>

        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <ComponentForm
            {...props}
            variant="modal"
            onSuccess={handleSuccess}
            onCancel={close}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, mountNode);
}

export default ComponentFormModal;
