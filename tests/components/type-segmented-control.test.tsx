// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  TypeSegmentedControl,
  TYPE_OPTIONS,
} from '@/components/component-form/type-segmented-control';

describe('<TypeSegmentedControl>', () => {
  it('renders one button per LCAPIX process type', () => {
    render(<TypeSegmentedControl value="" onChange={() => {}} />);
    // 5 canonical types in the Veridian design
    expect(TYPE_OPTIONS).toHaveLength(5);
    for (const opt of TYPE_OPTIONS) {
      expect(screen.getByRole('radio', { name: opt.label })).toBeInTheDocument();
    }
  });

  it('marks the currently-selected option with aria-checked=true', () => {
    render(<TypeSegmentedControl value="operation" onChange={() => {}} />);
    const op = screen.getByRole('radio', { name: 'Operation' });
    expect(op).toHaveAttribute('aria-checked', 'true');
    expect(op).toHaveAttribute('data-state', 'on');

    const product = screen.getByRole('radio', { name: 'Product' });
    expect(product).toHaveAttribute('aria-checked', 'false');
  });

  it('invokes onChange with the clicked value', () => {
    const onChange = vi.fn();
    render(<TypeSegmentedControl value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Elemental' }));
    expect(onChange).toHaveBeenCalledWith('elemental');
  });

  it('disables every option when the control is disabled', () => {
    const onChange = vi.fn();
    render(<TypeSegmentedControl value="" onChange={onChange} disabled />);
    for (const opt of TYPE_OPTIONS) {
      const btn = screen.getByRole('radio', { name: opt.label });
      expect(btn).toBeDisabled();
    }
    fireEvent.click(screen.getByRole('radio', { name: 'Product' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('disables only the types listed in disabledTypes', () => {
    render(
      <TypeSegmentedControl
        value=""
        onChange={() => {}}
        disabledTypes={['product', 'machine']}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Product' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Machine/Line' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Subprocess' })).not.toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Elemental' })).not.toBeDisabled();
  });

  it('exposes a radiogroup with the supplied label', () => {
    render(
      <TypeSegmentedControl value="" onChange={() => {}} label="Process tier" />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Process tier' })).toBeInTheDocument();
  });
});
