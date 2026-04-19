// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LcapixWordmark } from '@/components/brand/lcapix-wordmark';

describe('<LcapixWordmark>', () => {
  it('renders the LCAPIX text', () => {
    render(<LcapixWordmark />);
    expect(screen.getByText('LCAPIX')).toBeInTheDocument();
  });

  it('applies the small size class when size="sm"', () => {
    const { container } = render(<LcapixWordmark size="sm" />);
    const wordmark = container.querySelector('span');
    expect(wordmark?.className).toContain('text-base');
  });

  it('applies the large size class when size="lg"', () => {
    const { container } = render(<LcapixWordmark size="lg" />);
    const wordmark = container.querySelector('span');
    expect(wordmark?.className).toContain('text-2xl');
  });

  it('defaults to medium size', () => {
    const { container } = render(<LcapixWordmark />);
    const wordmark = container.querySelector('span');
    expect(wordmark?.className).toContain('text-xl');
  });

  it('renders an optional subtitle in monospace uppercase', () => {
    render(<LcapixWordmark subtitle="SUSTAINABILITY SUITE" />);
    const sub = screen.getByText('SUSTAINABILITY SUITE');
    expect(sub).toBeInTheDocument();
    expect(sub.className).toContain('font-mono');
    expect(sub.className).toContain('uppercase');
  });

  it('wraps in a Next.js link when href is provided', () => {
    render(<LcapixWordmark href="/home" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/home');
  });

  it('does not wrap in a link when href is omitted', () => {
    render(<LcapixWordmark />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('uses emerald primary text color by default', () => {
    const { container } = render(<LcapixWordmark />);
    const wordmark = container.querySelector('span');
    expect(wordmark?.className).toContain('text-primary');
  });

  it('uses inverted (on-primary) text color when variant="inverted"', () => {
    const { container } = render(<LcapixWordmark variant="inverted" />);
    const wordmark = container.querySelector('span');
    expect(wordmark?.className).toContain('text-on-primary');
  });

  it('applies custom className to the root container', () => {
    const { container } = render(<LcapixWordmark className="custom-anchor" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('custom-anchor');
  });
});
