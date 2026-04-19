// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AuthLayout } from '@/components/auth/auth-layout';

describe('<AuthLayout>', () => {
  it('renders children in the left pane', () => {
    render(<AuthLayout><div>form content</div></AuthLayout>);
    expect(screen.getByText('form content')).toBeInTheDocument();
  });

  it('renders the right pane when provided', () => {
    render(<AuthLayout rightPane={<div>editorial art</div>}><div>form</div></AuthLayout>);
    expect(screen.getByText('editorial art')).toBeInTheDocument();
  });

  it('does not render right-pane wrapper content when not provided', () => {
    const { container } = render(<AuthLayout><div>only form</div></AuthLayout>);
    expect(container.querySelector('.lg\\:block')?.textContent).toBe('');
  });
});
