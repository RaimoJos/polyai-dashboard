import { useCallback, useRef } from 'react';

/**
 * Sound notification hook for print events
 */
export function useSoundAlerts(enabled = true) {
  const audioContextRef = useRef(null);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Some browsers start in "suspended" until user interaction
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume?.().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const playBeep = useCallback(
    (frequency = 440, duration = 200, type = 'sine') => {
      if (!enabled) return;

      try {
        const ctx = initAudio();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = frequency;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(
          0.01,
          ctx.currentTime + duration / 1000
        );

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration / 1000);
      } catch (err) {
        // Non-fatal: audio can be blocked by browser policy
      }
    },
    [enabled, initAudio]
  );

  const sounds = {
    printComplete: useCallback(() => {
      if (!enabled) return;
      playBeep(523, 150);
      setTimeout(() => playBeep(659, 150), 150);
      setTimeout(() => playBeep(784, 300), 300);
    }, [enabled, playBeep]),

    printFailed: useCallback(() => {
      if (!enabled) return;
      playBeep(440, 200);
      setTimeout(() => playBeep(349, 200), 200);
      setTimeout(() => playBeep(294, 400), 400);
    }, [enabled, playBeep]),

    alert: useCallback(() => {
      if (!enabled) return;
      playBeep(880, 100);
      setTimeout(() => playBeep(880, 100), 150);
      setTimeout(() => playBeep(880, 100), 300);
    }, [enabled, playBeep]),

    jobQueued: useCallback(() => {
      if (!enabled) return;
      playBeep(1047, 150);
    }, [enabled, playBeep]),

    printStarted: useCallback(() => {
      if (!enabled) return;
      playBeep(392, 100);
      setTimeout(() => playBeep(523, 150), 100);
    }, [enabled, playBeep]),

    error: useCallback(() => {
      if (!enabled) return;
      playBeep(200, 500, 'square');
    }, [enabled, playBeep]),

    click: useCallback(() => {
      if (!enabled) return;
      playBeep(1000, 50);
    }, [enabled, playBeep]),
  };

  return sounds;
}

export default useSoundAlerts;
