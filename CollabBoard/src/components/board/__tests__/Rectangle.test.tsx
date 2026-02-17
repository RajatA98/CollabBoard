import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Rectangle } from '../Rectangle';
import type { BoardObject } from '../../../types';

vi.mock('react-konva', () => ({
  Rect: ({ onClick, ...props }: Record<string, unknown>) => (
    <div
      data-testid="rectangle"
      data-fill={props.fill}
      data-width={props.width}
      data-height={props.height}
      data-stroke={props.stroke}
      onClick={onClick as () => void}
    />
  ),
}));

const mockObject: BoardObject = {
  id: 'rect-1',
  type: 'rectangle',
  x: 300,
  y: 400,
  width: 200,
  height: 150,
  rotation: 0,
  color: '#4A90D9',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('Rectangle', () => {
  it('should render with correct fill color', () => {
    render(<Rectangle object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rect = screen.getByTestId('rectangle');
    expect(rect).toHaveAttribute('data-fill', '#4A90D9');
  });

  it('should render with correct dimensions', () => {
    render(<Rectangle object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rect = screen.getByTestId('rectangle');
    expect(rect).toHaveAttribute('data-width', '200');
    expect(rect).toHaveAttribute('data-height', '150');
  });

  it('should show selection stroke when selected', () => {
    render(<Rectangle object={mockObject} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rect = screen.getByTestId('rectangle');
    expect(rect).toHaveAttribute('data-stroke', '#0066ff');
  });

  it('should call onSelect when clicked', () => {
    const mockSelect = vi.fn();
    render(<Rectangle object={mockObject} isSelected={false} onSelect={mockSelect} onUpdate={vi.fn()} />);
    screen.getByTestId('rectangle').click();
    expect(mockSelect).toHaveBeenCalled();
  });
});
