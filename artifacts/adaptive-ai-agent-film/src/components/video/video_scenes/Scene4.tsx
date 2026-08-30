import { motion } from 'framer-motion';

export function Scene4() {
  return (
    <motion.div className="scene" initial={{ opacity: 0, scale: 1.08, clipPath: 'polygon(100% 0,100% 0,100% 100%,100% 100%)' }} animate={{ opacity: 1, scale: 1, clipPath: 'polygon(0 0,100% 0,100% 100%,0 100%)' }} exit={{ opacity: 0, scale: .95, clipPath: 'polygon(0 0,0 0,0 100%,0 100%)' }} transition={{ duration: 1, ease: [0.16, 1, .3, 1] }}>
      <motion.div className="scene-kicker" initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .22, duration: .45 }}>03 / response adaptation</motion.div>
      <motion.h2 className="scene-title" initial={{ opacity: 0, x: -34 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .42, duration: .72 }}>Feedback becomes<br /><em>behavior.</em></motion.h2>
      <motion.p className="scene-body" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .88, duration: .55 }}>A simple signal — useful, not useful — tunes response style at the application layer.</motion.p>
      <motion.div className="feedback-card" initial={{ opacity: 0, x: 80, rotate: 6, scale: .88 }} animate={{ opacity: 1, x: 0, rotate: -2, scale: 1 }} transition={{ delay: .35, duration: 1.05, ease: [0.16, 1, .3, 1] }}>
        <h3>Directness ↑</h3><p>Positive feedback compounds into a clearer, more concise response pattern.</p>
        <div className="feedback-meter">{[35,50,44,70,84,100].map((height,index)=><motion.span key={height + index} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: .9 + index * .1, duration: .55, ease: [0.16, 1, .3, 1] }} style={{ height: `${height}%` }} />)}</div>
        <div className="feedback-label"><span>first turn</span><span>current turn</span></div>
      </motion.div>
      <motion.div className="adapt-arrow" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.22, duration: .7 }} />
      <motion.div className="response-chip" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.45, duration: .5 }}>style signal / applied</motion.div>
    </motion.div>
  );
}