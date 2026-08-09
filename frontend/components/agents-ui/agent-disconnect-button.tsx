'use client';

import { PhoneOffIcon } from 'lucide-react';
import { useSessionContext } from '@livekit/components-react';
import { Button } from '@/components/ui/button';

export function AgentDisconnectButton(props: any) {
  const { end, room } = useSessionContext() as any;

  const handleClick = async () => {
    try {
      if (room) {
        await room.disconnect();
      }
      if (end) {
        await end();
      }
    } catch (e) {
      console.error(e);
    }
    // Force UI reset
    window.location.href = '/';
  };

  return (
    <Button variant="destructive" onClick={handleClick} {...props}>
      <PhoneOffIcon className="mr-1" />
      END CALL
    </Button>
  );
}