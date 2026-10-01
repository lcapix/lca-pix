'use client';

import { Sankey, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { fmtInt } from '@/components/lcapix';
import {
  isSankeyTableNode,
  type SankeyLink,
  type SankeyNode,
} from '@/lib/admin/integrations-schema';

/** Recharts `node` renderer: a bar plus the node's name to its right. */
function renderSankeyNode(sourceCount: number) {
  return (props: any) => {
    const isTable = isSankeyTableNode(props.payload, props.index, sourceCount);
    return (
      <g>
        <Rectangle
          x={props.x}
          y={props.y}
          width={props.width}
          height={props.height}
          fill={isTable ? '#52796f' : '#2d6a4f'}
          fillOpacity={0.9}
        />
        <text
          x={props.x + props.width + 8}
          y={props.y + props.height / 2}
          fontSize={12}
          fill="var(--text-secondary)"
          dominantBaseline="middle"
          fontFamily="var(--font-mono)"
        >
          {props.payload?.name}
        </text>
      </g>
    );
  };
}

/** Recharts Tooltip `content`: "source → table" + records for a link, the name for a node. */
function renderSankeyTooltip(nodes: SankeyNode[]) {
  return ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const p = payload[0].payload
    if (p?.source !== undefined && p?.target !== undefined) {
      return (
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
          }}
        >
          <div
            className="mono"
            style={{ marginBottom: 2 }}
          >
            {nodes[p.source]?.name} → {nodes[p.target]?.name}
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            {fmtInt(p.records ?? 0)} records
          </div>
        </div>
      )
    }
    if (p?.name) {
      return (
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
          }}
        >
          <div className="mono">{p.name}</div>
        </div>
      )
    }
    return null
  };
}

/** Sankey — the actual flow diagram (source → table). */
export function SchemaFlowSankey({
  nodes,
  links,
  sourceCount,
}: {
  nodes: SankeyNode[];
  links: SankeyLink[];
  sourceCount: number;
}) {
  return (
    <div className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 4,
        }}
      >
        Flow of records · source → table
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-tertiary)',
          marginBottom: 14,
        }}
      >
        Band width is proportional to the number of records that source has
        written. Greyed bands mean the pipeline is connected but empty.
      </div>
      <div style={{ width: '100%', height: 360 }}>
        <ResponsiveContainer>
          <Sankey
            data={{ nodes, links }}
            nodePadding={18}
            nodeWidth={14}
            linkCurvature={0.5}
            margin={{ top: 8, right: 140, bottom: 8, left: 8 }}
            node={renderSankeyNode(sourceCount)}
            link={{ stroke: '#74c69d' }}
          >
            <Tooltip content={renderSankeyTooltip(nodes)} />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
