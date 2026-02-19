import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Triangle } from '../Triangle';
import type { BoardObject } from '../../../types';

vi.mock('react-konva', () => ({
  Group: ({ onClick, children, ...props }: Record<string, unknown>) => (
    <div data-testid="triangle-group" data-id={props.id} onClick={onClick as () => void}>
      {children as React.ReactNode}
    </div>
  ),
  Line: ({ ...props }: Record<string, unknown>) => (
    <div
      data-testid="triangle-shape"
      data-fill={props.fill}
      data-closed={String(props.closed)}
      data-stroke={props.stroke}
    />
  ),
  Rect: ({ ...props }: Record<string, unknown>) => (
    <div data-testid="triangle-rect" data-stroke={props.stroke} />
  ),
  Text: ({ ...props }: Record<string, unknown>) => (
    <span data-testid="triangle-text" data-text={props.text} />
  ),
}));

const mockObject: BoardObject = {
  id: 'tri-1',
  type: 'triangle',
  x: 100,
  y: 200,
  width: 150,
  height: 130,
  rotation: 0,
  color: '#81C784',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('Triangle', () => {
  it('should render with correct fill color', () => {
    render(<Triangle object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const shape = screen.getByTestId('triangle-shape');
    expect(shape).toHaveAttribute('data-fill', '#81C784');
  });

  it('should render as a closed shape', () => {
    render(<Triangle object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const shape = screen.getByTestId('triangle-shape');
    expect(shape).toHaveAttribute('data-closed', 'true');
  });

  it('should show selection stroke when selected', () => {
    render(<Triangle object={mockObject} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const shape = screen.getByTestId('triangle-shape');
    expect(shape).toHaveAttribute('data-stroke', '#0066ff');
  });

  it('should call onSelect when clicked', () => {
    const mockSelect = vi.fn();
    render(<Triangle object={mockObject} isSelected={false} onSelect={mockSelect} onUpdate={vi.fn()} />);
    screen.getByTestId('triangle-group').click();
    expect(mockSelect).toHaveBeenCalled();
  });
});
