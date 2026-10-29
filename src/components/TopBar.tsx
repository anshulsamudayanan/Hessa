import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function TopBar({ title, onBack, backLabel = 'Back', right }: { title?: ReactNode; onBack: () => void; backLabel?: string; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-30 border-b border-ink/10 bg-cream/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-2 px-2">
        <button className="btn-ghost min-h-11 px-3" onClick={onBack}>
          <ArrowLeft className="size-5" />
          <span className="text-sm">{backLabel}</span>
        </button>
        <div className="min-w-0 flex-1 truncate text-center font-display text-lg font-semibold">{title}</div>
        <div className="flex min-w-20 justify-end">{right}</div>
      </div>
    </div>
  );
}
