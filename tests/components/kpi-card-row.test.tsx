// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { KpiCardRow } from '@/components/dashboard/kpi-card-row';

describe('<KpiCardRow>', () => {
  it('renders all kpis', () => {
    render(<KpiCardRow kpis={[
      { label: 'Projects', value: 24 },
      { label: 'Assessments', value: 158 },
      { label: 'Factors', value: 1042 },
      { label: 'Components', value: 42 },
    ]} />);
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Assessments')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.getByText('1,042')).toBeInTheDocument();
  });

  it('shows a delta chip with up arrow by default', () => {
    render(<KpiCardRow kpis={[{ label: 'Projects', value: 24, delta: '+2 this week' }]} />);
    expect(screen.getByText('+2 this week')).toBeInTheDocument();
  });
});
