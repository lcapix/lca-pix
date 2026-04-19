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
    // Name is rendered in both mobile + desktop rails; at least one should exist
    expect(screen.getAllByText('EV Project').length).toBeGreaterThan(0);
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
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      }
    );
  });

  it('highlights activeSection=kpi correctly', () => {
    render(
      <ProjectShell projectName="X" projectId={1} activeSection="kpi">
        <div />
      </ProjectShell>
    );
    // Active class should be applied to both mobile + desktop instances
    const instances = screen.getAllByText('Sustainability KPI');
    const active = instances.map((el) => el.closest('a')).find((a) => a?.className.includes('veridian-gradient'));
    expect(active).toBeTruthy();
  });
});
