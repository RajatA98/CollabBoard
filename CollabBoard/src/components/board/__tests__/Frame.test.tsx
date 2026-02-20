import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Frame } from '../Frame';
import type { BoardObject } from '../../../types';

vi.mock('react-konva', () => ({
  Group: ({ onClick, children, ...props }: Record<string, unknown>) => (
    <div data-testid="frame-group" data-id={props.id} onClick={onClick as () => void}>
      {children as React.ReactNode}
    </div>
  ),
  Rect: ({ ...props }: Record<string, unknown>) => (
    <div
      data-testid="frame-rect"
      data-fill={props.fill}
      data-width={props.width}
      data-height={props.height}
      data-stroke={props.stroke}
      data-strokewidth={props.strokeWidth}
      data-cornerradius={JSON.stringify(props.cornerRadius)}
    />
  ),
  Text: ({ ...props }: Record<string, unknown>) => (
    <span data-testid="frame-text" data-text={props.text} data-fontsize={props.fontSize} data-fontstyle={props.fontStyle} data-fill={props.fill} />
  ),
}));

vi.mock('konva', () => ({ default: {} }));

const mockFrame: BoardObject = {
  id: 'frame-1',
  type: 'frame',
  x: 100,
  y: 100,
  width: 300,
  height: 200,
  rotation: 0,
  text: 'Frame 1',
  color: '#3366ff',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
};

describe('Frame', () => {
  it('should render with frame title text', () => {
    render(<Frame object={mockFrame} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const texts = screen.getAllByTestId('frame-text');
    const titleText = texts.find(t => t.getAttribute('data-text') === 'Frame 1');
    expect(titleText).toBeTruthy();
  });

  it('should render with subtle blue fill', () => {
    render(<Frame object={mockFrame} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('frame-rect');
    const bgRect = rects.find(r => r.getAttribute('data-fill') === 'rgba(51, 102, 255, 0.05)');
    expect(bgRect).toBeTruthy();
  });

  it('should render with 2px blue border', () => {
    render(<Frame object={mockFrame} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('frame-rect');
    const borderRect = rects.find(r => r.getAttribute('data-stroke') === '#3366ff');
    expect(borderRect).toBeTruthy();
    expect(borderRect).toHaveAttribute('data-strokewidth', '2');
  });

  it('should brighten border when selected', () => {
    render(<Frame object={mockFrame} isSelected={true} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('frame-rect');
    const borderRect = rects.find(r => r.getAttribute('data-stroke') === '#5588ff');
    expect(borderRect).toBeTruthy();
  });

  it('should render title with 13px bold white text', () => {
    render(<Frame object={mockFrame} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const texts = screen.getAllByTestId('frame-text');
    const titleText = texts.find(t => t.getAttribute('data-text') === 'Frame 1');
    expect(titleText).toHaveAttribute('data-fontsize', '13');
    expect(titleText).toHaveAttribute('data-fontstyle', 'bold');
    expect(titleText).toHaveAttribute('data-fill', '#ffffff');
  });

  it('should call onSelect when clicked', () => {
    const mockSelect = vi.fn();
    render(<Frame object={mockFrame} isSelected={false} onSelect={mockSelect} onUpdate={vi.fn()} />);
    screen.getByTestId('frame-group').click();
    expect(mockSelect).toHaveBeenCalled();
  });

  it('should render with correct dimensions', () => {
    render(<Frame object={mockFrame} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const rects = screen.getAllByTestId('frame-rect');
    const bgRect = rects.find(r => r.getAttribute('data-width') === '300' && r.getAttribute('data-height') === '200');
    expect(bgRect).toBeTruthy();
  });

  it('should use default title when text is empty', () => {
    const frameWithoutText = { ...mockFrame, text: '' };
    render(<Frame object={frameWithoutText} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} />);
    const texts = screen.getAllByTestId('frame-text');
    const titleText = texts.find(t => t.getAttribute('data-text') === 'Frame');
    expect(titleText).toBeTruthy();
  });

  it('should show remote transform overlay when remoteTransform is provided', () => {
    const remoteTransform = {
      objectId: 'frame-1',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      rotation: 0,
      userName: 'Alice',
      userColor: '#ff0000',
      lastActive: Date.now(),
    };
    render(<Frame object={mockFrame} isSelected={false} onSelect={vi.fn()} onUpdate={vi.fn()} remoteTransform={remoteTransform} />);
    const texts = screen.getAllByTestId('frame-text');
    const userLabel = texts.find(t => t.getAttribute('data-text') === 'Alice');
    expect(userLabel).toBeTruthy();
  });
});
