import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  it('should render email and password fields', () => {
    render(<LoginForm onLogin={vi.fn()} onSwitchToSignup={vi.fn()} error={null} />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should render a login button', () => {
    render(<LoginForm onLogin={vi.fn()} onSwitchToSignup={vi.fn()} error={null} />);
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('should call onLogin with email and password on submit', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    render(<LoginForm onLogin={mockLogin} onSwitchToSignup={vi.fn()} error={null} />);

    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
  });

  it('should display error when provided', () => {
    render(<LoginForm onLogin={vi.fn()} onSwitchToSignup={vi.fn()} error="Invalid credentials" />);
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('should have a link to switch to signup', async () => {
    const user = userEvent.setup();
    const mockSwitch = vi.fn();
    render(<LoginForm onLogin={vi.fn()} onSwitchToSignup={mockSwitch} error={null} />);

    await user.click(screen.getByText(/sign up/i));
    expect(mockSwitch).toHaveBeenCalled();
  });
});
