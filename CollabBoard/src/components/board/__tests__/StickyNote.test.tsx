import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StickyNote } from '../StickyNote';
import type { BoardObject, LiveEditingData } from '../../../types';

vi.mock('../../../utils/textMeasure', () => ({
  measureTextHeight: () => 20,
  STICKY_TEXT_OFFSET_Y: 26,
  STICKY_TEXT_PADDING_BOTTOM: 8,
  STICKY_MIN_HEIGHT: 60,
  STICKY_FONT_SIZE: 16,
  STICKY_FONT_FAMILY: "'Segoe Print', 'Comic Sans MS', cursive",
}));

vi.mock('react-konva', () => ({
  Group: ({ children, onClick }: Record<string, unknown>) => (
    <div data-testid="sticky-group" onClick={onClick as () => void}>
      {children as React.ReactNode}
    </div>
  ),
  Rect: (props: Record<string, unknown>) => <div data-testid="sticky-rect" data-fill={props.fill} data-width={props.width} data-height={props.height} />,
  Text: (props: Record<string, unknown>) => <div data-testid="sticky-text">{props.text as string}</div>,
}));

const mockObject: BoardObject = {
  id: 'sticky-1',
  type: 'sticky',
  x: 100,
  y: 200,
  width: 150,
  height: 100,
  rotation: 0,
  text: 'Hello World',
  color: '#FFE066',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('StickyNote', () => {
  it('should render with text content', () => {
    render(<StickyNote object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should render with correct color', () => {
    render(<StickyNote object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('sticky-rect');
    expect(rects[0]).toHaveAttribute('data-fill', '#FFE066');
  });

  it('should call onSelect when clicked', async () => {
    const mockSelect = vi.fn();
    render(<StickyNote object={mockObject} isSelected={false} onSelect={mockSelect} onUpdate={vi.fn()} />);
    screen.getByTestId('sticky-group').click();
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should render with correct dimensions', () => {
    render(<StickyNote object={mockObject} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('sticky-rect');
    expect(rects[0]).toHaveAttribute('data-width', '150');
    expect(rects[0]).toHaveAttribute('data-height', '100');
  });

  it('shows messaging-style typing... indicator when remoteEditing is provided', () => {
    const remoteEditing: LiveEditingData = {
      objectId: 'sticky-1',
      text: 'Live typed text',
      userName: 'Alice',
      userColor: '#FF6B6B',
      lastActive: Date.now(),
    };
    render(
      <StickyNote
        object={mockObject}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        remoteEditing={remoteEditing}
      />
    );
    expect(screen.getByText('Alice typing...')).toBeInTheDocument();
  });

  it('shows remote editing text instead of object text when remoteEditing is provided', () => {
    const remoteEditing: LiveEditingData = {
      objectId: 'sticky-1',
      text: 'Live typed text',
      userName: 'Alice',
      userColor: '#FF6B6B',
      lastActive: Date.now(),
    };
    render(
      <StickyNote
        object={mockObject}
        isSelected={false}
        onSelect={vi.fn()}
        onUpdate={vi.fn()}
        remoteEditing={remoteEditing}
      />
    );
    expect(screen.getByText('Live typed text')).toBeInTheDocument();
  });
});
