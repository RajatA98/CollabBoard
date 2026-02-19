import { useEffect, useRef } from 'react';

export interface ContextMenuProps {
  x: number;
  y: number;
  /** When undefined (e.g. right-click on empty board), Edit Text is hidden. */
  objectType?: 'sticky' | 'rectangle' | 'text';
  onEditText?: () => void;
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDuplicate: () => void;
  onSelectAll?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasClipboardContent?: boolean;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({
  x,
  y,
  objectType,
  onEditText,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onSelectAll,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  hasClipboardContent = false,
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
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        background: 'white',
        borderRadius: 8,
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        padding: '4px 0',
        minWidth: 180,
      }}
    >
      {(objectType === 'sticky' || objectType === 'text') && onEditText && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onEditText()}
          data-testid="context-menu-edit-text"
        >
          Edit Text
        </button>
      )}
      {onCopy && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onCopy()}
          data-testid="context-menu-copy"
        >
          Copy <span className="context-menu-shortcut">⌘C</span>
        </button>
      )}
      {onCut && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onCut()}
          data-testid="context-menu-cut"
        >
          Cut <span className="context-menu-shortcut">⌘X</span>
        </button>
      )}
      {onPaste && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onPaste()}
          disabled={!hasClipboardContent}
          data-testid="context-menu-paste"
        >
          Paste <span className="context-menu-shortcut">⌘V</span>
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
      {onSelectAll && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onSelectAll()}
          data-testid="context-menu-select-all"
        >
          Select All <span className="context-menu-shortcut">⌘A</span>
        </button>
      )}
      <div className="context-menu-divider" />
      {onUndo && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onUndo()}
          disabled={!canUndo}
          data-testid="context-menu-undo"
        >
          Undo <span className="context-menu-shortcut">⌘Z</span>
        </button>
      )}
      {onRedo && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => onRedo()}
          disabled={!canRedo}
          data-testid="context-menu-redo"
        >
          Redo <span className="context-menu-shortcut">⌘⇧Z</span>
        </button>
      )}
      <div className="context-menu-divider" />
      <button
        type="button"
        className="context-menu-item context-menu-item-danger"
        onClick={() => onDelete()}
        data-testid="context-menu-delete"
      >
        Delete <span className="context-menu-shortcut">⌫</span>
      </button>
    </div>
  );
}
