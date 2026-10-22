'use client';

/**
 * <ComponentForm> — LCAPIX editorial redesign (Phase LH).
 *
 * Drives both the "new" and "edit" component pages. The state model, handler
 * shape, validation rules, and store-mutation contract are preserved from the
 * prior Veridian implementation and from the original route handlers. ONLY
 * the visual wrapper has changed — no API routes, store actions, field names,
 * or onSubmit signature have been altered.
 *
 * Visual reference: LCAPIX/pages-misc.jsx → function ComponentFormPage().
 * Uses the design-system CSS at app/lcapix.css (.card, .input, .label,
 * .btn, .chip, .eyebrow, .display-md, .title, .body, .mono, .glass).
 *
 * Composition only: state, validation and submit are in
 * lib/case-editor/use-component-form (pure parts in component-form-model);
 * each section is its own file in this folder.
 *
 * NOTE: <AuthGuard> and <AppTopBar> are provided by app/project/layout.tsx;
 * this component only renders the Breadcrumb + page body + sticky action bar.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { buildBreadcrumbPath } from '@/lib/hierarchy';
import type { ComponentFormInitialValues } from '@/lib/case-editor/component-form-model';
import { useComponentForm } from '@/lib/case-editor/use-component-form';

import { Breadcrumb, Icon } from '@/components/lcapix';

import { TypePlacementSection } from './type-placement-section';
import { IdentitySection } from './identity-section';
import { DriversSection } from './drivers-section';
import { CostsSection } from './costs-section';
import { AdvancedSection } from './advanced-section';
import { FormActionBar } from './form-action-bar';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type { ComponentFormInitialValues } from '@/lib/case-editor/component-form-model';

export interface ComponentFormProps {
  projectId: string;
  caseId: string;
  /** Pre-fill for edit mode or add-child mode. */
  initial?: ComponentFormInitialValues;
  /** Flips copy + primary CTA label + submit path. */
  mode: 'create' | 'edit';
  /** Honoured in create-mode only: locks processType+parentId. */
  suggestedParentId?: string | null;
  suggestedType?: string | null;
  /** Modal variant: skips breadcrumb + outer vertical padding; sticky action bar
   *  sits inside the scrolling parent instead of the viewport. */
  variant?: 'page' | 'modal';
  /** Called on successful submit; if omitted, form navigates back to the case. */
  onSuccess?: () => void;
  /** Called when the user hits Cancel; if omitted, `router.back()` is used. */
  onCancel?: () => void;
}

/* ------------------------------------------------------------------ */
/* Main form                                                           */
/* ------------------------------------------------------------------ */

export function ComponentForm({
  projectId, caseId, initial, mode, suggestedParentId, suggestedType,
  variant = 'page', onSuccess, onCancel,
}: ComponentFormProps) {
  const isModal = variant === 'modal';
  const router = useRouter();
  const form = useComponentForm({
    projectId,
    caseId,
    initial,
    mode,
    suggestedParentId,
    suggestedType,
    onSuccess,
    router,
  });
  const {
    isEditMode,
    formData,
    project,
    currentCase,
    processNodes,
    isAddChildMode,
    suggestedParent,
    handleSubmit,
    isFormValid,
    isSubmitting,
  } = form;

  const showDriversSection = formData.processType === 'elemental';

  /* ------- breadcrumb items ------- */
  const breadcrumbItems = [
    { label: 'Projects', page: 'home' },
    {
      label: project?.name || 'Project',
      onClick: () => router.push(`/project/${projectId}`),
    },
    {
      label: currentCase?.name || 'Case',
      onClick: () => router.push(`/project/${projectId}/case/${caseId}`),
    },
    { label: isEditMode ? 'Edit Component' : 'New Component' },
  ];

  /* ------- render ------- */
  return (
    <>
      {!isModal && <Breadcrumb items={breadcrumbItems} />}

      <div
        style={
          isModal
            ? { padding: '24px 28px 96px' }
            : { maxWidth: 720, margin: '0 auto', padding: '32px 24px 120px' }
        }
      >
        <h1
          className="display-md"
          style={{ margin: 0, marginBottom: 8, fontSize: 26, fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          {isEditMode ? 'Edit Component' : 'New Component'}
        </h1>
        <p className="body" style={{ margin: 0, marginBottom: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
          {isEditMode
            ? `Update this node in the process hierarchy for ${currentCase?.name ?? 'this case'}.`
            : `Add a new node to the process hierarchy for ${currentCase?.name ?? 'this case'}.`}
        </p>

        {isAddChildMode && suggestedParent && (
          <div
            className="chip chip-active"
            style={{ marginBottom: 16, padding: '8px 14px', fontSize: 12 }}
          >
            <Icon name="chevron-right" size={12} />
            Adding child to: {buildBreadcrumbPath(suggestedParent, processNodes)} / {suggestedParent.name}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* ---------------- Section 1: Type & Placement ---------------- */}
          <TypePlacementSection form={form} />

          {/* ---------------- Section 2: Identity ---------------- */}
          <IdentitySection form={form} />

          {/* ---------------- Section 3: Drivers (elemental only) ---------------- */}
          {showDriversSection && <DriversSection form={form} />}

          {/* ---------------- Section 4: Costs (collapsed) ---------------- */}
          <CostsSection form={form} />

          {/* ---------------- Section 5: Advanced (collapsed) ---------------- */}
          <AdvancedSection form={form} />
        </form>
      </div>

      {/* Sticky action bar */}
      <FormActionBar
        isModal={isModal}
        isEditMode={isEditMode}
        isFormValid={isFormValid}
        isSubmitting={isSubmitting}
        onCancel={() => (onCancel ? onCancel() : router.back())}
        onSubmit={() => handleSubmit()}
      />
    </>
  );
}

export default ComponentForm;
