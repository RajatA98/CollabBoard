import { useEffect, useRef } from 'react';

export interface ContextMenuProps {
  x: number;
  y: number;
  objectType: 'sticky' | 'rectangle';
  onEditText?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  objectType,
  onEditText,
  onDuplicate,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay so the right-click that opened the menu doesn't immediately close it
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      data-testid="context-menu"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 1000,
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        padding: '4px 0',
        minWidth: 160,
      }}
    >
      {objectType === 'sticky' && onEditText && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onEditText()}
          data-testid="context-menu-edit-text"
        >
          Edit Text
        </button>
      )}
      <button
        type="button"
        className="context-menu-item"
        onClick={() => onDuplicate()}
        data-testid="context-menu-duplicate"
      >
        Duplicate <span className="context-menu-shortcut">⌘D</span>
      </button>
      <div className="context-menu-divider" />
      <button
        type="button"
        className="context-menu-item context-menu-item-danger"
        onClick={() => onDelete()}
        data-testid="context-menu-delete"
      >
        Delete
      </button>
    </div>
  );
}
