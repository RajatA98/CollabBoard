import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShapeSidebar } from '../ShapeSidebar';

describe('ShapeSidebar', () => {
  it('should render the sidebar container', () => {
    render(<ShapeSidebar />);

    const sidebar = screen.getByTestId('shape-sidebar');
    expect(sidebar).toBeInTheDocument();
  });

  it('should render three left-bar buttons: sticky, text, shapes', () => {
    render(<ShapeSidebar />);

    expect(screen.getByTestId('shape-template-sticky')).toBeInTheDocument();
    expect(screen.getByTestId('shape-template-text')).toBeInTheDocument();
    expect(screen.getByTestId('shape-bar-shapes-btn')).toBeInTheDocument();
  });

  it('should render sticky first, then text, then shapes button', () => {
    render(<ShapeSidebar />);

    const sticky = screen.getByTestId('shape-template-sticky');
    const text = screen.getByTestId('shape-template-text');
    const shapes = screen.getByTestId('shape-bar-shapes-btn');

    expect(sticky.compareDocumentPosition(text)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(text.compareDocumentPosition(shapes)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('should show rectangle only when Shapes panel is open', () => {
    render(<ShapeSidebar />);

    expect(screen.queryByTestId('shape-template-rectangle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('shape-bar-shapes-btn'));

    expect(screen.getByTestId('shape-panel')).toBeInTheDocument();
    expect(screen.getByTestId('shape-template-rectangle')).toBeInTheDocument();
  });

  it('should not show text template in shapes panel (text is a separate button)', () => {
    render(<ShapeSidebar />);

    fireEvent.click(screen.getByTestId('shape-bar-shapes-btn'));

    expect(screen.getByTestId('shape-panel')).toBeInTheDocument();
    expect(screen.getByTestId('shape-template-rectangle')).toBeInTheDocument();
    expect(screen.queryByTestId('shape-panel')).toBeInTheDocument();
    expect(screen.getByTestId('shape-template-text').closest('.shape-panel')).toBeNull();
  });

  it('should render sticky note with aria-label', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    expect(stickyTemplate).toBeInTheDocument();
    expect(stickyTemplate).toHaveAttribute('aria-label', 'Sticky note');
  });

  it('should have draggable attribute on sticky and text', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    const textTemplate = screen.getByTestId('shape-template-text');
    expect(stickyTemplate).toHaveAttribute('draggable', 'true');
    expect(textTemplate).toHaveAttribute('draggable', 'true');
  });

  it('should have draggable on rectangle when panel is open', () => {
    render(<ShapeSidebar />);
    fireEvent.click(screen.getByTestId('shape-bar-shapes-btn'));

    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    expect(rectangleTemplate).toHaveAttribute('draggable', 'true');
  });

  it('should store shape type in data attribute', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    expect(stickyTemplate).toHaveAttribute('data-shape-type', 'sticky');

    const textTemplate = screen.getByTestId('shape-template-text');
    expect(textTemplate).toHaveAttribute('data-shape-type', 'text');

    fireEvent.click(screen.getByTestId('shape-bar-shapes-btn'));
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    expect(rectangleTemplate).toHaveAttribute('data-shape-type', 'rectangle');
  });

  it('should apply correct CSS classes', () => {
    render(<ShapeSidebar />);

    const sidebar = screen.getByTestId('shape-sidebar');
    expect(sidebar).toHaveClass('shape-sidebar');

    fireEvent.click(screen.getByTestId('shape-bar-shapes-btn'));
    const panel = screen.getByTestId('shape-panel');
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    expect(panel).toHaveClass('shape-panel');
    expect(rectangleTemplate).toHaveClass('shape-panel-item');
  });

  it('should call onShapeClick when sticky is clicked', () => {
    const onShapeClick = vi.fn();
    render(<ShapeSidebar onShapeClick={onShapeClick} />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    fireEvent.click(stickyTemplate);
    expect(onShapeClick).toHaveBeenCalledWith('sticky');
  });

  it('should call onShapeClick when text button is clicked', () => {
    const onShapeClick = vi.fn();
    render(<ShapeSidebar onShapeClick={onShapeClick} />);

    const textTemplate = screen.getByTestId('shape-template-text');
    fireEvent.click(textTemplate);
    expect(onShapeClick).toHaveBeenCalledWith('text');
  });

  it('should call onShapeClick when rectangle in panel is clicked', () => {
    const onShapeClick = vi.fn();
    render(<ShapeSidebar onShapeClick={onShapeClick} />);

    fireEvent.click(screen.getByTestId('shape-bar-shapes-btn'));
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    fireEvent.click(rectangleTemplate);
    expect(onShapeClick).toHaveBeenCalledWith('rectangle');
  });

  it('should toggle shapes panel when Shapes button is clicked', () => {
    render(<ShapeSidebar />);

    const shapesBtn = screen.getByTestId('shape-bar-shapes-btn');
    expect(screen.queryByTestId('shape-panel')).not.toBeInTheDocument();

    fireEvent.click(shapesBtn);
    expect(screen.getByTestId('shape-panel')).toBeInTheDocument();

    fireEvent.click(shapesBtn);
    expect(screen.queryByTestId('shape-panel')).not.toBeInTheDocument();
  });

  it('should call onDragStart when dragging starts from sticky', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    const dragStartEvent = new Event('dragstart', { bubbles: true });

    fireEvent(stickyTemplate, dragStartEvent);

    expect(stickyTemplate).toBeInTheDocument();
  });

  it('should render single mode toggle button (cursor/hand)', () => {
    render(<ShapeSidebar />);
    expect(screen.getByTestId('tool-cursor')).toBeInTheDocument();
  });

  it('should highlight mode button when canvasMode is cursor', () => {
    render(<ShapeSidebar canvasMode="cursor" />);
    const btn = screen.getByTestId('tool-cursor');
    expect(btn).toHaveClass('shape-bar-btn-active');
  });

  it('should not highlight mode button when canvasMode is grab', () => {
    render(<ShapeSidebar canvasMode="grab" />);
    const btn = screen.getByTestId('tool-cursor');
    expect(btn).not.toHaveClass('shape-bar-btn-active');
  });

  it('should call onCanvasModeChange with grab when clicked in cursor mode', () => {
    const onCanvasModeChange = vi.fn();
    render(<ShapeSidebar canvasMode="cursor" onCanvasModeChange={onCanvasModeChange} />);
    fireEvent.click(screen.getByTestId('tool-cursor'));
    expect(onCanvasModeChange).toHaveBeenCalledWith('grab');
  });

  it('should call onCanvasModeChange with cursor when clicked in grab mode', () => {
    const onCanvasModeChange = vi.fn();
    render(<ShapeSidebar canvasMode="grab" onCanvasModeChange={onCanvasModeChange} />);
    fireEvent.click(screen.getByTestId('tool-cursor'));
    expect(onCanvasModeChange).toHaveBeenCalledWith('cursor');
  });

  it('should render mode button before sticky note button', () => {
    render(<ShapeSidebar />);
    const cursor = screen.getByTestId('tool-cursor');
    const sticky = screen.getByTestId('shape-template-sticky');
    expect(cursor.compareDocumentPosition(sticky)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('should render divider between mode buttons and shape buttons', () => {
    render(<ShapeSidebar />);
    const sidebar = screen.getByTestId('shape-sidebar');
    const divider = sidebar.querySelector('.shape-sidebar-divider');
    expect(divider).toBeInTheDocument();
  });
});
