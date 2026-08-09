'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SessionEvent, useAgent, useSessionContext } from '@livekit/components-react';
import {
  mapLiveKitToCareVoiceState,
  type CareVoiceState,
} from '@/components/care-voice/care-voice-state';

export function useCareVoiceState() {
  const session = useSessionContext();
  const { state: agentState } = useAgent();
  const [showEnded, setShowEnded] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const wasConnected = useRef(false);
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

  useEffect(() => {
    if (session.isConnected) {
      wasConnected.current = true;
      setShowEnded(false);
      clearEndedTimer();
      return;
    }

    if (wasConnected.current) {
      wasConnected.current = false;
      setShowEnded(true);
      clearEndedTimer();
      endedTimer.current = setTimeout(() => setShowEnded(false), 2600);
    }
  }, [session.isConnected, clearEndedTimer]);

  const state: CareVoiceState = mapLiveKitToCareVoiceState(
    showEnded,
    session.isConnected,
    session.connectionState,
    agentState
  );

  const handleStartCall = useCallback(async () => {
    setPermissionError(false);
    setIsStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      await session.start({
        tracks: {
          microphone: { enabled: true },
        },
      });
    } catch {
      setPermissionError(true);
    } finally {
      setIsStarting(false);
    }
  }, [session]);

  return {
    state,
    permissionError,
    isStarting,
    handleStartCall,
  };
}
