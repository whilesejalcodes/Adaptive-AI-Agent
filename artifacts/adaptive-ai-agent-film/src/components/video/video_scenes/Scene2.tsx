import { motion } from 'framer-motion';

export function Scene2() {
  return (
    <motion.div className="scene" initial={{ opacity: 0, scale: .94, clipPath: 'circle(0% at 88% 48%)' }} animate={{ opacity: 1, scale: 1, clipPath: 'circle(100% at 88% 48%)' }} exit={{ opacity: 0, scale: 1.07, clipPath: 'circle(0% at 12% 48%)' }} transition={{ duration: 1.05, ease: [0.16, 1, .3, 1] }}>
      <motion.div className="scene-kicker" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .24, duration: .45 }}>01 / authenticated entry</motion.div>
      <motion.h2 className="scene-title" initial={{ opacity: 0, x: -35 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .4, duration: .7, ease: [0.16, 1, .3, 1] }}>A private<br /><em>conversation.</em></motion.h2>
      <motion.p className="scene-body" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .85, duration: .55 }}>Firebase Authentication establishes the user. The agent only speaks inside an owned session.</motion.p>
      <motion.div className="chat-window" initial={{ opacity: 0, x: 60, rotate: 6, scale: .9 }} animate={{ opacity: 1, x: 0, rotate: 1.6, scale: 1 }} transition={{ delay: .3, duration: 1.1, ease: [0.16, 1, .3, 1] }}>
        <div className="window-bar"><div className="window-dots"><i /><i /><i /></div><span className="window-label">secure session / uid_72a</span></div>
        <div className="chat-stream">
          <motion.div className="bubble user" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .98, duration: .45 }}>I’m planning the launch sequence for Friday.</motion.div>
          <motion.div className="bubble agent" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: .45 }}><span className="chat-tag">retrieved context</span>Your launch notes point to a short, technical walkthrough. Want to keep that cadence?</motion.div>
          <motion.div className="bubble user" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.78, duration: .45 }}>Yes. Keep it direct.</motion.div>
        </div>
        <div className="composer">Message Adaptive… <b>↗</b></div>
        <motion.div className="lock-badge" initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1, type: 'spring', stiffness: 350, damping: 24 }}>◈ authenticated / owned</motion.div>
      </motion.div>
    </motion.div>
  );
}