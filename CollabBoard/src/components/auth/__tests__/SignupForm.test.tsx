import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupForm } from '../SignupForm';

describe('SignupForm', () => {
  it('should render name, email, and password fields', () => {
    render(<SignupForm onSignup={vi.fn()} onSwitchToLogin={vi.fn()} error={null} />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should render a signup button', () => {
    render(<SignupForm onSignup={vi.fn()} onSwitchToLogin={vi.fn()} error={null} />);
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('should call onSignup with name, email, and password on submit', async () => {
    const user = userEvent.setup();
    const mockSignup = vi.fn();
    render(<SignupForm onSignup={mockSignup} onSwitchToLogin={vi.fn()} error={null} />);

    await user.type(screen.getByLabelText(/name/i), 'Test User');
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign up/i }));

    expect(mockSignup).toHaveBeenCalledWith('test@test.com', 'password123', 'Test User');
  });

  it('should display error when provided', () => {
    render(<SignupForm onSignup={vi.fn()} onSwitchToLogin={vi.fn()} error="Email already in use" />);
    expect(screen.getByText('Email already in use')).toBeInTheDocument();
  });

  it('should have a link to switch to login', async () => {
    const user = userEvent.setup();
    const mockSwitch = vi.fn();
    render(<SignupForm onSignup={vi.fn()} onSwitchToLogin={mockSwitch} error={null} />);

    await user.click(screen.getByText(/log in/i));
    expect(mockSwitch).toHaveBeenCalled();
  });
});
