import { useState, useRef, useEffect } from 'react';

interface TextEditorProps {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function TextEditor({ x, y, width, height, text, onSubmit, onCancel }: TextEditorProps) {
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
        fontSize: '14px',
        fontFamily: 'sans-serif',
        border: '2px solid #0066ff',
        borderRadius: '4px',
        resize: 'none',
        outline: 'none',
        background: 'transparent',
        zIndex: 1000,
      }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
