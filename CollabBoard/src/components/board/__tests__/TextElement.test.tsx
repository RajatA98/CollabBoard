import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextElement } from '../TextElement';
import type { BoardObject, LiveEditingData } from '../../../types';

vi.mock('react-konva', () => ({
  Group: ({ children, onClick }: Record<string, unknown>) => (
    <div data-testid="text-group" onClick={onClick as () => void}>
      {children as React.ReactNode}
    </div>
  ),
  Rect: (props: Record<string, unknown>) => (
    <div
      data-testid="text-rect"
      data-fill={props.fill}
      data-width={props.width}
      data-height={props.height}
      data-stroke={props.stroke}
      data-dash={props.dash ? JSON.stringify(props.dash) : undefined}
    />
  ),
  Text: (props: Record<string, unknown>) => (
    <div data-testid="text-text">{props.text as string}</div>
  ),
}));

vi.mock('../../../utils/textMeasure', () => ({
  measureTextHeight: () => 20,
  TEXT_ELEMENT_PADDING: 8,
  TEXT_ELEMENT_MIN_HEIGHT: 40,
  TEXT_ELEMENT_FONT_SIZE: 16,
  TEXT_ELEMENT_FONT_FAMILY: "'Segoe UI', system-ui, sans-serif",
}));

const mockObject: BoardObject = {
  id: 'text-1',
  type: 'text',
  x: 100,
  y: 200,
  width: 200,
  height: 40,
  rotation: 0,
  text: 'Hello World',
  color: 'transparent',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('TextElement', () => {
  it('should render with text content', () => {
    render(<TextElement object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should have transparent background', () => {
    render(<TextElement object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('text-rect');
    expect(rects[0]).toHaveAttribute('data-fill', 'transparent');
  });

  it('should show dashed border when selected', () => {
    render(<TextElement object={mockObject} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('text-rect');
    expect(rects[0]).toHaveAttribute('data-stroke', '#4285f4');
    expect(rects[0]).toHaveAttribute('data-dash');
  });

  it('should not show border when not selected', () => {
    render(<TextElement object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('text-rect');
    expect(rects[0]).toHaveAttribute('data-stroke', 'transparent');
  });

  it('should show placeholder when text is empty', () => {
    const emptyObject = { ...mockObject, text: '' };
    render(<TextElement object={emptyObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText('Type text')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', () => {
    const mockSelect = vi.fn();
    render(<TextElement object={mockObject} isSelected={false} onSelect={mockSelect} onUpdate={vi.fn()} />);
    screen.getByTestId('text-group').click();
    expect(mockSelect).toHaveBeenCalled();
  });

  it('shows remote editing indicator', () => {
    const remoteEditing: LiveEditingData = {
      objectId: 'text-1',
      text: 'Remote text',
      userName: 'Bob',
      userColor: '#51CF66',
      lastActive: Date.now(),
    };
    render(
      <TextElement
        object={mockObject}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        remoteEditing={remoteEditing}
      />
    );
    expect(screen.getByText('Bob typing...')).toBeInTheDocument();
  });
});
