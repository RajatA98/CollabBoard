import { useState, useRef, useEffect, useCallback } from 'react';

interface TextEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
  objectType?: 'sticky' | 'text';
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onTextChange?: (text: string) => void;
}

export function TextEditor({ x, y, width, height, text, color = '#FFD54F', objectType = 'sticky', fontSize, fontFamily, bold, italic, underline, onSubmit, onCancel, onTextChange }: TextEditorProps) {
  const [value, setValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [textareaHeight, setTextareaHeight] = useState(height);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  // Auto-resize textarea height as content grows
  const autoResize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.max(height, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
    setTextareaHeight(newHeight);
  }, [height]);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  const handleBlur = () => {
    onSubmit(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(value);
    }
  };

  const isTextType = objectType === 'text';

  return (
    <textarea
      ref={textareaRef}
      className="text-editor"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height: textareaHeight,
        padding: '8px',
        fontSize: `${fontSize || 16}px`,
        fontFamily: fontFamily || (isTextType
          ? "'Segoe UI', system-ui, sans-serif"
          : "'Segoe Print', 'Comic Sans MS', cursive"),
        fontWeight: bold ? 'bold' : 'normal',
        fontStyle: italic ? 'italic' : 'normal',
        textDecoration: underline ? 'underline' : 'none',
        border: isTextType
          ? '2px dashed #4285f4'
          : '3px solid #FFA726',
        borderRadius: '2px',
        resize: 'none',
        outline: 'none',
        background: isTextType ? 'rgba(255,255,255,0.95)' : color,
        color: '#333',
        zIndex: 1000,
        boxShadow: isTextType
          ? '0 2px 8px rgba(0,0,0,0.1)'
          : '2px 4px 8px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onTextChange?.(e.target.value);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={isTextType ? 'Type here...' : 'Type your note...'}
    />
  );
}
