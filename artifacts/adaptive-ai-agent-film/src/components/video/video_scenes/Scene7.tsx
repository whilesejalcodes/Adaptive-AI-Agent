import { motion } from 'framer-motion';

export function Scene7() {
  return (
    <motion.div className="scene" initial={{ opacity: 0, scale: 1.06, clipPath: 'inset(0 0 100% 0)' }} animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0 0% 0)' }} exit={{ opacity: 0, scale: .96, clipPath: 'inset(100% 0 0 0)' }} transition={{ duration: .9, ease: [0.16, 1, .3, 1] }}>
      <div className="end-mark" />
      <div className="scene-kicker">Adaptive / system film / 07</div>
      <div className="end-lockup">
        <h2>Memory that<br /><span>knows its place.</span></h2>
        <div className="end-rule" />
        <p>Secure by default. Explicit by design. Adaptive in practice.</p>
      </div>
      <div className="end-brand">
        <strong>Adaptive AI Agent</strong>
        <small>React · Firebase · Gemini · Qdrant</small>
      </div>
    </motion.div>
  );
}