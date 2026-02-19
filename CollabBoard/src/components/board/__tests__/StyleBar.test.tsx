import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StyleBar } from '../StyleBar';
import type { BoardObject } from '../../../types';

const VP = { x: 0, y: 0, scaleX: 1, scaleY: 1 };

function makeObject(overrides: Partial<BoardObject> = {}): BoardObject {
  return {
    id: 'obj-1',
    type: 'rectangle',
    x: 100,
    y: -200,
    width: 150,
    height: 100,
    rotation: 0,
    color: '#3366FF',
    createdBy: 'u1',
    createdAt: 1,
    updatedAt: 1,
    updatedBy: 'u1',
    ...overrides,
  };
}

function renderBar(objOverrides: Partial<BoardObject> = {}, extra: Record<string, unknown> = {}) {
  const onUpdate = extra.onUpdate as ReturnType<typeof vi.fn> ?? vi.fn();
  const onDelete = extra.onDelete as ReturnType<typeof vi.fn> ?? vi.fn();
  const selectedCount = (extra.selectedCount as number) ?? 1;
  render(
    <StyleBar
      selectedObject={makeObject(objOverrides)}
      selectedCount={selectedCount}
      onUpdate={onUpdate}
      onDelete={onDelete}
      viewport={VP}
      {...(extra.liveTransform ? { liveTransform: extra.liveTransform as StyleBarLT } : {})}
    />
  );
  return { onUpdate, onDelete };
}

type StyleBarLT = { width: number; height: number; x: number; y: number; rotation: number };

describe('StyleBar', () => {
  let onUpdate: ReturnType<typeof vi.fn>;
  let onDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn();
    onDelete = vi.fn();
  });

  it('renders when given a selected object', () => {
    renderBar({}, { onUpdate, onDelete });
    expect(screen.getByTestId('style-bar')).toBeInTheDocument();
  });

  it('shows shape switcher for shape objects', () => {
    renderBar({ type: 'rectangle' }, { onUpdate, onDelete });
    expect(screen.getByTestId('shape-switcher')).toBeInTheDocument();
  });

  it('does not show shape switcher for line objects', () => {
    renderBar({ type: 'line' }, { onUpdate, onDelete });
    expect(screen.queryByTestId('shape-switcher')).not.toBeInTheDocument();
  });

  it('does not show shape switcher for text objects', () => {
    renderBar({ type: 'text' }, { onUpdate, onDelete });
    expect(screen.queryByTestId('shape-switcher')).not.toBeInTheDocument();
  });

  it('shows font controls for sticky notes', () => {
    renderBar({ type: 'sticky', text: 'Hello' }, { onUpdate, onDelete });
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Italic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Underline' })).toBeInTheDocument();
    expect(screen.getByLabelText('Font size')).toBeInTheDocument();
    expect(screen.getByLabelText('Font family')).toBeInTheDocument();
  });

  it('shows font controls for text objects', () => {
    renderBar({ type: 'text' }, { onUpdate, onDelete });
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
  });

  it('does not show font controls for rectangle', () => {
    renderBar({ type: 'rectangle' }, { onUpdate, onDelete });
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
  });

  it('toggles bold on click', () => {
    renderBar({ type: 'sticky', bold: false }, { onUpdate, onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onUpdate).toHaveBeenCalledWith({ bold: true });
  });

  it('toggles italic on click', () => {
    renderBar({ type: 'sticky', italic: false }, { onUpdate, onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(onUpdate).toHaveBeenCalledWith({ italic: true });
  });

  it('toggles underline on click', () => {
    renderBar({ type: 'sticky', underline: false }, { onUpdate, onDelete });
    fireEvent.click(screen.getByRole('button', { name: 'Underline' }));
    expect(onUpdate).toHaveBeenCalledWith({ underline: true });
  });

  it('shows arrow type buttons for line objects', () => {
    renderBar({ type: 'line', arrowType: 'none' }, { onUpdate, onDelete });
    expect(screen.getByRole('button', { name: '─' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '→' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '↔' })).toBeInTheDocument();
  });

  it('changes arrow type on click', () => {
    renderBar({ type: 'line', arrowType: 'none' }, { onUpdate, onDelete });
    fireEvent.click(screen.getByRole('button', { name: '→' }));
    expect(onUpdate).toHaveBeenCalledWith({ arrowType: 'single' });
  });

  it('shows line style dropdown for line objects', () => {
    renderBar({ type: 'line' }, { onUpdate, onDelete });
    expect(screen.getByTestId('line-style-dropdown')).toBeInTheDocument();
  });

  it('shows X/Y coordinate inputs for single selection', () => {
    renderBar({ x: 100, y: -200 }, { onUpdate, onDelete });
    expect(screen.getByLabelText('X')).toBeInTheDocument();
    expect(screen.getByLabelText('Y')).toBeInTheDocument();
  });

  it('hides coordinates and shape switcher for multi-select', () => {
    renderBar({}, { onUpdate, onDelete, selectedCount: 3 });
    expect(screen.queryByLabelText('X')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shape-switcher')).not.toBeInTheDocument();
  });

  it('shows delete button', () => {
    renderBar({}, { onUpdate, onDelete });
    expect(screen.getByTestId('style-bar-delete')).toBeInTheDocument();
  });

  it('shows delete confirmation on click and deletes on confirm', () => {
    renderBar({}, { onUpdate, onDelete });
    fireEvent.click(screen.getByTestId('style-bar-delete'));
    expect(screen.getByTestId('delete-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Yes'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('cancels delete on No click', () => {
    renderBar({}, { onUpdate, onDelete });
    fireEvent.click(screen.getByTestId('style-bar-delete'));
    fireEvent.click(screen.getByText('No'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-confirm')).not.toBeInTheDocument();
  });

  it('shows stroke controls for shape objects', () => {
    renderBar({ type: 'circle' }, { onUpdate, onDelete });
    expect(screen.getByLabelText('Stroke width')).toBeInTheDocument();
  });

  it('shows W/H dimension inputs for non-line objects', () => {
    renderBar({ type: 'rectangle', width: 200, height: 150 }, { onUpdate, onDelete });
    const wInput = screen.getByLabelText('Width') as HTMLInputElement;
    const hInput = screen.getByLabelText('Height') as HTMLInputElement;
    expect(wInput.value).toBe('200');
    expect(hInput.value).toBe('150');
  });

  it('does not show W/H dimension inputs for line objects', () => {
    renderBar({ type: 'line' }, { onUpdate, onDelete });
    expect(screen.queryByLabelText('Width')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Height')).not.toBeInTheDocument();
  });

  it('uses liveTransform values for coordinate and dimension display', () => {
    renderBar(
      { x: 100, y: -200, width: 150, height: 100 },
      { onUpdate, onDelete, liveTransform: { x: 300, y: -400, width: 250, height: 180, rotation: 0 } },
    );
    const xInput = screen.getByLabelText('X') as HTMLInputElement;
    const yInput = screen.getByLabelText('Y') as HTMLInputElement;
    const wInput = screen.getByLabelText('Width') as HTMLInputElement;
    const hInput = screen.getByLabelText('Height') as HTMLInputElement;
    expect(xInput.value).toBe('300');
    expect(yInput.value).toBe('400');
    expect(wInput.value).toBe('250');
    expect(hInput.value).toBe('180');
  });

  it('shape switcher shows icon (not text label) as trigger', () => {
    renderBar({ type: 'rectangle' }, { onUpdate, onDelete });
    const trigger = screen.getByTestId('shape-switcher');
    expect(trigger.querySelector('svg')).toBeInTheDocument();
  });
});
