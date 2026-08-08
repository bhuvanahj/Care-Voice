import { Pill, HeartPulse, Leaf, Languages } from 'lucide-react';

const FEATURES = [
  {
    icon: Pill,
    title: 'Medicine Reminders',
    description:
      'Gentle voice reminders so you never miss a dose. Just tell Care Voice your timings.',
    tone: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: HeartPulse,
    title: 'Healthy Lifestyle Tips',
    description:
      'Simple, daily tips on food, sleep and light exercise made for your routine.',
    tone: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Leaf,
    title: 'Wellness Guidance',
    description:
      'Friendly answers about staying calm, active and well — anytime you ask.',
    tone: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: Languages,
    title: 'Multilingual Support',
    description:
      'Speak in Hindi, English, Tamil, Bengali and more. Care Voice understands you.',
    tone: 'text-accent',
    bg: 'bg-accent/10',
  },
] as const;

export function FeatureCards() {
  return (
    <section aria-labelledby="features-heading" className="w-full">
      <h2
        id="features-heading"
        className="mb-8 text-balance text-center font-heading text-3xl font-bold text-foreground sm:text-4xl"
      >
        How Care Voice helps you every day
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description, tone, bg }) => (
          <article
            key={title}
            className="flex items-start gap-5 rounded-3xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:p-7"
          >
            <span
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${bg}`}
              aria-hidden="true"
            >
              <Icon className={`h-8 w-8 ${tone}`} />
            </span>
            <div>
              <h3 className="font-heading text-2xl font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-lg leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
