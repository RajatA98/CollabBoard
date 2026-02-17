import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from '../Toolbar';

describe('Toolbar', () => {
  it('should render the toolbar', () => {
    render(<Toolbar />);
    expect(screen.getByTestId('toolbar')).toBeInTheDocument();
  });

  it('should render toolbar brand', () => {
    render(<Toolbar />);
    expect(screen.getByText('CollabBoard')).toBeInTheDocument();
  });

  it('should render logout button when onLogout is provided', () => {
    render(<Toolbar onLogout={vi.fn()} />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('should call onLogout when logout button is clicked', async () => {
    const user = userEvent.setup();
    const mockLogout = vi.fn();
    render(<Toolbar onLogout={mockLogout} />);

    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(mockLogout).toHaveBeenCalled();
  });
});
