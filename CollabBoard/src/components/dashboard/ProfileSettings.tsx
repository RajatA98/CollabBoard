import { useState, useEffect, useRef, useCallback } from 'react';
import { callClaimUsername, callCheckUsernameAvailable } from '../../firebase/users';
import type { AppUser, UserProfile } from '../../types';

interface ProfileSettingsProps {
  user: AppUser;
  profile: UserProfile | null;
  onClose: () => void;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export function ProfileSettings({ user, profile, onClose }: ProfileSettingsProps) {
  const [username, setUsername] = useState(profile?.username ?? '');
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [formatError, setFormatError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUsername = profile?.username ?? '';

  const validateFormat = useCallback((val: string): string => {
    if (val.length === 0) return '';
    if (val.length < 3) return 'Must be at least 3 characters';
    if (val.length > 20) return 'Must be at most 20 characters';
    if (!/^[a-z0-9_]+$/.test(val)) return 'Only lowercase letters, numbers, and underscores';
    return '';
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const val = username.trim().toLowerCase();
    setSaveSuccess(false);
    setSaveError('');

    if (!val || val === currentUsername) {
      setAvailability('idle');
      setFormatError('');
      return;
    }

    const err = validateFormat(val);
    if (err) {
      setFormatError(err);
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
  }, [username, currentUsername, validateFormat]);

  const handleSave = async () => {
    const val = username.trim().toLowerCase();
    if (!val || val === currentUsername) return;
    if (availability !== 'available') return;

    setSaving(true);
    setSaveError('');
    try {
      await callClaimUsername(val);
      setSaveSuccess(true);
    } catch (err) {
      const anyErr = err as { message?: string };
      setSaveError(anyErr?.message ?? 'Failed to save username');
    } finally {
      setSaving(false);
    }
  };

  const canSave = availability === 'available' && !saving;
  const avatarColor = profile?.avatarColor ?? user.avatarColor ?? '#667eea';
  const displayName = profile?.displayName ?? user.displayName ?? user.email;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-settings-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Profile Settings</h2>

        <div className="profile-avatar-section">
          <div className="profile-avatar-large" style={{ background: avatarColor }}>
            {getInitials(displayName)}
          </div>
          <div className="profile-display-info">
            <span className="profile-display-name">{displayName}</span>
            {currentUsername && <span className="profile-username-display">@{currentUsername}</span>}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="profile-username">Username</label>
          <div className="username-input-wrap">
            <span className="username-at-prefix">@</span>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="choose_username"
              maxLength={20}
              disabled={saving}
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
          {saveError && <span className="field-error">{saveError}</span>}
          {saveSuccess && <span className="field-success">Username saved!</span>}
        </div>

        <div className="profile-info-note">
          <strong>Display Name:</strong> {displayName}
          <br />
          <small>Edit your display name in your Firebase Auth settings.</small>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Close
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="profile-save-btn"
          >
            {saving ? 'Saving...' : 'Save Username'}
          </button>
        </div>
      </div>
    </div>
  );
}
