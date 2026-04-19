// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from '@/components/layout/app-shell';

describe('<AppShell>', () => {
  it('renders the LCAPIX wordmark linking to /home', () => {
    render(<AppShell><div /></AppShell>);
    const link = screen.getAllByRole('link').find(a => a.getAttribute('href') === '/home');
    expect(link).toBeTruthy();
  });

  it('renders the primary nav links', () => {
    render(<AppShell><div /></AppShell>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Integrations')).toBeInTheDocument();
    expect(screen.getByText('Docs')).toBeInTheDocument();
  });

  it('renders children in the main region', () => {
    render(<AppShell><div data-testid="page-body">body</div></AppShell>);
    expect(screen.getByTestId('page-body')).toBeInTheDocument();
  });

  it('highlights the current nav link when activeHref matches', () => {
    render(<AppShell activeHref="/admin/integrations"><div /></AppShell>);
    const integ = screen.getByText('Integrations').closest('a');
    expect(integ?.className).toContain('text-primary');
  });
});
