import { useState, useRef, useCallback, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { ref, set, onValue, DataSnapshot } from 'firebase/database';
import { functions, rtdb } from '../../firebase/config';

interface AICommandPanelProps {
  boardId: string;
  userId?: string | null;
  onClose?: () => void;
  onUpgradeRequired?: () => void;
  /** Subscription tier — used for client-side limit pre-check before calling the server. */
  tier?: 'free' | 'pro';
  /** Number of AI commands used today — used for client-side limit pre-check. */
  aiCommandCount?: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  status?: 'error' | 'success';
  commandId?: string;
}

/** Pasted image for the current compose: base64 (no data URL prefix) + media type for API. */
interface PastedImage {
  id: string;
  base64: string;
  mediaType: string;
  /** Data URL for preview only */
  dataUrl: string;
}

/** Shape of an active command entry in RTDB */
interface RemoteCommand {
  userId: string;
  command: string;
  status: string;
  startedAt: number;
}

// Match server timeout (120s); client timeout in ms. Without this, default 60s causes "deadline exceeded".
const aiCommandFn = httpsCallable(functions, 'aiCommand', { timeout: 130000 });

const MAX_IMAGE_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;
const STALE_COMMAND_THRESHOLD_MS = 120_000;

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

export function AICommandPanel({ boardId, userId, onUpgradeRequired, tier, aiCommandCount }: AICommandPanelProps) {
  const [input, setInput] = useState('');
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [remoteCommands, setRemoteCommands] = useState<Record<string, RemoteCommand>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Track in-flight commands: commandId → cancel reject function
  const inFlightRef = useRef<Map<string, (reason: Error) => void>>(new Map());
  // Track which commandIds have had stop requested
  const stoppedCommandsRef = useRef<Set<string>>(new Set());
  // Force re-render when in-flight set changes
  const [inFlightCount, setInFlightCount] = useState(0);

  const hasInFlight = inFlightCount > 0;

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

  // Listen for active aiCommands (for post-refresh recovery)
  useEffect(() => {
    const cmdsRef = ref(rtdb, `boards/${boardId}/aiCommands`);
    const unsubscribe = onValue(cmdsRef, (snap: DataSnapshot) => {
      if (!snap.exists()) {
        setRemoteCommands({});
        return;
      }
      const val = snap.val() as Record<string, RemoteCommand>;
      const now = Date.now();
      const active: Record<string, RemoteCommand> = {};
      for (const [id, cmd] of Object.entries(val)) {
        // Only show commands that are not stale and not tracked locally
        if (cmd.status === 'processing' && now - cmd.startedAt < STALE_COMMAND_THRESHOLD_MS && !inFlightRef.current.has(id)) {
          active[id] = cmd;
        }
      }
      setRemoteCommands(active);
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

  const updateMessageByCommandId = useCallback((commandId: string, update: Partial<ChatMessage>) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.commandId === commandId && m.role === 'assistant');
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...update };
      return next;
    });
  }, []);

  const handleStopCommand = useCallback((commandId: string) => {
    stoppedCommandsRef.current.add(commandId);
    // Signal cancel via RTDB
    set(ref(rtdb, `boards/${boardId}/aiCommands/${commandId}/cancel`), true).catch((err) => {
      console.error('Failed to send stop signal:', err);
    });
    // Reject the local promise if we have it
    const rejectFn = inFlightRef.current.get(commandId);
    if (rejectFn) {
      rejectFn(new Error('cancelled'));
    }
  }, [boardId]);

  const handleSubmit = useCallback(async () => {
    const raw = input.trim();
    if (!raw && pastedImages.length === 0) return;

    // Client-side daily limit check for free tier — instant feedback without a server round-trip
    if (tier === 'free' && (aiCommandCount ?? 0) >= 3) {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: raw || '(image)' },
        {
          role: 'assistant',
          content: "You've reached your daily limit of 3 free AI commands. Upgrade to Pro for unlimited access.",
          status: 'error',
        },
      ]);
      setInput('');
      setPastedImages([]);
      if (onUpgradeRequired) onUpgradeRequired();
      return;
    }

    // Multiple commands sequentially (Cursor-style): newline-separated lines become commands[]
    const lines = raw.split(/\n/).map((s) => s.trim()).filter(Boolean);
    const singleCommand = lines.length <= 1 ? (raw || '') : lines.join(' ');
    const commands = lines.length > 1 ? lines : undefined;

    const imageToSend = pastedImages[0] ?? null;
    const commandId = generateId();

    setInput('');
    setPastedImages([]);
    const userDisplay = commands
      ? `${commands.length} commands: ${commands.join(' \u2192 ')}`
      : (singleCommand ? (imageToSend ? `${singleCommand} (with image)` : singleCommand) : '(image)');
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userDisplay, commandId },
      { role: 'assistant', content: 'Thinking...', commandId },
    ]);

    // Set up per-command cancel promise
    const cancelPromise = new Promise<never>((_, reject) => {
      inFlightRef.current.set(commandId, reject);
      setInFlightCount(inFlightRef.current.size);
    });

    let compressedImage: { base64: string; mediaType: string } | null = null;
    if (imageToSend) {
      try {
        compressedImage = await compressImageForUpload(imageToSend);
      } catch {
        inFlightRef.current.delete(commandId);
        setInFlightCount(inFlightRef.current.size);
        updateMessageByCommandId(commandId, {
          content: 'Could not process the image. Try a smaller or different image.',
          status: 'error',
        });
        return;
      }
    }

    // Snapshot current messages for history (exclude the messages we just added)
    const historyMessages = messages;
    const payload = {
      ...(commands ? { commands } : { command: singleCommand || 'What do you see in this image? Describe or create shapes based on it.' }),
      boardId,
      commandId,
      history: historyMessages.map((m) => ({ role: m.role, content: m.content })),
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

      const data = result.data as {
        success: boolean;
        cancelled?: boolean;
        reply?: string;
        objectsCreated: string[];
        toolsExecuted: string[];
        commandId?: string;
      };

      if (data.cancelled) {
        updateMessageByCommandId(commandId, { content: 'Stopped.' });
        return;
      }
      if (data.success) {
        const reply =
          data.reply?.trim() ||
          (data.objectsCreated.length > 0
            ? `Done! Created ${data.objectsCreated.length} object${data.objectsCreated.length !== 1 ? 's' : ''}.`
            : `Done! Executed ${data.toolsExecuted.length} action${data.toolsExecuted.length !== 1 ? 's' : ''}.`);
        updateMessageByCommandId(commandId, { content: reply, status: 'success' });
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.message === 'cancelled') {
        updateMessageByCommandId(commandId, { content: 'Stopped.' });
        return;
      }
      let content = error.message || 'Something went wrong';
      if (error.code === 'functions/permission-denied' && error.message?.includes('UPGRADE_REQUIRED')) {
        if (onUpgradeRequired) {
          onUpgradeRequired();
          return;
        }
        content = "You've used all 3 free AI commands. Upgrade to Pro for unlimited access.";
      }
      updateMessageByCommandId(commandId, { content, status: 'error' });
    } finally {
      inFlightRef.current.delete(commandId);
      stoppedCommandsRef.current.delete(commandId);
      setInFlightCount(inFlightRef.current.size);
    }
  }, [input, pastedImages, boardId, messages, updateMessageByCommandId, onUpgradeRequired]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Remote commands that are not tracked locally (e.g. after page refresh)
  const remoteCommandEntries = Object.entries(remoteCommands).filter(([, cmd]) => cmd.userId === userId);

  return (
    <div className="ai-command-panel ai-command-panel-chat" data-testid="ai-command-panel">
      <div className="ai-command-panel-header">AI Assistant</div>
      {remoteCommandEntries.length > 0 && (
        <div className="ai-command-panel-remote-running" data-testid="ai-command-remote-running">
          {remoteCommandEntries.map(([cmdId, cmd]) => (
            <div key={cmdId}>
              AI is running: {cmd.command?.slice(0, 60) || 'command'}{' '}
              <button
                type="button"
                className="ai-command-panel-stop-link"
                onClick={() => handleStopCommand(cmdId)}
                data-testid="ai-command-stop-remote"
              >
                Stop
              </button>
            </div>
          ))}
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
            {msg.role === 'assistant' && msg.commandId && inFlightRef.current.has(msg.commandId) && !msg.status && (
              <button
                type="button"
                className="ai-command-panel-inline-stop"
                onClick={() => handleStopCommand(msg.commandId!)}
                data-testid="ai-command-stop-inline"
              >
                {stoppedCommandsRef.current.has(msg.commandId) ? 'Stopping\u2026' : 'Stop'}
              </button>
            )}
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
          data-testid="ai-command-input"
          rows={2}
        />
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
      </div>
      <div className="ai-command-panel-hint">
        Enter to send · New lines = multiple commands (run in order) · Paste an image to include it
        {hasInFlight && ` · ${inFlightCount} command${inFlightCount !== 1 ? 's' : ''} running`}
      </div>
    </div>
  );
}
