import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useVideoPlayer } from '@/lib/video';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';
import { Scene6 } from './video_scenes/Scene6';
import { Scene7 } from './video_scenes/Scene7';

export const SCENE_DURATIONS = {
  problem: 5200,
  chat: 6200,
  memory: 6500,
  feedback: 5200,
  security: 5500,
  architecture: 6500,
  close: 4700,
};

const SCENES = [
  { key: 'problem', render: () => <Scene1 /> },
  { key: 'chat', render: () => <Scene2 /> },
  { key: 'memory', render: () => <Scene3 /> },
  { key: 'feedback', render: () => <Scene4 /> },
  { key: 'security', render: () => <Scene5 /> },
  { key: 'architecture', render: () => <Scene6 /> },
  { key: 'close', render: () => <Scene7 /> },
];

export interface VideoTemplateProps {
  durations?: Record<string, number>;
  loop?: boolean;
  onSceneChange?: (sceneKey: string) => void;
}

export function VideoTemplate({
  durations: requestedDurations = SCENE_DURATIONS,
  onSceneChange,
}: VideoTemplateProps = {}) {
  const durations = useMemo(() => requestedDurations, [requestedDurations]);
  const { currentScene } = useVideoPlayer({ durations });
  const baseSceneKey = currentScene.replace(/_r[12]$/, '');
  const activeIndex = Math.max(0, SCENES.findIndex((scene) => scene.key === baseSceneKey));
  const active = SCENES[activeIndex] ?? SCENES[0];

  useEffect(() => {
    onSceneChange?.(currentScene);
  }, [currentScene, onSceneChange]);

  return (
    <main className="video-frame" aria-label="Adaptive AI Agent system film">
      <div className="atmosphere">
        <motion.div className="atmosphere-grid" animate={{ x: `${activeIndex * -1.5}vw`, y: `${activeIndex * -1.2}vh`, opacity: activeIndex === 6 ? .2 : .14 }} transition={{ duration: 1.4, ease: [0.16, 1, .3, 1] }} />
        <motion.div className="orb orb-a" animate={{ x: [0, activeIndex * -2.4], y: [0, activeIndex * 1.5], scale: 1 + activeIndex * .035 }} transition={{ duration: 1.8, ease: 'easeInOut' }} />
        <motion.div className="orb orb-b" animate={{ x: activeIndex * 1.6, y: activeIndex * -1.4, scale: 1 - activeIndex * .018 }} transition={{ duration: 1.8, ease: 'easeInOut' }} />
        <motion.div className="orb orb-c" animate={{ x: activeIndex % 2 ? '14vw' : '-6vw', y: activeIndex > 3 ? '-11vh' : '8vh', opacity: activeIndex === 6 ? .22 : .62 }} transition={{ duration: 1.35, ease: [0.16, 1, .3, 1] }} />
      </div>
      <motion.div className="persistent-mark" animate={{ x: activeIndex === 6 ? '-1vw' : 0, opacity: activeIndex === 0 ? .9 : 1 }} transition={{ duration: .7 }}>
        <img className="mark-tile" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
        <span>Adaptive</span>
      </motion.div>
      <div className="progress-line"><motion.div className="progress-fill" animate={{ scaleX: (activeIndex + 1) / SCENES.length }} transition={{ duration: .6, ease: 'easeOut' }} /></div>
      <motion.div className="scene-counter" animate={{ opacity: .85 }}>{String(activeIndex + 1).padStart(2, '0')} / 07</motion.div>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div key={currentScene} style={{ position: 'absolute', inset: 0 }}>
          {active.render()}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}