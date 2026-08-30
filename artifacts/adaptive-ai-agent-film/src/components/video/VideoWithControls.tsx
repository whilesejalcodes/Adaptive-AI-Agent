import { ChevronDown, ChevronUp, Repeat } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSceneControls } from '@/hooks/useSceneControls';
import { SCENE_DURATIONS, VideoTemplate } from './VideoTemplate';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  problem: { title: 'The context gap', filePath: 'src/components/video/video_scenes/Scene1.tsx' },
  chat: { title: 'Private conversation', filePath: 'src/components/video/video_scenes/Scene2.tsx' },
  memory: { title: 'Memory that stays bounded', filePath: 'src/components/video/video_scenes/Scene3.tsx' },
  feedback: { title: 'Feedback becomes adaptation', filePath: 'src/components/video/video_scenes/Scene4.tsx' },
  security: { title: 'Security at every boundary', filePath: 'src/components/video/video_scenes/Scene5.tsx' },
  architecture: { title: 'The system map', filePath: 'src/components/video/video_scenes/Scene6.tsx' },
  close: { title: 'Adaptive by design', filePath: 'src/components/video/video_scenes/Scene7.tsx' },
};

function announceSceneSelection(index: number, sceneKeys: string[]) {
  const key = sceneKeys[index];
  const details = SCENE_DETAILS[key];
  if (!details?.filePath || typeof window === 'undefined' || window.self === window.top) return;

  window.parent.postMessage(
    {
      type: 'REPLIT_VIDEO_SCENE_SELECTED',
      payload: {
        sceneIndex: index,
        sceneCount: sceneKeys.length,
        sceneTitle: details.title,
        filePath: details.filePath,
        lineNumber: 1,
      },
    },
    '*',
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;

  const {
    sceneKeys,
    activeIndex,
    locked,
    mountKey,
    tick,
    durations,
    activeDuration,
    activeStartTime,
    totalDuration,
    onSceneChange,
    jumpTo,
    toggleLock,
  } = useSceneControls(SCENE_DURATIONS);

  const handleJumpTo = useCallback((index: number) => {
    jumpTo(index);
    announceSceneSelection(index, sceneKeys);
  }, [jumpTo, sceneKeys]);

  if (!isIframed) return <VideoTemplate />;

  return (
    <div className="video-with-controls">
      <VideoTemplate
        key={mountKey}
        durations={durations}
        onSceneChange={onSceneChange}
      />
      <ControlSensor
        sceneKeys={sceneKeys}
        activeIndex={activeIndex}
        locked={locked}
        activeDuration={activeDuration}
        activeStartTime={activeStartTime}
        totalDuration={totalDuration}
        tick={tick}
        onToggleLock={toggleLock}
        onJumpTo={handleJumpTo}
      />
    </div>
  );
}

interface ControlSensorProps {
  sceneKeys: string[];
  activeIndex: number;
  locked: boolean;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onToggleLock: () => void;
  onJumpTo: (index: number) => void;
}

function ControlSensor({
  sceneKeys,
  activeIndex,
  locked,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  onToggleLock,
  onJumpTo,
}: ControlSensorProps) {
  const sensorRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);

  const handleToggleCollapsed = useCallback(() => {
    setCollapsed((value) => {
      if (!value) {
        setHovering(false);
        setTapPinned(false);
      }
      return !value;
    });
  }, []);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return;
      if (sensorRef.current && !sensorRef.current.contains(event.target as Node)) {
        setTapPinned(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [collapsed, tapPinned]);

  const visible = !collapsed || hovering || tapPinned;

  return (
    <div
      ref={sensorRef}
      className="video-controls-sensor"
      onPointerEnter={(event) => event.pointerType === 'mouse' && setHovering(true)}
      onPointerLeave={(event) => event.pointerType === 'mouse' && setHovering(false)}
      onPointerDown={(event) => {
        if (event.pointerType !== 'mouse' && collapsed) setTapPinned(true);
      }}
    >
      <div className="video-controls-filler" aria-hidden="true" />
      <div className={`video-control-bar ${visible ? 'is-visible' : ''}`} aria-hidden={!visible}>
        <button
          type="button"
          className={`video-control-button ${locked ? 'is-active' : ''}`}
          onClick={onToggleLock}
          title={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
          aria-label={locked ? 'Loop current scene: on' : 'Loop current scene: off'}
          aria-pressed={locked}
        >
          <Repeat size={22} strokeWidth={1.8} />
        </button>
        <div className="video-control-divider" aria-hidden="true" />
        <PlaybackStatus
          sceneKeys={sceneKeys}
          activeIndex={activeIndex}
          activeDuration={activeDuration}
          activeStartTime={activeStartTime}
          totalDuration={totalDuration}
          tick={tick}
          onJumpTo={onJumpTo}
        />
        <button
          type="button"
          className="video-control-button"
          onClick={handleToggleCollapsed}
          title={collapsed ? 'Show controls' : 'Hide controls'}
          aria-label={collapsed ? 'Show controls' : 'Hide controls'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
        </button>
      </div>
    </div>
  );
}

interface PlaybackStatusProps {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  onJumpTo: (index: number) => void;
}

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  onJumpTo,
}: PlaybackStatusProps) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);

  useEffect(() => {
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setElapsed(elapsedBaseRef.current + (performance.now() - startedAt));
    }, 60);

    return () => {
      window.clearInterval(interval);
      elapsedBaseRef.current += performance.now() - startedAt;
    };
  }, [tick]);

  const progress = activeDuration > 0 ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(
    totalDuration,
    activeStartTime + Math.min(elapsed, activeDuration),
  );

  return (
    <>
      <div className="video-progress-segments">
        {sceneKeys.map((key, index) => (
          <button
            type="button"
            key={key}
            className="video-progress-segment"
            onClick={() => onJumpTo(index)}
            aria-label={`Jump to scene ${index + 1}`}
            aria-current={index === activeIndex ? 'true' : undefined}
          >
            <span
              className="video-progress-fill"
              style={{ width: `${index === activeIndex ? progress * 100 : index < activeIndex ? 100 : 0}%` }}
            />
          </button>
        ))}
      </div>
      <div className="video-scene-count" aria-label={`Scene ${activeIndex + 1} of ${sceneKeys.length}`}>
        {activeIndex + 1}/{sceneKeys.length}
      </div>
      <div className="video-playback-time" role="timer">
        {formatPlaybackTime(totalElapsed)} / {formatPlaybackTime(totalDuration)}
      </div>
    </>
  );
}

function formatPlaybackTime(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}