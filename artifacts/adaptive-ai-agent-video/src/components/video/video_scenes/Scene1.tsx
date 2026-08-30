import { motion } from 'framer-motion';

export function Scene1() {
  return (
    <motion.div className="scene scene-open" initial={{ opacity: 0, scale: 1.08, clipPath: 'inset(0 100% 0 0)' }} animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0% 0 0)' }} exit={{ opacity: 0, scale: .94, clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 1.05, ease: [0.16, 1, .3, 1] }}>
      <motion.div className="scene-kicker" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .22, duration: .5 }}>Adaptive / system film / 01</motion.div>
      <motion.h1 className="scene-title" initial={{ opacity: 0, y: 42, rotate: -1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: .42, duration: .8, ease: [0.16, 1, .3, 1] }}>Context gets<br /><em>lost.</em> People pay.</motion.h1>
      <motion.p className="scene-body" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05, duration: .6 }}>Every conversation starts from zero. Every “remember this” becomes a trust exercise.</motion.p>
      <motion.div className="open-note" initial={{ opacity: 0, x: 40, rotate: 4 }} animate={{ opacity: 1, x: 0, rotate: 2 }} transition={{ delay: .8, duration: 1.1, ease: [0.16, 1, .3, 1] }}>An agent should adapt without becoming a black box.</motion.div>
      <div className="signal" aria-hidden="true">
        {[.25,.5,.36,.72,.46,.82,.57,.35,.64,.92,.6,.3].map((height, index) => <motion.span key={index} initial={{ height: 0, opacity: 0 }} animate={{ height: `${height * 100}%`, opacity: .35 + height / 2 }} transition={{ delay: .55 + index * .05, duration: .45, ease: 'easeOut' }} />)}
      </div>
    </motion.div>
  );
}