import { useState, useRef, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';

interface AICommandPanelProps {
  boardId: string;
}

type PanelState = 'idle' | 'loading' | 'success' | 'locked' | 'error';

const aiCommandFn = httpsCallable(functions, 'aiCommand');

export function AICommandPanel({ boardId }: AICommandPanelProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<PanelState>('idle');
  const [message, setMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-focus input when panel mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const clearAfterDelay = useCallback((ms: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setState('idle');
      setMessage('');
    }, ms);
  }, []);

  const handleSubmit = useCallback(async () => {
    const command = input.trim();
    if (!command || state === 'loading') return;

    setState('loading');
    setMessage('AI is thinking...');

    try {
      const result = await aiCommandFn({ command, boardId });
      const data = result.data as {
        success: boolean;
        objectsCreated: string[];
        toolsExecuted: string[];
      };

      if (data.success) {
        const count = data.objectsCreated.length;
        const toolCount = data.toolsExecuted.length;
        setState('success');
        setMessage(
          count > 0
            ? `Done! Created ${count} object${count !== 1 ? 's' : ''}`
            : `Done! Executed ${toolCount} action${toolCount !== 1 ? 's' : ''}`
        );
        setInput('');
        clearAfterDelay(3000);
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'functions/resource-exhausted') {
        setState('locked');
        setMessage('AI is busy, try again in a moment');
        clearAfterDelay(3000);
      } else {
        setState('error');
        setMessage(error.message || 'Something went wrong');
        clearAfterDelay(5000);
      }
    }
  }, [input, state, boardId, clearAfterDelay]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="ai-command-panel" data-testid="ai-command-panel">
      <div className="ai-command-panel-header">AI Assistant</div>
      <div className="ai-command-panel-body">
        <input
          ref={inputRef}
          type="text"
          className="ai-command-panel-input"
          placeholder="Ask AI to modify the board..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={state === 'loading'}
          data-testid="ai-command-input"
        />
        <button
          type="button"
          className="ai-command-panel-submit"
          onClick={handleSubmit}
          disabled={state === 'loading' || !input.trim()}
          data-testid="ai-command-submit"
        >
          {state === 'loading' ? (
            <span className="ai-command-spinner" />
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
      {message && (
        <div
          className={`ai-command-panel-message ${state === 'error' ? 'ai-command-panel-message-error' : ''} ${state === 'success' ? 'ai-command-panel-message-success' : ''} ${state === 'locked' ? 'ai-command-panel-message-locked' : ''}`}
          data-testid="ai-command-message"
        >
          {message}
        </div>
      )}
      <div className="ai-command-panel-hint">
        <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send
      </div>
    </div>
  );
}
