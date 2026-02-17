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
      data-listening={String(props.listening)}
    >
      {children as React.ReactNode}
    </div>
  ),
  Circle: (props: Record<string, unknown>) => (
    <div 
      data-testid="cursor-dot" 
      data-fill={props.fill}
      data-radius={props.radius}
      data-shadowblur={props.shadowBlur}
    />
  ),
  Rect: (props: Record<string, unknown>) => (
    <div
      data-testid="cursor-label-bg"
      data-fill={props.fill}
      data-opacity={props.opacity}
      data-cornerradius={props.cornerRadius}
      data-x={props.x}
      data-y={props.y}
      data-width={props.width}
      data-height={props.height}
    />
  ),
  Text: (props: Record<string, unknown>) => (
    <div 
      data-testid="cursor-label"
      data-x={props.x}
      data-y={props.y}
      data-fill={props.fill}
    >
      {props.text as string}
    </div>
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

  describe('Enhanced Visual Design', () => {
    it('should render cursor dot with 8px radius for better visibility', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const dot = screen.getByTestId('cursor-dot');
      expect(dot).toHaveAttribute('data-radius', '8');
    });

    it('should render name label with background rectangle', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const background = screen.getByTestId('cursor-label-bg');
      expect(background).toBeInTheDocument();
    });

    it('should use cursor color for label background', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const background = screen.getByTestId('cursor-label-bg');
      expect(background).toHaveAttribute('data-fill', '#FF0000');
    });

    it('should apply semi-transparent opacity to label background', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const background = screen.getByTestId('cursor-label-bg');
      const opacity = parseFloat(background.getAttribute('data-opacity') || '0');
      expect(opacity).toBeGreaterThanOrEqual(0.8);
      expect(opacity).toBeLessThanOrEqual(0.95);
    });

    it('should render label background with rounded corners', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const background = screen.getByTestId('cursor-label-bg');
      const cornerRadius = parseFloat(background.getAttribute('data-cornerradius') || '0');
      expect(cornerRadius).toBeGreaterThan(0);
    });

    it('should position label to the right of cursor dot', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const label = screen.getByTestId('cursor-label');
      const labelX = parseFloat(label.getAttribute('data-x') || '0');
      expect(labelX).toBeGreaterThan(8); // Should be offset from dot radius
    });

    it('should add shadow to cursor dot for depth', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const dot = screen.getByTestId('cursor-dot');
      const shadowBlur = parseFloat(dot.getAttribute('data-shadowblur') || '0');
      expect(shadowBlur).toBeGreaterThan(0);
    });

    it('should not listen to pointer events to avoid blocking interactions', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const group = screen.getByTestId('cursor-group');
      expect(group).toHaveAttribute('data-listening', 'false');
    });

    it('should use white text color for better contrast', () => {
      render(<RemoteCursor cursor={mockCursor} />);
      const label = screen.getByTestId('cursor-label');
      expect(label).toHaveAttribute('data-fill', '#FFFFFF');
    });
  });
});
