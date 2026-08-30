import { motion } from 'framer-motion';

export function Scene3() {
  return (
    <motion.div className="scene" initial={{ opacity: 0, clipPath: 'inset(100% 0 0 0)', scale: 1.04 }} animate={{ opacity: 1, clipPath: 'inset(0% 0 0 0)', scale: 1 }} exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)', scale: .96 }} transition={{ duration: .95, ease: [0.16, 1, .3, 1] }}>
      <motion.div className="scene-kicker" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2, duration: .45 }}>02 / bounded memory</motion.div>
      <motion.h2 className="scene-title" initial={{ opacity: 0, y: 34 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .36, duration: .7 }}>Recall,<br /><em>not surveillance.</em></motion.h2>
      <motion.p className="scene-body" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .78, duration: .55 }}>Only relevant memories enter context. New memories are written explicitly — never by accident.</motion.p>
      <motion.img className="lattice-art" src={`${import.meta.env.BASE_URL}memory-lattice.png`} alt="" initial={{ opacity: 0, scale: 1.18, rotate: -4 }} animate={{ opacity: .38, scale: 1, rotate: -1 }} transition={{ delay: .22, duration: 1.35, ease: [0.16, 1, .3, 1] }} />
      <motion.div className="memory-rail" initial={{ scaleY: 0, transformOrigin: 'top' }} animate={{ scaleY: 1 }} transition={{ delay: .35, duration: .9 }} />
      {[
        ['launch cadence', 'recalled / relevant'],
        ['prefers direct answers', 'explicit write / user-approved'],
        ['friday launch', 'new signal / scoped'],
      ].map(([title, meta], index) => (
        <motion.div className={`memory-item ${['one','two','three'][index]}`} key={title} initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .62 + index * .22, duration: .55, ease: [0.16, 1, .3, 1] }}>
          <strong>{title}</strong><small>{meta}</small>
        </motion.div>
      ))}
      <motion.div className="retrieval-window" initial={{ opacity: 0, x: 60, rotate: 3 }} animate={{ opacity: 1, x: 0, rotate: 0 }} transition={{ delay: .4, duration: 1, ease: [0.16, 1, .3, 1] }}>
        <h3>Context window</h3><p>Bounded by relevance, ownership, and a clear write path.</p>
        {[['0.91','launch cadence'],['0.78','direct tone'],['0.64','friday launch']].map(([score, label], index) => (
          <motion.div className="retrieval-row" key={label} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + index * .17, duration: .42 }}><span className="score">{score}</span><span className="score-line"><motion.i initial={{ scaleX: 0 }} animate={{ scaleX: Number(score) }} transition={{ delay: 1.08 + index * .17, duration: .6 }} /></span><span className="mono" style={{ fontSize: '.68vw', color: 'rgba(220,239,227,.66)' }}>{label}</span></motion.div>
        ))}
        <motion.div className="bounded" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.75, duration: .45 }}>explicit memory write</motion.div>
      </motion.div>
    </motion.div>
  );
}