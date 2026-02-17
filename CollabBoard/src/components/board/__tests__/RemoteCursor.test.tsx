import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteCursor } from '../RemoteCursor';
import type { CursorData } from '../../../types';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="cursor-group" data-x={props.x} data-y={props.y}>{children as React.ReactNode}</div>
  ),
  Circle: (props: Record<string, unknown>) => (
    <div data-testid="cursor-dot" data-fill={props.fill} />
  ),
  Text: (props: Record<string, unknown>) => (
    <div data-testid="cursor-label">{props.text as string}</div>
  ),
}));

const mockCursor: CursorData = {
  x: 100,
  y: 200,
  name: 'Alice',
  color: '#FF0000',
  lastActive: Date.now(),
};

describe('RemoteCursor', () => {
  it('should render the cursor group at correct position', () => {
    render(<RemoteCursor cursor={mockCursor} />);
    const group = screen.getByTestId('cursor-group');
    expect(group).toHaveAttribute('data-x', '100');
    expect(group).toHaveAttribute('data-y', '200');
  });

  it('should render the name label', () => {
    render(<RemoteCursor cursor={mockCursor} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render the cursor dot with correct color', () => {
    render(<RemoteCursor cursor={mockCursor} />);
    const dot = screen.getByTestId('cursor-dot');
    expect(dot).toHaveAttribute('data-fill', '#FF0000');
  });
});
