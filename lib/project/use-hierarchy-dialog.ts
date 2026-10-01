'use client'

// State of the project workspace's "View Full Hierarchy" dialog: the case and
// its raw component rows, search, collapsed nodes, zoom and pan.

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'

export function useHierarchyDialog() {
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false)
  const [modalComponents, setModalComponents] = useState<any[]>([])
  const [modalCase, setModalCase] = useState<any>(null)
  const [isLoadingModal, setIsLoadingModal] = useState(false)
  const [modalZoom, setModalZoom] = useState(100)
  const [modalPan, setModalPan] = useState({ x: 0, y: 0 })
  const [modalPanStart, setModalPanStart] = useState({ x: 0, y: 0 })
  const [isPanningModal, setIsPanningModal] = useState(false)
  const [modalSearchQuery, setModalSearchQuery] = useState('')
  const [modalExpandedNodes, setModalExpandedNodes] = useState<Set<number>>(new Set())
  const modalCanvasRef = useRef<HTMLDivElement>(null)

  // Opens the dialog and loads the case and its components.
  const openTreeModal = async (caseId: string) => {
    setIsLoadingModal(true)
    setIsTreeModalOpen(true)

    try {
      const caseResponse = await apiRequest(`/api/cases/${caseId}`)
      const caseData = await caseResponse.json()

      if (caseData.success && caseData.case) {
        setModalCase(caseData.case)
        const componentsResponse = await apiRequest(`/api/cases/${caseId}/components`)
        const componentsData = await componentsResponse.json()
        if (componentsData.success && componentsData.components) {
          setModalComponents(componentsData.components)
          setModalExpandedNodes(new Set())
        }
      }
    } catch (error) {
      console.error('Failed to fetch tree data:', error)
      toast.error('Error', { description: 'Failed to load tree visualization' })
    } finally {
      setIsLoadingModal(false)
    }
  }

  return {
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
    openTreeModal,
  }
}

/** The dialog's state and actions, as the dialog component receives them. */
export type HierarchyDialogState = ReturnType<typeof useHierarchyDialog>
