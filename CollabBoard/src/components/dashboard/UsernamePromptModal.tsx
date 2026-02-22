import { useState, useEffect, useRef } from 'react';
import { callClaimUsername, callCheckUsernameAvailable } from '../../firebase/users';

interface UsernamePromptModalProps {
  onDone: () => void;
  onDismiss: () => void;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

export function UsernamePromptModal({ onDone, onDismiss }: UsernamePromptModalProps) {
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [formatError, setFormatError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const val = username.trim();
    if (!val) {
      setAvailability('idle');
      setFormatError('');
      return;
    }

    if (val.length < 3) {
      setFormatError('Must be at least 3 characters');
      setAvailability('invalid');
      return;
    }
    if (val.length > 20) {
      setFormatError('Must be at most 20 characters');
      setAvailability('invalid');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(val)) {
      setFormatError('Only lowercase letters, numbers, and underscores');
      setAvailability('invalid');
      return;
    }
    setFormatError('');

    if (!USERNAME_REGEX.test(val)) {
      setAvailability('invalid');
      return;
    }

    setAvailability('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await callCheckUsernameAvailable(val);
        setAvailability(result.available ? 'available' : 'taken');
      } catch {
        setAvailability('idle');
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username]);

  const handleClaim = async () => {
    const val = username.trim();
    if (!val || availability !== 'available') return;

    setSaving(true);
    setError('');
    try {
      await callClaimUsername(val);
      onDone();
    } catch (err) {
      const anyErr = err as { message?: string };
      setError(anyErr?.message ?? 'Failed to claim username');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Choose Your Username</h2>
        <p className="username-prompt-desc">
          Pick a unique username for your account. Other users can find you by your @username.
        </p>

        <div className="form-field">
          <label htmlFor="prompt-username">Username</label>
          <div className="username-input-wrap">
            <span className="username-at-prefix">@</span>
            <input
              id="prompt-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="your_username"
              maxLength={20}
              disabled={saving}
              autoFocus
              autoComplete="off"
            />
            <span className="username-status">
              {availability === 'checking' && <span className="status-checking">...</span>}
              {availability === 'available' && <span className="status-available">&#10003;</span>}
              {availability === 'taken' && <span className="status-taken">&#10007;</span>}
            </span>
          </div>
          {formatError && <span className="field-error">{formatError}</span>}
          {availability === 'taken' && <span className="field-error">Username is already taken</span>}
          {error && <span className="field-error">{error}</span>}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onDismiss} disabled={saving}>
            Later
          </button>
          <button
            type="button"
            onClick={handleClaim}
            disabled={availability !== 'available' || saving}
            className="profile-save-btn"
          >
            {saving ? 'Claiming...' : 'Claim Username'}
          </button>
        </div>
      </div>
    </div>
  );
}
