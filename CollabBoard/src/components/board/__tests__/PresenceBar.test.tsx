import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresenceBar } from '../PresenceBar';
import type { PresenceData } from '../../../types';

describe('PresenceBar', () => {
  it('should render nothing when no online users', () => {
    const { container } = render(<PresenceBar onlineUsers={[]} />);
    expect(container.querySelector('.presence-bar')).toBeInTheDocument();
  });

  it('should render online user names', () => {
    const users: PresenceData[] = [
      { name: 'Alice', email: 'a@t.com', color: '#FF6B6B', online: true, joinedAt: 1 },
      { name: 'Bob', email: 'b@t.com', color: '#51CF66', online: true, joinedAt: 2 },
    ];
    render(<PresenceBar onlineUsers={users} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('should render user avatars with correct colors', () => {
    const users: PresenceData[] = [
      { name: 'Alice', email: 'a@t.com', color: '#FF6B6B', online: true, joinedAt: 1 },
    ];
    render(<PresenceBar onlineUsers={users} />);
    const avatar = screen.getByText('A');
    expect(avatar).toBeInTheDocument();
  });

  it('should show user count', () => {
    const users: PresenceData[] = [
      { name: 'Alice', email: 'a@t.com', color: '#FF6B6B', online: true, joinedAt: 1 },
      { name: 'Bob', email: 'b@t.com', color: '#51CF66', online: true, joinedAt: 2 },
      { name: 'Carol', email: 'c@t.com', color: '#339AF0', online: true, joinedAt: 3 },
    ];
    render(<PresenceBar onlineUsers={users} />);
    expect(screen.getByText(/3 online/i)).toBeInTheDocument();
  });
});
