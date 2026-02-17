import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  it('should render the toolbar', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should render sticky note and rectangle buttons', () => {
    render(<Toolbar onAddStickyNote={vi.fn()} onAddRectangle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sticky note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rectangle/i })).toBeInTheDocument();
  });

  it('should call onAddStickyNote when sticky note button is clicked', async () => {
    const user = userEvent.setup();
    const mockAddStickyNote = vi.fn();
    render(<Toolbar onAddStickyNote={mockAddStickyNote} />);

    await user.click(screen.getByRole('button', { name: /sticky note/i }));
    expect(mockAddStickyNote).toHaveBeenCalled();
  });

  it('should call onAddRectangle when rectangle button is clicked', async () => {
    const user = userEvent.setup();
    const mockAddRectangle = vi.fn();
    render(<Toolbar onAddRectangle={mockAddRectangle} />);

    await user.click(screen.getByRole('button', { name: /rectangle/i }));
    expect(mockAddRectangle).toHaveBeenCalled();
  });
});
