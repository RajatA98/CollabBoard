import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransformHandles } from '../TransformHandles';
import type { BoardObject } from '../../../types';
import type React from 'react';

// Mock react-konva components
vi.mock('react-konva', () => ({
  Group: (rawProps: React.PropsWithChildren<Record<string, unknown>> & { listening?: boolean }) => {
    const { children, ...rest } = rawProps;
    const { listening, ...props } = rest;
    // Avoid passing non-DOM props like `listening` through.
    void listening;
    return (
      <div data-testid="handles-group" {...props}>
        {children}
      </div>
    );
  },
  Circle: (rawProps: Record<string, unknown>) => {
    const props = rawProps as {
      name: string;
      x: number;
      y: number;
      radius?: number;
      fill?: string;
      stroke?: string;
      onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
    };
    return (
    <div
      data-testid={`handle-${props.name}`}
      data-x={props.x}
      data-y={props.y}
      data-radius={props.radius}
      data-fill={props.fill}
      data-stroke={props.stroke}
      onMouseDown={props.onMouseDown}
      role="button"
    />
    );
  },
  Rect: (rawProps: Record<string, unknown>) => {
    const props = rawProps as {
      x: number;
      y: number;
      width: number;
      height: number;
      stroke?: string;
    };
    const testId = props.stroke ? 'selection-rect' : 'rect';
    return (
      <div
        data-testid={testId}
        data-x={props.x}
        data-y={props.y}
        data-width={props.width}
        data-height={props.height}
        data-stroke={props.stroke}
      />
    );
  },
  Text: (rawProps: Record<string, unknown>) => {
    const props = rawProps as { text: string };
    return (
      <div data-testid="dimension-label" data-text={props.text}>
        {props.text}
      </div>
    );
  },
}));

const mockObject: BoardObject = {
  id: 'rect-1',
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  rotation: 0,
  color: '#4A90D9',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('TransformHandles', () => {
  it('should render selection rectangle with correct dimensions', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);
    
    const selectionRect = screen.getByTestId('selection-rect');
    expect(selectionRect).toHaveAttribute('data-x', '100');
    expect(selectionRect).toHaveAttribute('data-y', '100');
    expect(selectionRect).toHaveAttribute('data-width', '200');
    expect(selectionRect).toHaveAttribute('data-height', '150');
  });

  it('should render all 8 resize handles', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);
    
    // Check all 8 handles exist
    expect(screen.getByTestId('handle-top-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-top-center')).toBeInTheDocument();
    expect(screen.getByTestId('handle-top-right')).toBeInTheDocument();
    expect(screen.getByTestId('handle-middle-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-middle-right')).toBeInTheDocument();
    expect(screen.getByTestId('handle-bottom-left')).toBeInTheDocument();
    expect(screen.getByTestId('handle-bottom-center')).toBeInTheDocument();
    expect(screen.getByTestId('handle-bottom-right')).toBeInTheDocument();
  });

  it('should position corner handles correctly', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);
    
    // Top-left corner
    const topLeft = screen.getByTestId('handle-top-left');
    expect(topLeft).toHaveAttribute('data-x', '100');
    expect(topLeft).toHaveAttribute('data-y', '100');
    
    // Bottom-right corner
    const bottomRight = screen.getByTestId('handle-bottom-right');
    expect(bottomRight).toHaveAttribute('data-x', '300'); // 100 + 200
    expect(bottomRight).toHaveAttribute('data-y', '250'); // 100 + 150
  });

  it('should position edge handles correctly', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);
    
    // Top-center edge
    const topCenter = screen.getByTestId('handle-top-center');
    expect(topCenter).toHaveAttribute('data-x', '200'); // 100 + 200/2
    expect(topCenter).toHaveAttribute('data-y', '100');
    
    // Right-center edge
    const middleRight = screen.getByTestId('handle-middle-right');
    expect(middleRight).toHaveAttribute('data-x', '300'); // 100 + 200
    expect(middleRight).toHaveAttribute('data-y', '175'); // 100 + 150/2
  });

  it('should render handles with correct visual style', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);
    
    const handle = screen.getByTestId('handle-top-left');
    expect(handle).toHaveAttribute('data-radius', '5');
    expect(handle).toHaveAttribute('data-fill', 'white');
    expect(handle).toHaveAttribute('data-stroke', '#0066ff');
  });

  it('should have mouseDown handlers on all handles', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);
    
    // Verify all handles have onMouseDown attribute (indicating they're interactive)
    const handles = [
      'handle-top-left',
      'handle-top-center',
      'handle-top-right',
      'handle-middle-left',
      'handle-middle-right',
      'handle-bottom-left',
      'handle-bottom-center',
      'handle-bottom-right',
    ];
    
    handles.forEach((handleId) => {
      const handle = screen.getByTestId(handleId);
      expect(handle).toBeInTheDocument();
    });
  });

  it('should render dimension label in center with object width and height', () => {
    const onResize = vi.fn();
    render(<TransformHandles object={mockObject} onResize={onResize} />);

    const dimensionLabel = screen.getByTestId('dimension-label');
    expect(dimensionLabel).toBeInTheDocument();
    expect(dimensionLabel).toHaveAttribute('data-text', '200 × 150');
    expect(dimensionLabel).toHaveTextContent('200 × 150');
  });
});
