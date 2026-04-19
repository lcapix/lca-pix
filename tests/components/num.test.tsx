// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Num } from '@/components/ui/num';

describe('<Num>', () => {
  it('renders a numeric value formatted with locale separators', () => {
    render(<Num value={126.82} />);
    expect(screen.getByText('126.82')).toBeInTheDocument();
  });

  it('applies the .num class so tabular monospace font kicks in', () => {
    const { container } = render(<Num value={42} />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('num');
  });

  it('formats large integers with thousands separators by default', () => {
    render(<Num value={1420500} />);
    expect(screen.getByText('1,420,500')).toBeInTheDocument();
  });

  it('respects the precision option', () => {
    render(<Num value={0.123456} precision={2} />);
    expect(screen.getByText('0.12')).toBeInTheDocument();
  });

  it('appends a unit when provided', () => {
    render(<Num value={42} unit="kg CO2-eq" />);
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('kg CO2-eq')).toBeInTheDocument();
  });

  it('renders an em-dash placeholder when value is null', () => {
    render(<Num value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders an em-dash placeholder when value is undefined', () => {
    render(<Num value={undefined} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders the raw string when value is non-numeric text', () => {
    render(<Num value="N/A" />);
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('coerces numeric strings to numbers before formatting', () => {
    render(<Num value="1234.5" precision={1} />);
    expect(screen.getByText('1,234.5')).toBeInTheDocument();
  });

  it('accepts a custom className', () => {
    const { container } = render(<Num value={1} className="text-primary" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('num');
    expect(el.className).toContain('text-primary');
  });
});
