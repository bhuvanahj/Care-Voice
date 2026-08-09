import { AlertTriangle, HeartPulse, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/shadcn/utils';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  isStarting?: boolean;
  permissionError?: boolean;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  isStarting = false,
  permissionError = false,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  return (
    <div ref={ref} className="flex w-full max-w-md flex-col items-center text-center">
      <section className="flex flex-col items-center">
        <span
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30"
          aria-hidden="true"
        >
          <HeartPulse className="h-10 w-10" />
        </span>

        <h1 className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl">
          Talk to your health helper
        </h1>
        <p className="mt-3 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Care Voice listens and speaks with you in your own language. Ask about medicines,
          wellness, and daily health — anytime.
        </p>

        <Button
          size="lg"
          onClick={onStartCall}
          disabled={isStarting}
          className={cn(
            'mt-8 h-12 w-64 rounded-full text-sm font-bold tracking-wide uppercase',
            'bg-primary text-primary-foreground shadow-[0_0_24px_oklch(0.58_0.14_245/0.35)]',
            'hover:bg-primary/90 hover:shadow-[0_0_32px_oklch(0.58_0.14_245/0.45)]'
          )}
        >
          {isStarting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting…
            </>
          ) : (
            startButtonText
          )}
        </Button>
      </section>

      {permissionError && (
        <div
          role="alert"
          className="mt-8 flex w-full items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-left"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-destructive">Microphone needed</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Microphone access is required. Please allow permission and try again.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
