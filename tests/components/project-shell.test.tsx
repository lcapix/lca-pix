// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProjectShell } from '@/components/project/project-shell';

describe('<ProjectShell>', () => {
  it('renders project name and children', () => {
    render(
      <ProjectShell projectName="EV Project" projectId={8}>
        <div>body</div>
      </ProjectShell>
    );
    expect(screen.getByText('EV Project')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('renders all 5 nav items', () => {
    render(
      <ProjectShell projectName="X" projectId={1}>
        <div />
      </ProjectShell>
    );
    ['Case Editor', 'Sustainability KPI', 'Life Cycle Analysis', 'System Logs', 'Team Access'].forEach(
      (label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
    );
  });

  it('highlights activeSection=kpi correctly', () => {
    render(
      <ProjectShell projectName="X" projectId={1} activeSection="kpi">
        <div />
      </ProjectShell>
    );
    const kpi = screen.getByText('Sustainability KPI').closest('a');
    expect(kpi?.className).toContain('veridian-gradient');
  });
});
