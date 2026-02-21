import { useState, useRef, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, set, onValue } from 'firebase/database';
import { functions, rtdb } from '../../firebase/config';

interface AICommandPanelProps {
  boardId: string;
  onClose?: () => void;
}

type PanelState = 'idle' | 'loading' | 'success' | 'locked' | 'error';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  status?: 'error' | 'success' | 'locked';
}

/** Pasted image for the current compose: base64 (no data URL prefix) + media type for API. */
interface PastedImage {
  id: string;
  base64: string;
  mediaType: string;
  /** Data URL for preview only */
  dataUrl: string;
}

// Match server timeout (120s); client timeout in ms. Without this, default 60s causes "deadline exceeded".
const aiCommandFn = httpsCallable(functions, 'aiCommand', { timeout: 130000 });

const MAX_IMAGE_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

/** Compress image to JPEG and resize so payload fits Firebase callable limit (~10MB). Returns base64 + 'image/jpeg'. */
function compressImageForUpload(img: PastedImage): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('img');
    el.crossOrigin = 'anonymous';
    el.onload = () => {
      try {
        const w = el.naturalWidth;
        const h = el.naturalHeight;
        let dw = w;
        let dh = h;
        if (w > MAX_IMAGE_DIMENSION || h > MAX_IMAGE_DIMENSION) {
          if (w >= h) {
            dw = MAX_IMAGE_DIMENSION;
            dh = Math.round((h * MAX_IMAGE_DIMENSION) / w);
          } else {
            dh = MAX_IMAGE_DIMENSION;
            dw = Math.round((w * MAX_IMAGE_DIMENSION) / h);
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = dw;
        canvas.height = dh;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas not supported'));
          return;
        }
        ctx.drawImage(el, 0, 0, dw, dh);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (!match) {
                reject(new Error('Invalid image data'));
                return;
              }
              resolve({ base64: match[2], mediaType: 'image/jpeg' });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          JPEG_QUALITY
        );
      } catch (e) {
        reject(e);
      }
    };
    el.onerror = () => reject(new Error('Failed to load image'));
    el.src = img.dataUrl;
  });
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}

