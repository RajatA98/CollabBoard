import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingToolbar } from '../FloatingToolbar';
import type { BoardObject } from '../../../types';

const mockViewport = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

const makeObject = (overrides: Partial<BoardObject> = {}): BoardObject => ({
  id: 'rect-1',
  type: 'rectangle',
  x: 100,
  y: 200,
  width: 300,
  height: 150,
  rotation: 0,
  color: '#90CAF9',
  createdBy: 'user-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  updatedBy: 'user-1',
  ...overrides,
});

describe('FloatingToolbar', () => {
  it('should render when object is selected', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject()}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByTestId('floating-toolbar')).toBeInTheDocument();
  });

  it('should show shape type buttons for rectangle', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'rectangle' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByLabelText('Rectangle')).toBeInTheDocument();
    expect(screen.getByLabelText('Circle')).toBeInTheDocument();
    expect(screen.getByLabelText('Sticky note')).toBeInTheDocument();
  });

  it('should show line type buttons for line object', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'line', arrowType: 'none' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByLabelText('Line')).toBeInTheDocument();
    expect(screen.getByLabelText('Single arrow')).toBeInTheDocument();
    expect(screen.getByLabelText('Double arrow')).toBeInTheDocument();
  });

  it('should show color picker', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject()}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByLabelText('Color')).toBeInTheDocument();
  });

  it('should show X, Y, rotation inputs', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject()}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByLabelText('X')).toBeInTheDocument();
    expect(screen.getByLabelText('Y')).toBeInTheDocument();
    expect(screen.getByLabelText('Rotation')).toBeInTheDocument();
  });

  it('should display Y as -storage value', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ y: 200 })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    const yInput = screen.getByLabelText('Y') as HTMLInputElement;
    expect(yInput.value).toBe('-200');
  });

  it('shows all controls (multi-select applies to all objects via Board)', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject()}
        onUpdate={onUpdate}
        viewport={mockViewport}
      />
    );
    expect(screen.getByLabelText('Color')).toBeInTheDocument();
    expect(screen.getByLabelText('X')).toBeInTheDocument();
    expect(screen.getByLabelText('Y')).toBeInTheDocument();
    expect(screen.getByLabelText('Rotation')).toBeInTheDocument();
    expect(screen.getByLabelText('Rectangle')).toBeInTheDocument();
  });

  it('should call onUpdate when color changes', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject()}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    const colorInput = screen.getByLabelText('Color');
    fireEvent.change(colorInput, { target: { value: '#ff5722' } });
    expect(onUpdate).toHaveBeenCalledWith({ color: '#ff5722' });
  });

  it('should call onUpdate when X changes on blur', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ x: 100 })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    const xInput = screen.getByLabelText('X');
    fireEvent.change(xInput, { target: { value: '150' } });
    fireEvent.blur(xInput);
    expect(onUpdate).toHaveBeenCalledWith({ x: 150 });
  });

  it('should call onUpdate when Y changes on blur (inverted)', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ y: 200 })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    const yInput = screen.getByLabelText('Y');
    fireEvent.change(yInput, { target: { value: '250' } });
    fireEvent.blur(yInput);
    expect(onUpdate).toHaveBeenCalledWith({ y: -250 });
  });

  it('should call onUpdate when rotation changes on blur', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ rotation: 0 })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    const rotInput = screen.getByLabelText('Rotation');
    fireEvent.change(rotInput, { target: { value: '45' } });
    fireEvent.blur(rotInput);
    expect(onUpdate).toHaveBeenCalledWith({ rotation: 45 });
  });

  it('should call onUpdate with type change (rectangle to circle)', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'rectangle' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    fireEvent.click(screen.getByLabelText('Circle'));
    expect(onUpdate).toHaveBeenCalledWith({ type: 'circle' });
  });

  it('should call onUpdate with arrowType change', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'line', arrowType: 'none' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    fireEvent.click(screen.getByLabelText('Single arrow'));
    expect(onUpdate).toHaveBeenCalledWith({ arrowType: 'single' });
  });

  it('should show font controls for sticky note', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'sticky', text: 'hello' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByLabelText('Font family')).toBeInTheDocument();
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
    expect(screen.getByLabelText('Italic')).toBeInTheDocument();
    expect(screen.getByLabelText('Underline')).toBeInTheDocument();
  });

  it('should show font controls for text element', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'text', text: 'hello' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.getByLabelText('Font family')).toBeInTheDocument();
    expect(screen.getByLabelText('Bold')).toBeInTheDocument();
  });

  it('should not show font controls for rectangle', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'rectangle' })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    expect(screen.queryByLabelText('Font family')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Bold')).not.toBeInTheDocument();
  });

  it('should toggle bold on click', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'sticky', text: 'hello', bold: false })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    fireEvent.click(screen.getByLabelText('Bold'));
    expect(onUpdate).toHaveBeenCalledWith({ bold: true });
  });

  it('should toggle italic on click', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'text', text: 'hello', italic: false })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    fireEvent.click(screen.getByLabelText('Italic'));
    expect(onUpdate).toHaveBeenCalledWith({ italic: true });
  });

  it('should toggle underline on click', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ type: 'sticky', text: 'hello', underline: false })}

        onUpdate={onUpdate}
        viewport={mockViewport}

      />
    );
    fireEvent.click(screen.getByLabelText('Underline'));
    expect(onUpdate).toHaveBeenCalledWith({ underline: true });
  });

  it('should display live transform values', () => {
    const onUpdate = vi.fn();
    render(
      <FloatingToolbar
        selectedObject={makeObject({ x: 100, y: 200, rotation: 0 })}

        onUpdate={onUpdate}
        liveTransform={{ x: 150, y: 250, width: 300, height: 150, rotation: 30 }}
        viewport={mockViewport}

      />
    );
    const xInput = screen.getByLabelText('X') as HTMLInputElement;
    const yInput = screen.getByLabelText('Y') as HTMLInputElement;
    const rotInput = screen.getByLabelText('Rotation') as HTMLInputElement;
    expect(xInput.value).toBe('150');
    expect(yInput.value).toBe('-250');
    expect(rotInput.value).toBe('30');
  });
});
