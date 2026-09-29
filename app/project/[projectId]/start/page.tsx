'use client'

/**
 * Two ways into a new project, offered as equals.
 *
 * Landing straight on Import taught that an LCA starts with a file, which is
 * wrong for a course: a student has to be able to build the model by hand, one
 * step and one flow at a time, and see for themselves what each entry does.
 * The other path reads a real document and fills the same model, and the
 * teaching moment we own is doing both for one product and comparing them.
 */

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { apiRequest } from '@/lib/api-client'
import { Icon } from '@/components/lcapix'

export default function StartPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = String(params.projectId)
  const [creating, setCreating] = useState(false)

  const buildByHand = async () => {
    setCreating(true)
    try {
      // A name that will not clash on the first try, and says what it is.
      const res = await apiRequest(`/api/projects/${projectId}/cases`, {
        method: 'POST',
        body: JSON.stringify({
          case_name: 'Base case',
          case_type: 'base',
          description: 'Built by hand',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.case) {
        // 409 means the name is taken: send them to the project to name it.
        toast.error(data?.error || 'Could not create the case')
        if (res.status === 409) router.push(`/project/${projectId}`)
        return
      }
      // Open the editor with the lesson rail and the reference pane ready.
      router.push(`/project/${projectId}/case/${data.case.case_id}?learn=1`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not create the case')
    } finally {
      setCreating(false)
    }
  }

  const card: React.CSSProperties = {
    flex: '1 1 320px',
    minWidth: 300,
    border: '1px solid var(--border-subtle)',
    borderRadius: 14,
    background: 'var(--surface-raised)',
    padding: 22,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 20px' }}>
      <h1 style={{ fontSize: 22, fontWeight: 680, margin: '0 0 6px', color: 'var(--text-primary)' }}>
        How do you want to start?
      </h1>
      <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', margin: '0 0 26px' }}>
        Both paths build the same model: a product, the steps that make it, and the inputs and
        outputs of each step. You can use one, then the other, and compare them.
      </p>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="edit" size={16} />
            <h2 style={{ fontSize: 15.5, fontWeight: 660, margin: 0, color: 'var(--text-primary)' }}>
              Build it by hand
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
            Start from an empty case and add the steps and flows yourself. Five short lessons walk
            the ISO phases with you, and the reference pane keeps a document open beside the editor
            so you can read your quantities off it.
          </p>
          <ul
            style={{
              margin: '4px 0 0',
              paddingLeft: 18,
              fontSize: 12.5,
              color: 'var(--text-tertiary)',
              lineHeight: 1.7,
            }}
          >
            <li>You decide every step and every quantity</li>
            <li>Best for learning what each entry changes</li>
          </ul>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={buildByHand}
            disabled={creating}
            style={{ alignSelf: 'flex-start', marginTop: 10 }}
          >
            {creating ? 'Creating…' : 'Start an empty case'}
          </button>
        </section>

        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="file" size={16} />
            <h2 style={{ fontSize: 15.5, fontWeight: 660, margin: 0, color: 'var(--text-primary)' }}>
              Start from documents
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
            Upload a routing, a bill of materials or an equipment list. Every line it reads is shown
            for review before anything is written, and the document stays with the case so you can
            check a flow against the line it came from.
          </p>
          <ul
            style={{
              margin: '4px 0 0',
              paddingLeft: 18,
              fontSize: 12.5,
              color: 'var(--text-tertiary)',
              lineHeight: 1.7,
            }}
          >
            <li>Sample documents included if you have none</li>
            <li>Best when the plant's paperwork already exists</li>
          </ul>
          <div style={{ flex: 1 }} />
          <Link
            href={`/project/${projectId}/import?first=1`}
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start', marginTop: 10 }}
          >
            Choose a document
          </Link>
        </section>
      </div>

      <div style={{ marginTop: 24, fontSize: 12.5, color: 'var(--text-tertiary)' }}>
        Not sure yet?{' '}
        <Link href={`/project/${projectId}`} style={{ color: 'var(--text-secondary)' }}>
          Open the project
        </Link>{' '}
        and decide later.
      </div>
    </div>
  )
}
