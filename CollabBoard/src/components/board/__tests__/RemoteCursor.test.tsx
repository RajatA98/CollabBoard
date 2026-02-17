import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RemoteCursor } from '../RemoteCursor';
import type { CursorData } from '../../../types';

vi.mock('react-konva', () => ({
  Group: ({ children, ...props }: Record<string, unknown>) => (
    <div
      data-testid="cursor-group"
      data-x={props.x}
      data-y={props.y}
      data-scale-x={props.scaleX}
      data-scale-y={props.scaleY}
    >
      {children as React.ReactNode}
    </div>
  ),
  Circle: (props: Record<string, unknown>) => (
    <div data-testid="cursor-dot" data-fill={props.fill} data-radius={props.radius} />
  ),
  Rect: (props: Record<string, unknown>) => (
    <div data-testid="cursor-badge" data-fill={props.fill} />
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
  it('should render the cursor group at the correct world position', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    const group = screen.getByTestId('cursor-group');
    expect(group).toHaveAttribute('data-x', '100');
    expect(group).toHaveAttribute('data-y', '200');
  });

  it('should render the circle dot in the user color', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    const dot = screen.getByTestId('cursor-dot');
    expect(dot).toHaveAttribute('data-fill', '#FF0000');
  });

  it('should render the name label', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should render the name badge in the user color', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    const badge = screen.getByTestId('cursor-badge');
    expect(badge).toHaveAttribute('data-fill', '#FF0000');
  });

  it('should apply inverse scale to keep cursor size constant on screen', () => {
    render(<RemoteCursor cursor={mockCursor} scale={2} />);
    const group = screen.getByTestId('cursor-group');
    expect(group).toHaveAttribute('data-scale-x', '0.5');
    expect(group).toHaveAttribute('data-scale-y', '0.5');
  });

  it('should apply inverse scale of 1 when scale is 1', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    const group = screen.getByTestId('cursor-group');
    expect(group).toHaveAttribute('data-scale-x', '1');
    expect(group).toHaveAttribute('data-scale-y', '1');
  });

  it('should clamp scale to prevent division by zero', () => {
    render(<RemoteCursor cursor={mockCursor} scale={0} />);
    const group = screen.getByTestId('cursor-group');
    const scaleX = parseFloat(group.getAttribute('data-scale-x') ?? '0');
    expect(isFinite(scaleX)).toBe(true);
    expect(scaleX).toBeLessThanOrEqual(100);
  });
});
