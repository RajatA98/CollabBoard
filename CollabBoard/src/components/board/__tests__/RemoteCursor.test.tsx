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
  Path: (props: Record<string, unknown>) => (
    <div data-testid="cursor-arrow" data-fill={props.fill} data-data={props.data} />
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

  it('should render the cursor arrow in the user color', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    const arrow = screen.getByTestId('cursor-arrow');
    expect(arrow).toHaveAttribute('data-fill', '#FF0000');
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
    // At scale=2, the group should counter-scale by 0.5
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
    // scale=0 should not produce Infinity — it clamps to 0.01 minimum
    render(<RemoteCursor cursor={mockCursor} scale={0} />);
    const group = screen.getByTestId('cursor-group');
    const scaleX = parseFloat(group.getAttribute('data-scale-x') ?? '0');
    expect(isFinite(scaleX)).toBe(true);
    expect(scaleX).toBeLessThanOrEqual(100); // 1/0.01 = 100
  });

  it('should render the cursor arrow SVG path data', () => {
    render(<RemoteCursor cursor={mockCursor} scale={1} />);
    const arrow = screen.getByTestId('cursor-arrow');
    // Path should contain SVG path data starting with M
    expect(arrow.getAttribute('data-data')).toMatch(/^M/);
  });
});
