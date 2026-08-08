import { HeartPulse } from 'lucide-react';
import { FeatureCards } from '@/components/care-voice/feature-cards';
import { VoiceAgent } from '@/components/care-voice/voice-agent';

export function CareVoicePage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card/60">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <HeartPulse className="h-7 w-7" />
          </span>
          <div>
            <p className="font-heading text-2xl font-extrabold leading-none text-foreground">
              Care Voice
            </p>
            <p className="mt-1 text-base font-semibold text-accent">Your AI Health Companion</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center gap-14 px-6 py-12 sm:py-16">
        <section className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-balance font-heading text-4xl font-extrabold leading-tight text-foreground sm:text-5xl">
            Talk to your friendly health helper
          </h1>
          <p className="max-w-xl text-pretty text-xl leading-relaxed text-muted-foreground">
            Care Voice listens and speaks with you in your own language. Ask about your medicines,
            health and daily wellness — anytime.
          </p>
        </section>

        <VoiceAgent />

        <FeatureCards />
      </main>

      <footer className="border-t border-border bg-card/60">
        <div className="mx-auto max-w-3xl px-6 py-8 text-center text-base text-muted-foreground">
          <p className="text-pretty leading-relaxed">
            Care Voice offers general wellness support and is not a substitute for professional
            medical advice. In an emergency, please contact your doctor.
          </p>
        </div>
      </footer>
    </div>
  );
}
