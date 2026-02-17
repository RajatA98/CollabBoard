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
  it('should render the stage', () => {
    render(<Canvas objects={[]} onObjectUpdate={vi.fn()} onObjectDelete={vi.fn()} onCanvasClick={vi.fn()} />);
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('should render layers', () => {
    render(<Canvas objects={[]} onObjectUpdate={vi.fn()} onObjectDelete={vi.fn()} onCanvasClick={vi.fn()} />);
    const layers = screen.getAllByTestId('konva-layer');
    expect(layers.length).toBeGreaterThanOrEqual(1);
  });
});
