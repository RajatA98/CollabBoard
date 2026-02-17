import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  it('should render the toolbar', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should render sticky note button', () => {
    render(<Toolbar onToolChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sticky/i })).toBeInTheDocument();
  });

  it('should render rectangle button', () => {
    render(<Toolbar onToolChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /rectangle/i })).toBeInTheDocument();
  });

  it('should call onToolChange when sticky note button is clicked', async () => {
    const user = userEvent.setup();
    const mockToolChange = vi.fn();
    render(<Toolbar onToolChange={mockToolChange} />);

    await user.click(screen.getByRole('button', { name: /sticky/i }));
    expect(mockToolChange).toHaveBeenCalledWith('sticky');
  });

  it('should call onToolChange when rectangle button is clicked', async () => {
    const user = userEvent.setup();
    const mockToolChange = vi.fn();
    render(<Toolbar onToolChange={mockToolChange} />);

    await user.click(screen.getByRole('button', { name: /rectangle/i }));
    expect(mockToolChange).toHaveBeenCalledWith('rectangle');
  });

  it('should highlight the active tool', () => {
    render(<Toolbar activeTool="sticky" onToolChange={vi.fn()} />);
    const stickyBtn = screen.getByRole('button', { name: /sticky/i });
    expect(stickyBtn.className).toContain('active');
  });
});
