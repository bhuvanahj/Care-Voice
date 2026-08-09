'use client';

import { cn } from '@/lib/shadcn/utils';
import {
  CARE_VOICE_STATE_CONFIG,
  CARE_VOICE_STATE_ORDER,
  type CareVoiceState,
} from '@/components/care-voice/care-voice-state';

interface StatusIndicatorsProps {
  state: CareVoiceState;
  className?: string;
}

export function StatusIndicators({ state, className }: StatusIndicatorsProps) {
  return (
    <div
      aria-live="polite"
      className={cn('flex w-full max-w-2xl flex-col items-center gap-4', className)}
    >
      <div className="flex items-center gap-3 rounded-full border border-border/60 bg-card/80 px-5 py-2.5 shadow-lg backdrop-blur-sm">
        <span
          className={cn('h-3 w-3 rounded-full', CARE_VOICE_STATE_CONFIG[state].dot)}
          aria-hidden="true"
        />
        <span className="text-sm font-semibold tracking-wide text-foreground">
          {CARE_VOICE_STATE_CONFIG[state].label}
        </span>
      </div>

      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5">
        {CARE_VOICE_STATE_ORDER.map((s) => {
          const active = s === state;
          return (
            <div
              key={s}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg border px-2 py-2 text-center transition-colors',
                active
                  ? 'border-primary/50 bg-primary/10 shadow-[0_0_12px_oklch(0.58_0.14_245/0.25)]'
                  : 'border-border/40 bg-card/40'
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  active ? CARE_VOICE_STATE_CONFIG[s].dot : 'bg-muted-foreground/30'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-xs font-medium',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {CARE_VOICE_STATE_CONFIG[s].label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
