import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StylePanel } from '../StylePanel';
import type { BoardObject } from '../../../types';

const mockObject: BoardObject = {
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
};

describe('StylePanel', () => {
  it('should render when object is selected', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const panel = screen.getByTestId('style-panel');
    expect(panel).toBeInTheDocument();
  });

  it('should not render when no object is selected', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={null} onUpdate={onUpdate} />);
    
    const panel = screen.queryByTestId('style-panel');
    expect(panel).not.toBeInTheDocument();
  });

  it('should display object type', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    expect(screen.getByText(/rectangle/i)).toBeInTheDocument();
  });

  it('should display color input', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const colorInput = screen.getByLabelText(/color/i);
    expect(colorInput).toBeInTheDocument();
  });

  it('should display width input with current value', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const widthInput = screen.getByLabelText(/width/i) as HTMLInputElement;
    expect(widthInput).toBeInTheDocument();
    expect(widthInput.value).toBe('300');
  });

  it('should display height input with current value', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const heightInput = screen.getByLabelText(/height/i) as HTMLInputElement;
    expect(heightInput).toBeInTheDocument();
    expect(heightInput.value).toBe('150');
  });

  it('should display x position input with current value', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const xInput = screen.getByLabelText(/^x$/i) as HTMLInputElement;
    expect(xInput).toBeInTheDocument();
    expect(xInput.value).toBe('100');
  });

  it('should display y position input with current value (y-up: displayed as -storage y)', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const yInput = screen.getByLabelText(/^y$/i) as HTMLInputElement;
    expect(yInput).toBeInTheDocument();
    expect(yInput.value).toBe('-200');
  });

  it('should call onUpdate when color changes', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const colorInput = screen.getByLabelText(/color/i);
    fireEvent.change(colorInput, { target: { value: '#ff5722' } });
    
    expect(onUpdate).toHaveBeenCalledWith({ color: '#ff5722' });
  });

  it('should call onUpdate when width changes', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const widthInput = screen.getByLabelText(/width/i);
    fireEvent.change(widthInput, { target: { value: '400' } });
    fireEvent.blur(widthInput);
    
    expect(onUpdate).toHaveBeenCalledWith({ width: 400 });
  });

  it('should call onUpdate when height changes', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const heightInput = screen.getByLabelText(/height/i);
    fireEvent.change(heightInput, { target: { value: '250' } });
    fireEvent.blur(heightInput);
    
    expect(onUpdate).toHaveBeenCalledWith({ height: 250 });
  });

  it('should call onUpdate when x position changes', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const xInput = screen.getByLabelText(/^x$/i);
    fireEvent.change(xInput, { target: { value: '150' } });
    fireEvent.blur(xInput);
    
    expect(onUpdate).toHaveBeenCalledWith({ x: 150 });
  });

  it('should call onUpdate when y position changes (display y-up; storage is -display)', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const yInput = screen.getByLabelText(/^y$/i);
    fireEvent.change(yInput, { target: { value: '250' } });
    fireEvent.blur(yInput);
    
    expect(onUpdate).toHaveBeenCalledWith({ y: -250 });
  });

  it('should prevent negative width values', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const widthInput = screen.getByLabelText(/width/i);
    fireEvent.change(widthInput, { target: { value: '-100' } });
    fireEvent.blur(widthInput);
    
    expect(onUpdate).toHaveBeenCalledWith({ width: 20 }); // minimum size
  });

  it('should prevent negative height values', () => {
    const onUpdate = vi.fn();
    render(<StylePanel selectedObject={mockObject} onUpdate={onUpdate} />);
    
    const heightInput = screen.getByLabelText(/height/i);
    fireEvent.change(heightInput, { target: { value: '-50' } });
    fireEvent.blur(heightInput);
    
    expect(onUpdate).toHaveBeenCalledWith({ height: 20 }); // minimum size
  });
});
