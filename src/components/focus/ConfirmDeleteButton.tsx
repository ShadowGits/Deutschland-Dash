'use client';

import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

interface ConfirmDeleteButtonProps {
  /** What is being deleted, for the screen reader label. */
  what: string;
  /** Resolves true when the delete went through. */
  onConfirm: () => Promise<boolean>;
  label?: string;
  confirmText?: string;
  className?: string;
}

/**
 * A delete that cannot be undone asks once, in place — no dialog. The question
 * withdraws itself after a few seconds, so a stray first click never leaves a
 * live "Yes" waiting under the cursor.
 */
export default function ConfirmDeleteButton({
  what,
  onConfirm,
  label,
  confirmText = 'Delete?',
  className = '',
}: ConfirmDeleteButtonProps) {
  const [state, setState] = useState<'idle' | 'confirming' | 'busy'>('idle');

  useEffect(() => {
    if (state !== 'confirming') return;
    const timer = setTimeout(() => setState('idle'), 4000);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === 'busy') {
    return (
      <span className={`inline-flex items-center px-1.5 py-1 text-xs text-gray-400 ${className}`}>
        <Loader2 size={13} className="animate-spin" />
      </span>
    );
  }

  if (state === 'confirming') {
    return (
      <span className={`inline-flex items-center gap-1 text-xs ${className}`} role="group" aria-label={`Confirm deleting ${what}`}>
        <span className="font-medium text-red-700">{confirmText}</span>
        <button
          type="button"
          onClick={async () => {
            setState('busy');
            const ok = await onConfirm().catch(() => false);
            // On success the parent removes this button; only a failure returns here.
            if (!ok) setState('idle');
          }}
          className="rounded-md bg-red-600 px-2 py-1 font-semibold text-white hover:bg-red-700"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 font-medium text-gray-600 hover:bg-gray-50"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setState('confirming')}
      aria-label={`Delete ${what}`}
      title={`Delete ${what}`}
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-gray-400 hover:bg-red-50 hover:text-red-600 ${className}`}
    >
      <Trash2 size={13} />
      {label}
    </button>
  );
}
