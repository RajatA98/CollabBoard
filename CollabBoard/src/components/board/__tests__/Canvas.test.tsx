import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Canvas } from '../Canvas';

vi.mock('react-konva', () => ({
  Stage: ({ children }: Record<string, unknown>) => (
    <div data-testid="konva-stage">{children as React.ReactNode}</div>
  ),
  Layer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="konva-layer">{children}</div>
  ),
  Rect: () => <div data-testid="konva-rect" />,
  Circle: () => <div data-testid="konva-circle" />,
}));

vi.mock('konva', () => ({
  default: {},
}));

describe('Canvas', () => {
  const mockViewport = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
  const mockSetPosition = vi.fn();
  const mockZoomAtPoint = vi.fn();

  const baseProps = {
    objects: [],
    onObjectUpdate: vi.fn(),
    onCanvasClick: vi.fn(),
    onObjectDoubleClick: vi.fn(),
    selectedObjectIds: [] as string[],
    onSelectObject: vi.fn(),
    onClearSelection: vi.fn(),
    viewport: mockViewport,
    setPosition: mockSetPosition,
    zoomAtPoint: mockZoomAtPoint,
  };

  it('should render the stage', () => {
    render(<Canvas {...baseProps} />);
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('should render layers', () => {
    render(<Canvas {...baseProps} />);
    const layers = screen.getAllByTestId('konva-layer');
    expect(layers.length).toBeGreaterThanOrEqual(1);
  });
});
