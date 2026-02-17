import { useState, useRef, useEffect } from 'react';

interface TextEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
  onTextChange?: (text: string) => void;
}

export function TextEditor({ x, y, width, height, text, color = '#FFD54F', onSubmit, onCancel, onTextChange }: TextEditorProps) {
  const [value, setValue] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

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

  return (
    <textarea
      ref={textareaRef}
      className="text-editor"
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        padding: '8px',
        fontSize: '16px',
        fontFamily: "'Segoe Print', 'Comic Sans MS', cursive",
        border: '3px solid #FFA726',
        borderRadius: '2px',
        resize: 'none',
        outline: 'none',
        background: color,
        color: '#333',
        zIndex: 1000,
        boxShadow: '2px 4px 8px rgba(0,0,0,0.3)',
      }}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onTextChange?.(e.target.value);
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder="Type your note..."
    />
  );
}
