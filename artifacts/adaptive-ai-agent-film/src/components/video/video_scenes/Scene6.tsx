import { motion } from 'framer-motion';

export function Scene6() {
  return (
    <motion.div className="scene" initial={{ opacity: 0, scale: .97, clipPath: 'inset(0 0 0 100%)' }} animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0 0 0%)' }} exit={{ opacity: 0, scale: 1.04, clipPath: 'inset(0 100% 0 0)' }} transition={{ duration: 1.05, ease: [0.16, 1, .3, 1] }}>
      <motion.div className="scene-kicker" initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18, duration: .45 }}>05 / the architecture</motion.div>
      <motion.h2 className="scene-title" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35, duration: .68 }}>Four systems.<br /><em>One adaptive loop.</em></motion.h2>
      <div className="arch-map">
        <svg className="arch-lines" viewBox="0 0 1000 500" preserveAspectRatio="none"><motion.path d="M120 205 C290 205 280 75 390 75 S590 330 760 255 S860 115 900 115" stroke="#FF5B3D" strokeWidth="2" strokeDasharray="7 12" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: .35, duration: 1.6 }} /><motion.path d="M120 220 C310 350 490 380 620 270" stroke="#F3BD68" strokeWidth="1.5" strokeDasharray="3 10" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: .78, duration: 1.2 }} /></svg>
        {[
          ['firestore','Firestore','durable state'],
          ['qdrant','Qdrant','bounded recall'],
          ['gemini','Gemini','response engine'],
          ['client','React client','owned session'],
        ].map(([className,title,meta], index) => <motion.div className={`arch-node ${className}`} key={className} initial={{ opacity: 0, scale: .7, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: .62 + index * .17, duration: .55, type: 'spring', stiffness: 230, damping: 20 }}><div className="node-dot" /><strong>{title}</strong><small>{meta}</small></motion.div>)}
      </div>
      <motion.div className="arch-caption" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.65, duration: .6 }}><strong>Observe the loop.</strong>The interface stays simple because the boundaries stay explicit.</motion.div>
    </motion.div>
  );
}