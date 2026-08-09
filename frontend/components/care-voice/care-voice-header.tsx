import { HeartPulse } from 'lucide-react';

export function CareVoiceHeader() {
  return (
    <header className="border-b border-border/40 bg-card/30 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center gap-3 px-6 py-4">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_oklch(0.58_0.14_245/0.4)]"
          aria-hidden="true"
        >
          <HeartPulse className="h-5 w-5" />
        </span>
        <div>
          <p className="font-heading text-lg font-extrabold leading-none text-foreground">
            Care Voice
          </p>
          <p className="mt-0.5 text-xs font-medium text-accent">Your AI Health Companion</p>
        </div>
      </div>
    </header>
  );
}
