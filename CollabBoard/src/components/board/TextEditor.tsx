import { useState, useRef, useEffect, useCallback } from 'react';

interface TextEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
  textColor?: string;
  objectType?: 'sticky' | 'text' | 'frame';
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onTextChange?: (text: string) => void;
}

export function TextEditor({ x, y, width, height, text, color = '#FFD54F', textColor, objectType = 'sticky', fontSize, fontFamily, bold, italic, underline, onSubmit, onCancel, onTextChange }: TextEditorProps) {
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
  const isFrameType = objectType === 'frame';

  return (
    <textarea
      ref={textareaRef}
      className="text-editor"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height: isFrameType ? height : textareaHeight,
        padding: isFrameType ? '2px 8px' : '8px',
        fontSize: isFrameType ? '13px' : `${fontSize || 16}px`,
        fontFamily: isFrameType
          ? "system-ui, sans-serif"
          : fontFamily || (isTextType
            ? "'Segoe UI', system-ui, sans-serif"
            : "'Segoe Print', 'Comic Sans MS', cursive"),
        fontWeight: isFrameType ? 'bold' : (bold ? 'bold' : 'normal'),
        fontStyle: isFrameType ? 'normal' : (italic ? 'italic' : 'normal'),
        textDecoration: isFrameType ? 'none' : (underline ? 'underline' : 'none'),
        border: isFrameType
          ? '2px solid #3366ff'
          : isTextType
            ? '2px dashed #4285f4'
            : '3px solid #FFA726',
        borderRadius: isFrameType ? '4px 4px 0 0' : '2px',
        resize: 'none',
        outline: 'none',
        background: isFrameType ? '#3366ff' : isTextType ? 'rgba(255,255,255,0.95)' : color,
        color: isFrameType ? '#ffffff' : (textColor ?? '#333'),
        zIndex: 1000,
        boxShadow: isFrameType
          ? '0 2px 8px rgba(0,0,0,0.2)'
          : isTextType
            ? '0 2px 8px rgba(0,0,0,0.1)'
            : '2px 4px 8px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}
      value={value}
      maxLength={isFrameType ? 50 : undefined}
      rows={isFrameType ? 1 : undefined}
      onChange={(e) => {
        setValue(e.target.value);
        onTextChange?.(e.target.value);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={isFrameType ? 'Frame title...' : isTextType ? 'Type text...' : 'Type your note...'}
    />
  );
}
