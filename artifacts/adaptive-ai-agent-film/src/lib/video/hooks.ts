import { useEffect, useMemo, useRef, useState } from 'react';

declare global {
  interface Window {
    startRecording?: () => void;
    stopRecording?: () => void;
  }
}

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const keys = useMemo(() => Object.keys(durations), [durations]);
  const [currentScene, setCurrentScene] = useState(keys[0] ?? '');
  const indexRef = useRef(0);
  const hasStoppedRef = useRef(false);

  useEffect(() => {
    indexRef.current = 0;
    hasStoppedRef.current = false;
    setCurrentScene(keys[0] ?? '');
    window.startRecording?.();
    let timer: number | undefined;
    const advance = () => {
      const nextIndex = indexRef.current + 1;
      if (nextIndex >= keys.length) {
        if (!hasStoppedRef.current) {
          hasStoppedRef.current = true;
          window.stopRecording?.();
        }
        indexRef.current = 0;
        setCurrentScene(keys[0] ?? '');
        timer = window.setTimeout(advance, durations[keys[0]] ?? 3000);
        return;
      }
      indexRef.current = nextIndex;
      setCurrentScene(keys[nextIndex]);
      timer = window.setTimeout(advance, durations[keys[nextIndex]] ?? 3000);
    };
    timer = window.setTimeout(advance, durations[keys[0]] ?? 3000);
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [durations, keys]);

  return { currentScene };
}