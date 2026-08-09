'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionState } from 'livekit-client';
import { SessionEvent, type AgentState, useAgent, useSessionContext } from '@livekit/components-react';
import { Mic, MicOff, PhoneOff, Loader2, Volume2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/shadcn/utils';

type CareVoiceState = 'ready' | 'connecting' | 'listening' | 'speaking' | 'ended';

const STATE_CONFIG: Record<
  CareVoiceState,
  { label: string; hint: string; dot: string; ring: string }
> = {
  ready: {
    label: 'Ready',
    hint: 'Tap the microphone to start talking',
    dot: 'bg-primary',
    ring: 'ring-primary/25',
  },
  connecting: {
    label: 'Connecting',
    hint: 'Please wait a moment…',
    dot: 'bg-chart-3 animate-pulse',
    ring: 'ring-chart-3/30',
  },
  listening: {
    label: 'Listening',
    hint: "I'm listening. Please speak now.",
    dot: 'bg-accent animate-pulse',
    ring: 'ring-accent/30',
  },
  speaking: {
    label: 'Speaking',
    hint: 'Care Voice is responding…',
    dot: 'bg-primary animate-pulse',
    ring: 'ring-primary/30',
  },
  ended: {
    label: 'Call Ended',
    hint: 'Thank you. Tap to start a new conversation.',
    dot: 'bg-muted-foreground',
    ring: 'ring-border',
  },
};

const ORDER: CareVoiceState[] = ['ready', 'connecting', 'listening', 'speaking', 'ended'];

function mapLiveKitToCareVoiceState(
  showEnded: boolean,
  isConnected: boolean,
  connectionState: ConnectionState,
  agentState: AgentState
): CareVoiceState {
  if (showEnded) {
    return 'ended';
  }

  if (!isConnected) {
    if (connectionState === ConnectionState.Connecting) {
      return 'connecting';
    }
    return 'ready';
  }

  switch (agentState) {
    case 'connecting':
    case 'pre-connect-buffering':
    case 'initializing':
      return 'connecting';
    case 'speaking':
      return 'speaking';
    case 'listening':
    case 'thinking':
    case 'idle':
      return 'listening';
    default:
      return 'listening';
  }
}

export function VoiceAgent() {
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const [showEnded, setShowEnded] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const endedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearEndedTimer = useCallback(() => {
    if (endedTimer.current) {
      clearTimeout(endedTimer.current);
      endedTimer.current = null;
    }
  }, []);

  useEffect(() => clearEndedTimer, [clearEndedTimer]);

  useEffect(() => {
    const handleMediaDevicesError = () => {
      setPermissionError(true);
    };

    session.internal.emitter.on(SessionEvent.MediaDevicesError, handleMediaDevicesError);
    return () => {
      session.internal.emitter.off(SessionEvent.MediaDevicesError, handleMediaDevicesError);
    };
  }, [session]);

  const state = mapLiveKitToCareVoiceState(
    showEnded,
    session.isConnected,
    session.connectionState,
    agentState
  );

  const isActive =
    !showEnded &&
    (state === 'connecting' || state === 'listening' || state === 'speaking' || isStarting);
  const isEnded = state === 'ended';

const handleMicClick = async () => {
  // End call if already connected
  if (session.isConnected) {
    try {
      await session.end();
      setShowEnded(true);

      endedTimer.current = setTimeout(() => {
        setShowEnded(false);
      }, 2600);
    } catch (error) {
      console.error("Failed to end session:", error);
    }
    return;
  }

  // Start call
  setPermissionError(false);
  setIsStarting(true);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    stream.getTracks().forEach((track) => track.stop());

    await session.start({
      tracks: {
        microphone: { enabled: true },
      },
    });
  } catch (error) {
    console.error(error);
    setPermissionError(true);
  } finally {
    setIsStarting(false);
  }
};

  const config = STATE_CONFIG[state];

  return (
    <section aria-label="Voice assistant" className="flex w-full flex-col items-center gap-8">
      <div
        aria-live="polite"
        className="flex items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-sm"
      >
        <span className={cn('h-3.5 w-3.5 rounded-full', config.dot)} aria-hidden="true" />
        <span className="text-xl font-bold text-foreground">{config.label}</span>
      </div>

      <div className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
        {(state === 'listening' || state === 'speaking') && (
          <>
            <span
              className={cn(
                'cv-ripple absolute h-48 w-48 rounded-full sm:h-52 sm:w-52',
                state === 'listening' ? 'bg-accent/25' : 'bg-primary/25'
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                'cv-ripple absolute h-48 w-48 rounded-full sm:h-52 sm:w-52',
                state === 'listening' ? 'bg-accent/20' : 'bg-primary/20'
              )}
              style={{ animationDelay: '0.9s' }}
              aria-hidden="true"
            />
          </>
        )}

        <button
          type="button"
          onClick={handleMicClick}
          disabled={isStarting && !session.isConnected}
          aria-label={
            isActive
              ? 'End conversation'
              : isEnded
                ? 'Start a new conversation'
                : 'Start talking to Care Voice'
          }
          className={cn(
            'relative flex h-44 w-44 items-center justify-center rounded-full text-primary-foreground shadow-xl ring-8 transition-all duration-300 focus-visible:outline-none focus-visible:ring-8 focus-visible:ring-offset-4 focus-visible:ring-offset-background active:scale-95 sm:h-52 sm:w-52',
            config.ring,
            (state === 'listening' || state === 'speaking') && 'cv-breathe',
            state === 'listening'
              ? 'bg-accent hover:bg-accent/90'
              : isEnded
                ? 'bg-muted-foreground hover:bg-muted-foreground/90'
                : 'bg-primary hover:bg-primary/90',
            isStarting && !session.isConnected && 'pointer-events-none opacity-90'
          )}
        >
          {state === 'connecting' || isStarting ? (
            <Loader2 className="h-20 w-20 animate-spin" aria-hidden="true" />
          ) : state === 'speaking' ? (
            <Volume2 className="h-20 w-20" aria-hidden="true" />
          ) : isEnded ? (
            <PhoneOff className="h-20 w-20" aria-hidden="true" />
          ) : permissionError ? (
            <MicOff className="h-20 w-20" aria-hidden="true" />
          ) : (
            <Mic className="h-20 w-20" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="max-w-md text-balance text-center text-xl leading-relaxed text-muted-foreground">
        {config.hint}
      </p>

      {permissionError && (
        <div
          role="alert"
          className="flex w-full max-w-md items-start gap-4 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5 text-left"
        >
          <AlertTriangle
            className="mt-0.5 h-8 w-8 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <div>
            <p className="text-lg font-bold text-destructive">Microphone needed</p>
            <p className="mt-1 text-lg leading-relaxed text-foreground">
              Microphone access is required. Please allow microphone permission and refresh.
            </p>
          </div>
        </div>
      )}

      <div className="mt-2 grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-5">
        {ORDER.map((s) => {
          const active = s === state;
          return (
            <div
              key={s}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3 text-center transition-colors',
                active ? 'border-primary bg-primary/10' : 'border-border bg-card'
              )}
            >
              <span
                className={cn(
                  'h-3 w-3 shrink-0 rounded-full',
                  active ? STATE_CONFIG[s].dot : 'bg-muted-foreground/40'
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-base font-semibold',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {STATE_CONFIG[s].label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
