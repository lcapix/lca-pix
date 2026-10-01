'use client'

// "View Full Hierarchy" dialog — preserved verbatim from the prior page:
// search, collapse/expand all, zoom (30–200 %), pan by dragging.

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Network, Search, Minimize2, Maximize2, ZoomIn, ZoomOut, Focus } from 'lucide-react'
import type { HierarchyDialogState } from '@/lib/project/use-hierarchy-dialog'
import { countMatches, stepZoom, toggleAllCollapsed } from '@/lib/project/hierarchy-chart'
import { HierarchyFlowChart } from './hierarchy-flow-chart'

export function HierarchyDialog({ state }: { state: HierarchyDialogState }) {
  const {
    isTreeModalOpen,
    setIsTreeModalOpen,
    modalComponents,
    modalCase,
    isLoadingModal,
    modalZoom,
    setModalZoom,
    modalPan,
    setModalPan,
    modalPanStart,
    setModalPanStart,
    isPanningModal,
    setIsPanningModal,
    modalSearchQuery,
    setModalSearchQuery,
    modalExpandedNodes,
    setModalExpandedNodes,
    modalCanvasRef,
  } = state
  return (
    <Dialog open={isTreeModalOpen} onOpenChange={setIsTreeModalOpen}>
      <DialogContent
        className="!max-w-[88vw] !w-[88vw] !h-[82vh] flex flex-col p-0 gap-0 my-[9vh]"
        showCloseButton={false}
      >
        <DialogHeader className="px-5 py-2.5 glass-panel shadow-botanical border-b border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Network className="h-4 w-4 text-primary" />
              <DialogTitle className="text-sm font-medium text-on-surface font-['Inter_Tight',Inter,sans-serif] tracking-tight">
                Process Hierarchy — {modalCase?.case_name || 'Loading...'}
              </DialogTitle>
              <Badge
                variant="outline"
                className="text-[10px] font-mono uppercase tracking-[0.12em] border-outline-variant/40 bg-surface-container-low text-on-surface-variant"
              >
                {modalComponents.length} components
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-outline" />
                <Input
                  type="text"
                  placeholder="SEARCH COMPONENTS..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="pl-9 h-8 w-52 text-xs bg-surface-container-low border-0 border-b border-outline-variant/40 rounded-none focus-visible:ring-0 focus-visible:border-primary font-mono text-xs placeholder:opacity-50 placeholder:uppercase placeholder:tracking-[0.12em]"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setModalExpandedNodes(toggleAllCollapsed(modalComponents, modalExpandedNodes))}
                className="h-8 text-xs border-outline-variant/40 bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                {modalExpandedNodes.size === 0 ? (
                  <>
                    <Minimize2 className="h-4 w-4 mr-1" />
                    Collapse All
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-4 w-4 mr-1" />
                    Expand All
                  </>
                )}
              </Button>
              <div className="flex items-center gap-1 border border-outline-variant/40 rounded-md bg-surface-container-lowest">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalZoom(stepZoom(modalZoom, -5))}
                  className="h-8 px-2 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono tabular-nums px-2 text-on-surface-variant min-w-[50px] text-center">
                  {modalZoom}%
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalZoom(stepZoom(modalZoom, 5))}
                  className="h-8 px-2 text-on-surface-variant hover:bg-surface-container-high"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalZoom(100)
                  setModalPan({ x: 0, y: 0 })
                }}
                className="h-8 text-xs border-outline-variant/40 bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                <Focus className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTreeModalOpen(false)}
                className="h-8 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden bg-surface">
          {isLoadingModal ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-sm text-on-surface-variant font-mono uppercase tracking-[0.12em]">
                  Loading tree visualization...
                </p>
              </div>
            </div>
          ) : modalComponents.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Network className="h-16 w-16 text-outline-variant mx-auto mb-4" />
                <p className="text-lg font-medium text-on-surface mb-2 font-['Inter_Tight',Inter,sans-serif] tracking-tight">
                  No components yet
                </p>
                <p className="text-sm text-on-surface-variant">
                  Add components to build your process hierarchy
                </p>
              </div>
            </div>
          ) : (
            <div
              ref={modalCanvasRef}
              className={`absolute inset-0 overflow-auto ${
                isPanningModal ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(188, 202, 191, 0.5) 1px, transparent 0)',
                backgroundSize: '32px 32px',
                backgroundColor: '#f8faf8',
                overscrollBehavior: 'none',
              }}
              onWheel={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  const delta = e.deltaY > 0 ? -5 : 5
                  setModalZoom((prev) => stepZoom(prev, delta))
                }
              }}
              onMouseDown={(e) => {
                if (e.button === 0) {
                  setIsPanningModal(true)
                  setModalPanStart({
                    x: e.clientX - modalPan.x,
                    y: e.clientY - modalPan.y,
                  })
                }
              }}
              onMouseMove={(e) => {
                if (isPanningModal) {
                  setModalPan({
                    x: e.clientX - modalPanStart.x,
                    y: e.clientY - modalPanStart.y,
                  })
                }
              }}
              onMouseUp={() => setIsPanningModal(false)}
              onMouseLeave={() => setIsPanningModal(false)}
            >
              <div
                style={{
                  minWidth: '100%',
                  minHeight: '100%',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  padding: '48px 48px 96px',
                  boxSizing: 'border-box',
                }}
              >
                <div
                  style={{ marginLeft: modalPan.x, marginTop: modalPan.y }}
                >
                  <div
                    className="transform-gpu transition-transform duration-100"
                    style={{
                      transform: `scale(${modalZoom / 100})`,
                      transformOrigin: 'top center',
                    }}
                  >
                    <HierarchyFlowChart components={modalComponents} searchQuery={modalSearchQuery} collapsed={modalExpandedNodes} setCollapsed={setModalExpandedNodes} />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-3 left-3 text-[10px] font-mono uppercase tracking-[0.12em] text-on-surface-variant/60 glass-panel px-2 py-1 rounded-md border border-outline-variant/10">
                Scroll to pan · Ctrl+Scroll to zoom · Drag to move
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-2.5 border-t bg-slate-50 flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-4">
            <span>
              <span className="font-medium">{modalComponents.length}</span>{' '}
              components
            </span>
            {modalSearchQuery && (
              <span>
                <span className="font-medium">
                  {countMatches(modalComponents, modalSearchQuery)}
                </span>{' '}
                matching &ldquo;{modalSearchQuery}&rdquo;
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <span>Drag to pan • Scroll to zoom • Click nodes to expand/collapse</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