export function AICommandPanel({ boardId }: AICommandPanelProps) {
  const [input, setInput] = useState('');
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const [state, setState] = useState<PanelState>('idle');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiLockPresent, setAiLockPresent] = useState(false);
  const [stopRequestedAt, setStopRequestedAt] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelRejectRef = useRef<((reason: Error) => void) | null>(null);

  // Auto-focus input when panel mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Listen for aiLock so we can show "Stop AI" after refresh (run still going on backend)
  useEffect(() => {
    const lockRef = ref(rtdb, `boards/${boardId}/aiLock`);
    const unsubscribe = onValue(lockRef, (snap) => {
      setAiLockPresent(snap.exists());
      if (!snap.exists()) setStopRequestedAt(null);
    });
    return unsubscribe;
  }, [boardId]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((item) => item.type.startsWith('image/'));
    if (!item) return;
    e.preventDefault();
    const file = item.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return;
      const [, mediaType, base64] = match;
      setPastedImages((prev) => [
        ...prev,
        { id: generateId(), base64, mediaType, dataUrl },
      ]);
    };
    reader.readAsDataURL(file);
  }, []);

  const removePastedImage = useCallback((id: string) => {
    setPastedImages((prev) => prev.filter((img) => img.id !== id));
  }, []);

  const handleSubmit = useCallback(async () => {
    const raw = input.trim();
    if ((!raw && pastedImages.length === 0) || state === 'loading') return;

    // Multiple commands sequentially (Cursor-style): newline-separated lines become commands[]
    const lines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
    const singleCommand = lines.length <= 1 ? (raw || '') : lines.join(' ');
    const commands = lines.length > 1 ? lines : undefined;

    const imageToSend = pastedImages[0] ?? null;
    setInput('');
    setPastedImages([]);
    setState('loading');
    const userDisplay = commands
      ? `${commands.length} commands: ${commands.join(' → ')}`
      : (singleCommand ? (imageToSend ? `${singleCommand} (with image)` : singleCommand) : '(image)');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userDisplay },
      { role: 'assistant', content: 'Thinking...' },
    ]);
    cancelRejectRef.current = null;

    const cancelPromise = new Promise<never>((_, reject) => {
      cancelRejectRef.current = (reason: Error) => reject(reason);
    });

    let compressedImage: { base64: string; mediaType: string } | null = null;
    if (imageToSend) {
      try {
        compressedImage = await compressImageForUpload(imageToSend);
      } catch (err) {
        setState('error');
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: 'Could not process the image. Try a smaller or different image.', status: 'error' };
          return next;
        });
        return;
      }
    }

    const payload = {
      ...(commands ? { commands } : { command: singleCommand || 'What do you see in this image? Describe or create shapes based on it.' }),
      boardId,
      history: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(compressedImage && {
        imageBase64: compressedImage.base64,
        imageMediaType: compressedImage.mediaType,
      }),
    };

    try {
      const result = await Promise.race([
        aiCommandFn(payload),
        cancelPromise,
      ]);
      cancelRejectRef.current = null;

      const data = result.data as {
        success: boolean;
        cancelled?: boolean;
        reply?: string;
        objectsCreated: string[];
        toolsExecuted: string[];
      };

      if (data.cancelled) {
        setState('idle');
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: 'Stopped.' };
          return next;
        });
        return;
      }
      if (data.success) {
        // Use the same reply text as in Langfuse (full AI response with markdown/tables)
        const reply =
          data.reply?.trim() ||
          (data.objectsCreated.length > 0
            ? `Done! Created ${data.objectsCreated.length} object${data.objectsCreated.length !== 1 ? 's' : ''}.`
            : `Done! Executed ${data.toolsExecuted.length} action${data.toolsExecuted.length !== 1 ? 's' : ''}.`);
        setState('success');
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: reply, status: 'success' };
          return next;
        });
      }
    } catch (err: unknown) {
      cancelRejectRef.current = null;
      const error = err as { code?: string; message?: string };
      if (error.message === 'cancelled') {
        setState('idle');
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: 'assistant', content: 'Stopped.' };
          return next;
        });
        return;
      }
      let content = error.message || 'Something went wrong';
      let status: 'error' | 'locked' | undefined = 'error';
      if (error.code === 'functions/resource-exhausted') {
        content = 'AI is busy on this board. Try again in a moment.';
        status = 'locked';
      }
      setState(status === 'locked' ? 'locked' : 'error');
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content, status };
        return next;
      });
    }
  }, [input, pastedImages, state, boardId]);

  const handleStop = useCallback(() => {
    setStopRequestedAt(Date.now());
    set(ref(rtdb, `boards/${boardId}/aiCancel`), true).catch((err) => {
      console.error('Failed to send stop signal:', err);
      setStopRequestedAt(null);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === 'assistant') {
          next[next.length - 1] = { ...last, content: 'Could not send stop signal. Try again or check database rules.', status: 'error' as const };
        } else {
          next.push({ role: 'assistant', content: 'Could not send stop signal. Try again or check database rules.', status: 'error' });
        }
        return next;
      });
    });
    if (state === 'loading') {
      cancelRejectRef.current?.(new Error('cancelled'));
    }
  }, [state, boardId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div className="ai-command-panel ai-command-panel-chat" data-testid="ai-command-panel">
      <div className="ai-command-panel-header">AI Assistant</div>
      {aiLockPresent && state !== 'loading' && (
        <div className="ai-command-panel-remote-running" data-testid="ai-command-remote-running">
          {stopRequestedAt ? (
            'Stopping…'
          ) : (
            <>
              AI is running on this board (e.g. after refresh).{' '}
              <button type="button" className="ai-command-panel-stop-link" onClick={handleStop} data-testid="ai-command-stop-remote">
                Stop
              </button>
            </>
          )}
        </div>
      )}
      <div className="ai-command-panel-messages" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="ai-command-panel-welcome">
            Ask me to create shapes, sticky notes, or layouts. For example: &ldquo;Add a yellow sticky note&rdquo; or &ldquo;Create a SWOT analysis.&rdquo;
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`ai-command-panel-bubble ai-command-panel-bubble-${msg.role} ${msg.status ? `ai-command-panel-bubble-${msg.status}` : ''}`}
            data-testid={msg.role === 'assistant' ? 'ai-command-message' : undefined}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-command-panel-body">
        {pastedImages.length > 0 && (
          <div className="ai-command-panel-images">
            {pastedImages.map((img) => (
              <div key={img.id} className="ai-command-panel-image-wrap">
                <img src={img.dataUrl} alt="Pasted" className="ai-command-panel-image-preview" />
                <button
                  type="button"
                  className="ai-command-panel-image-remove"
                  onClick={() => removePastedImage(img.id)}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className="ai-command-panel-input"
          placeholder={pastedImages.length > 0 ? "Add a message (optional) or press Enter..." : "Type a message (new lines = multiple commands) or paste an image..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          disabled={state === 'loading'}
          data-testid="ai-command-input"
          rows={2}
        />
        {(state === 'loading' || aiLockPresent) ? (
          <button
            type="button"
            className="ai-command-panel-stop"
            onClick={handleStop}
            disabled={!!stopRequestedAt}
            data-testid="ai-command-stop"
            aria-label={stopRequestedAt ? 'Stopping AI' : 'Stop AI'}
          >
            {stopRequestedAt ? 'Stopping…' : 'Stop'}
          </button>
        ) : (
          <button
            type="button"
            className="ai-command-panel-submit"
            onClick={handleSubmit}
            disabled={!input.trim() && pastedImages.length === 0}
            data-testid="ai-command-submit"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
      <div className="ai-command-panel-hint">Enter to send · New lines = multiple commands (run in order) · Paste an image to include it</div>
    </div>
  );
}
