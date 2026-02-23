import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresenceBar } from '../PresenceBar';
import type { PresenceData, CursorData } from '../../../types';

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

  describe('Jump to cursor', () => {
    const now = Date.now();
    const users: PresenceData[] = [
      { userId: 'self', name: 'Self', email: 's@t.com', color: '#f00', online: true, joinedAt: now },
      { userId: 'u2', name: 'Bob', email: 'b@t.com', color: '#0f0', online: true, joinedAt: now },
      { userId: 'u3', name: 'Carol', email: 'c@t.com', color: '#00f', online: true, joinedAt: now },
    ];
    const cursors: Record<string, CursorData> = {
      'u2': { x: 500, y: 300, name: 'Bob', color: '#0f0', lastActive: now },
    };

    it('should mark remote users with active cursors as jumpable', () => {
      const { container } = render(
        <PresenceBar onlineUsers={users} cursors={cursors} onJumpToCursor={() => {}} />
      );
      const avatars = container.querySelectorAll('.presence-avatar');
      // Self (index 0) should NOT be jumpable
      expect(avatars[0]).not.toHaveClass('jumpable');
      // Bob (index 1) has a cursor - should be jumpable
      expect(avatars[1]).toHaveClass('jumpable');
      // Carol (index 2) has no cursor - should NOT be jumpable
      expect(avatars[2]).not.toHaveClass('jumpable');
    });

    it('should call onJumpToCursor with userId when a jumpable avatar is clicked', () => {
      const onJump = vi.fn();
      const { container } = render(
        <PresenceBar onlineUsers={users} cursors={cursors} onJumpToCursor={onJump} />
      );
      const avatars = container.querySelectorAll('.presence-avatar');
      fireEvent.click(avatars[1]); // Bob
      expect(onJump).toHaveBeenCalledWith('u2');
    });

    it('should not call onJumpToCursor when the local user avatar is clicked', () => {
      const onJump = vi.fn();
      const { container } = render(
        <PresenceBar onlineUsers={users} cursors={cursors} onJumpToCursor={onJump} />
      );
      const avatars = container.querySelectorAll('.presence-avatar');
      fireEvent.click(avatars[0]); // Self
      expect(onJump).not.toHaveBeenCalled();
    });

    it('should show jump tooltip for jumpable users', () => {
      const { container } = render(
        <PresenceBar onlineUsers={users} cursors={cursors} onJumpToCursor={() => {}} />
      );
      const avatars = container.querySelectorAll('.presence-avatar');
      expect(avatars[1].getAttribute('title')).toContain('Jump to');
    });
  });
});
