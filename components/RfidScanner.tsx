'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  onScan: (rfid: string) => void;
  disabled?: boolean;
}

export default function RfidScanner({ onScan, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');

  // Keep the hidden input focused so scanner input is captured
  useEffect(() => {
    const refocus = () => {
      if (!disabled) inputRef.current?.focus();
    };
    document.addEventListener('click', refocus);
    refocus();
    return () => document.removeEventListener('click', refocus);
  }, [disabled]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = buffer.trim();
      if (value) {
        onScan(value);
        setBuffer('');
        // clear the input value too
        if (inputRef.current) inputRef.current.value = '';
      }
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="opacity-0 absolute w-0 h-0 pointer-events-none"
      aria-hidden="true"
      tabIndex={-1}
      disabled={disabled}
      onChange={(e) => setBuffer(e.target.value)}
      onKeyDown={handleKeyDown}
      value={buffer}
    />
  );
}
