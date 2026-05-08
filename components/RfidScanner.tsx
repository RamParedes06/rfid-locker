'use client';

import { useEffect, useRef, useState } from 'react';
import { Nfc } from 'lucide-react';

interface Props {
  onScan: (rfid: string) => void;
  disabled?: boolean;
}

// Minimal type shim for Web NFC API
declare global {
  interface Window {
    NDEFReader?: new () => NDEFReaderInstance;
  }
  interface NDEFReaderInstance extends EventTarget {
    scan(options?: { signal?: AbortSignal }): Promise<void>;
    onreading: ((event: NDEFReadingEvent) => void) | null;
    onreadingerror: ((event: Event) => void) | null;
  }
  interface NDEFReadingEvent extends Event {
    serialNumber: string;
    message: NDEFMessage;
  }
  interface NDEFMessage {
    records: NDEFRecord[];
  }
  interface NDEFRecord {
    recordType: string;
    mediaType?: string;
    data?: DataView;
  }
}

export type NfcStatus = 'unavailable' | 'idle' | 'scanning' | 'error';

export default function RfidScanner({ onScan, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [buffer, setBuffer] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const [nfcStatus, setNfcStatus] = useState<NfcStatus>('unavailable');
  const [nfcSupported, setNfcSupported] = useState(false);

  // Detect NFC support on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.NDEFReader) {
      setNfcSupported(true);
      setNfcStatus('idle');
    }
  }, []);

  // Stop NFC when disabled
  useEffect(() => {
    if (disabled && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
      setNfcStatus('idle');
    }
  }, [disabled]);

  // Must be called from a user gesture (button click)
  async function startNfc() {
    if (!window.NDEFReader || disabled) return;

    // Stop any existing scan
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reader = new window.NDEFReader!();
      await reader.scan({ signal: controller.signal });
      setNfcStatus('scanning');

      reader.onreading = (event: NDEFReadingEvent) => {
        // Try text NDEF record first, fall back to serial number
        let value = '';
        for (const record of event.message.records) {
          if (record.recordType === 'text' && record.data) {
            value = new TextDecoder().decode(record.data);
            break;
          }
        }
        if (!value) {
          value = event.serialNumber.replace(/:/g, '');
        }
        if (value) onScan(value);
      };

      reader.onreadingerror = (e) => {
        console.error('NFC reading error', e);
        setNfcStatus('error');
      };
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('NFC scan() failed:', err);
        setNfcStatus('error');
      }
    }
  }

  // ── USB / serial RFID reader (keyboard wedge) ────────────────────────────
  useEffect(() => {
    const refocus = (e?: MouseEvent) => {
      if (disabled) return;
      if (e) {
        const tag = (e.target as HTMLElement).tagName;
        if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(tag)) return;
        if ((e.target as HTMLElement).isContentEditable) return;
      }
      inputRef.current?.focus();
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
        if (inputRef.current) inputRef.current.value = '';
      }
    }
  };

  return (
    <>
      {/* Hidden input for USB/serial RFID reader */}
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

      {/* NFC button — only shown on devices that support Web NFC */}
      {nfcSupported && !disabled && (
        <button
          onClick={startNfc}
          className={`fixed bottom-14 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 ${
            nfcStatus === 'scanning'
              ? 'bg-teal-500/20 border-teal-400/50 text-teal-300 shadow-lg shadow-teal-500/20'
              : nfcStatus === 'error'
              ? 'bg-red-500/20 border-red-400/50 text-red-300'
              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
          }`}
        >
          <Nfc className={`w-3.5 h-3.5 ${nfcStatus === 'scanning' ? 'animate-pulse' : ''}`} />
          {nfcStatus === 'scanning' && 'NFC active — tap your card'}
          {nfcStatus === 'error'    && 'NFC error — tap to retry'}
          {nfcStatus === 'idle'     && 'Tap to enable NFC'}
        </button>
      )}
    </>
  );
}
