import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarShape } from '../StarShape';
import type { BoardObject } from '../../../types';

vi.mock('react-konva', () => ({
  Group: ({ onClick, children, ...props }: Record<string, unknown>) => (
    <div data-testid="star-group" data-id={props.id} onClick={onClick as () => void}>
      {children as React.ReactNode}
    </div>
  ),
  Star: ({ ...props }: Record<string, unknown>) => (
    <div
      data-testid="star-shape"
      data-fill={props.fill}
      data-numpoints={props.numPoints}
      data-stroke={props.stroke}
    />
  ),
  Rect: ({ ...props }: Record<string, unknown>) => (
    <div data-testid="star-rect" data-stroke={props.stroke} />
  ),
  Text: ({ ...props }: Record<string, unknown>) => (
    <span data-testid="star-text" data-text={props.text} />
  ),
}));

const mockObject: BoardObject = {
  id: 'star-1',
  type: 'star',
  x: 100,
  y: 200,
  width: 150,
  height: 150,
  rotation: 0,
  color: '#FFB74D',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('StarShape', () => {
  it('should render with correct fill color', () => {
    render(<StarShape object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const shape = screen.getByTestId('star-shape');
    expect(shape).toHaveAttribute('data-fill', '#FFB74D');
  });

  it('should render with 5 points', () => {
    render(<StarShape object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const shape = screen.getByTestId('star-shape');
    expect(shape).toHaveAttribute('data-numpoints', '5');
  });

  it('should show selection stroke when selected', () => {
    render(<StarShape object={mockObject} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const shape = screen.getByTestId('star-shape');
    expect(shape).toHaveAttribute('data-stroke', '#0066ff');
  });

  it('should call onSelect when clicked', () => {
    const mockSelect = vi.fn();
    render(<StarShape object={mockObject} isSelected={false} onSelect={mockSelect} onUpdate={vi.fn()} />);
    screen.getByTestId('star-group').click();
    expect(mockSelect).toHaveBeenCalled();
  });
});
