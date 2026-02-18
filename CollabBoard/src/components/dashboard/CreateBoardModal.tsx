import { useState, type FormEvent } from 'react';

interface CreateBoardModalProps {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}

export function CreateBoardModal({ onSubmit, onCancel }: CreateBoardModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(name.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Board</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="board-name">Board Name</label>
            <input
              id="board-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              required
              autoFocus
              placeholder="Enter board name..."
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? 'Creating...' : 'Create Board'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
