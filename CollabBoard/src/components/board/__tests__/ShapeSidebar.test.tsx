import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShapeSidebar } from '../ShapeSidebar';

describe('ShapeSidebar', () => {
  it('should render the sidebar container', () => {
    render(<ShapeSidebar />);

    const sidebar = screen.getByTestId('shape-sidebar');
    expect(sidebar).toBeInTheDocument();
  });

  it('should render sticky note first, then Shapes dropdown trigger', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    const dropdownTrigger = screen.getByTestId('shape-dropdown-trigger');

    expect(stickyTemplate).toBeInTheDocument();
    expect(dropdownTrigger).toBeInTheDocument();
    expect(stickyTemplate.compareDocumentPosition(dropdownTrigger)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it('should render Shapes dropdown trigger with label', () => {
    render(<ShapeSidebar />);

    expect(screen.getByRole('button', { name: /shapes/i })).toBeInTheDocument();
  });

  it('should show rectangle only when Shapes dropdown is expanded', () => {
    render(<ShapeSidebar />);

    expect(screen.queryByTestId('shape-template-rectangle')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));

    expect(screen.getByTestId('shape-dropdown-panel')).toBeInTheDocument();
    expect(screen.getByTestId('shape-template-rectangle')).toBeInTheDocument();
  });

  it('should render sticky note shape template (always visible)', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    expect(stickyTemplate).toBeInTheDocument();
    expect(stickyTemplate).toHaveAttribute('aria-label', 'Sticky note');
  });

  it('should show rectangle icon only (no Rectangle text in dropdown)', () => {
    render(<ShapeSidebar />);
    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));

    expect(screen.getByTestId('shape-template-rectangle')).toBeInTheDocument();
    expect(screen.queryByText(/^rectangle$/i)).not.toBeInTheDocument();
  });

  it('should have draggable attribute on shape templates', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    expect(stickyTemplate).toHaveAttribute('draggable', 'true');

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    expect(rectangleTemplate).toHaveAttribute('draggable', 'true');
  });

  it('should call onDragStart when dragging starts', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    const dragStartEvent = new Event('dragstart', { bubbles: true });

    fireEvent(stickyTemplate, dragStartEvent);

    expect(stickyTemplate).toBeInTheDocument();
  });

  it('should store shape type in data attribute', () => {
    render(<ShapeSidebar />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    expect(stickyTemplate).toHaveAttribute('data-shape-type', 'sticky');

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    expect(rectangleTemplate).toHaveAttribute('data-shape-type', 'rectangle');
  });

  it('should apply correct CSS classes', () => {
    render(<ShapeSidebar />);

    const sidebar = screen.getByTestId('shape-sidebar');
    expect(sidebar).toHaveClass('shape-sidebar');

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    expect(stickyTemplate).toHaveClass('shape-template');

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    expect(rectangleTemplate).toHaveClass('shape-template');
  });

  it('should call onShapeClick when sticky is clicked', () => {
    const onShapeClick = vi.fn();
    render(<ShapeSidebar onShapeClick={onShapeClick} />);

    const stickyTemplate = screen.getByTestId('shape-template-sticky');
    fireEvent.click(stickyTemplate);
    expect(onShapeClick).toHaveBeenCalledWith('sticky');
  });

  it('should call onShapeClick when rectangle is clicked (after opening dropdown)', () => {
    const onShapeClick = vi.fn();
    render(<ShapeSidebar onShapeClick={onShapeClick} />);

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));
    const rectangleTemplate = screen.getByTestId('shape-template-rectangle');
    fireEvent.click(rectangleTemplate);
    expect(onShapeClick).toHaveBeenCalledWith('rectangle');
  });

  it('should toggle dropdown when trigger is clicked', () => {
    render(<ShapeSidebar />);

    const trigger = screen.getByTestId('shape-dropdown-trigger');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('shape-dropdown-panel')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('shape-dropdown-panel')).not.toBeInTheDocument();
  });

  it('should show text template in dropdown when expanded', () => {
    render(<ShapeSidebar />);

    expect(screen.queryByTestId('shape-template-text')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));

    expect(screen.getByTestId('shape-template-text')).toBeInTheDocument();
    expect(screen.getByTestId('shape-template-text')).toHaveAttribute('data-shape-type', 'text');
  });

  it('should call onShapeClick with text when text template is clicked', () => {
    const onShapeClick = vi.fn();
    render(<ShapeSidebar onShapeClick={onShapeClick} />);

    fireEvent.click(screen.getByTestId('shape-dropdown-trigger'));
    fireEvent.click(screen.getByTestId('shape-template-text'));
    expect(onShapeClick).toHaveBeenCalledWith('text');
  });
});
