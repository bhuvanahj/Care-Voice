import { ConnectionState } from 'livekit-client';
import type { AgentState } from '@livekit/components-react';

export type CareVoiceState = 'ready' | 'connecting' | 'listening' | 'speaking' | 'ended';

export const CARE_VOICE_STATE_ORDER: CareVoiceState[] = [
  'ready',
  'connecting',
  'listening',
  'speaking',
  'ended',
];

export const CARE_VOICE_STATE_CONFIG: Record<
  CareVoiceState,
  { label: string; hint: string; dot: string }
> = {
  ready: {
    label: 'Ready',
    hint: 'Tap start to talk with Care Voice',
    dot: 'bg-primary',
  },
  connecting: {
    label: 'Connecting',
    hint: 'Please wait a moment…',
    dot: 'bg-chart-3 animate-pulse',
  },
  listening: {
    label: 'Listening',
    hint: "I'm listening. Please speak now.",
    dot: 'bg-accent animate-pulse',
  },
  speaking: {
    label: 'Speaking',
    hint: 'Care Voice is responding…',
    dot: 'bg-primary animate-pulse',
  },
  ended: {
    label: 'Call Ended',
    hint: 'Thank you. Start a new conversation anytime.',
    dot: 'bg-muted-foreground',
  },
};

export function mapLiveKitToCareVoiceState(
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
