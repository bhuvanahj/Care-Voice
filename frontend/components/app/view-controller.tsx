'use client';

import { useTheme } from 'next-themes';
import { AnimatePresence, motion } from 'motion/react';
import { useSessionContext } from '@livekit/components-react';
import type { AppConfig } from '@/app-config';
import { AgentSessionView_01 } from '@/components/agents-ui/blocks/agent-session-view-01';
import { CARE_VOICE_STATE_CONFIG } from '@/components/care-voice/care-voice-state';
import { CareVoiceHeader } from '@/components/care-voice/care-voice-header';
import { StatusIndicators } from '@/components/care-voice/status-indicators';
import { useCareVoiceState } from '@/components/care-voice/use-care-voice-state';
import { WelcomeView } from '@/components/app/welcome-view';

const MotionWelcomeView = motion.create(WelcomeView);
const MotionSessionView = motion.create(AgentSessionView_01);

const VIEW_MOTION_PROPS = {
  variants: {
    visible: { opacity: 1 },
    hidden: { opacity: 0 },
  },
  initial: 'hidden',
  animate: 'visible',
  exit: 'hidden',
  transition: { duration: 0.5, ease: 'linear' },
};

interface ViewControllerProps {
  appConfig: AppConfig;
}

export function ViewController({ appConfig }: ViewControllerProps) {
  const { isConnected } = useSessionContext();
  const { resolvedTheme } = useTheme();
  const { state, permissionError, isStarting, handleStartCall } = useCareVoiceState();

  return (
    <div className="relative flex min-h-svh flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,oklch(0.58_0.14_245/0.12),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,oklch(0.68_0.15_155/0.08),transparent_50%)]" />

      <CareVoiceHeader />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-8">
        <StatusIndicators state={state} className="mb-8" />

        <p className="mb-6 max-w-md text-center text-sm text-muted-foreground">
          {CARE_VOICE_STATE_CONFIG[state].hint}
        </p>

        <AnimatePresence mode="wait">
          {!isConnected && (
            <MotionWelcomeView
              key="welcome"
              {...VIEW_MOTION_PROPS}
              startButtonText={appConfig.startButtonText}
              onStartCall={handleStartCall}
              isStarting={isStarting}
              permissionError={permissionError}
            />
          )}
          {isConnected && (
            <MotionSessionView
              key="session-view"
              {...VIEW_MOTION_PROPS}
              preConnectMessage="Care Voice is listening — ask about your health or wellness"
              supportsChatInput={appConfig.supportsChatInput}
              supportsVideoInput={appConfig.supportsVideoInput}
              supportsScreenShare={appConfig.supportsScreenShare}
              isPreConnectBufferEnabled={appConfig.isPreConnectBufferEnabled}
              audioVisualizerType={appConfig.audioVisualizerType ?? 'aura'}
              audioVisualizerColor={
                resolvedTheme === 'dark'
                  ? (appConfig.audioVisualizerColorDark ?? '#4ADE80')
                  : (appConfig.audioVisualizerColor ?? '#3B82C4')
              }
              audioVisualizerColorShift={appConfig.audioVisualizerColorShift}
              audioVisualizerBarCount={appConfig.audioVisualizerBarCount}
              audioVisualizerGridRowCount={appConfig.audioVisualizerGridRowCount}
              audioVisualizerGridColumnCount={appConfig.audioVisualizerGridColumnCount}
              audioVisualizerRadialBarCount={appConfig.audioVisualizerRadialBarCount}
              audioVisualizerRadialRadius={appConfig.audioVisualizerRadialRadius}
              audioVisualizerWaveLineWidth={appConfig.audioVisualizerWaveLineWidth}
              className="fixed inset-0 top-[52px]"
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 border-t border-border/30 px-6 py-4 text-center">
        <p className="mx-auto max-w-lg text-xs leading-relaxed text-muted-foreground">
          Care Voice offers general wellness support and is not a substitute for professional
          medical advice.
        </p>
      </footer>
    </div>
  );
}
