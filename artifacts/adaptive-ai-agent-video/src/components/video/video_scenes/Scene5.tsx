import { motion } from 'framer-motion';

export function Scene5() {
  return (
    <motion.div className="scene" initial={{ opacity: 0, clipPath: 'circle(0% at 18% 75%)' }} animate={{ opacity: 1, clipPath: 'circle(100% at 18% 75%)' }} exit={{ opacity: 0, clipPath: 'circle(0% at 82% 24%)' }} transition={{ duration: 1.05, ease: [0.16, 1, .3, 1] }}>
      <motion.div className="scene-kicker" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .24, duration: .45 }}>04 / ownership & limits</motion.div>
      <motion.h2 className="scene-title" initial={{ opacity: 0, y: 35 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .42, duration: .72 }}>Trust has<br /><em>boundaries.</em></motion.h2>
      <motion.p className="scene-body" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .86, duration: .55 }}>Every read is scoped to its owner. Every expensive path is rate-limited before it reaches the model.</motion.p>
      <motion.img className="secure-art" src={`${import.meta.env.BASE_URL}secure-core.png`} alt="" initial={{ opacity: 0, scale: .82, x: 40 }} animate={{ opacity: .27, scale: 1, x: 0 }} transition={{ delay: .25, duration: 1.2, ease: [0.16, 1, .3, 1] }} />
      <motion.div className="security-list">
        {[
          ['01','auth token verified','Firebase identity'],
          ['02','ownership enforced','Firestore rules + API'],
          ['03','request bounded','rate limit / retry safe'],
        ].map(([n, title, meta], index) => <motion.div className="security-row" key={n} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .6 + index * .2, duration: .5 }}><span className="check">{n}</span><span><b>{title}</b><small>{meta}</small></span></motion.div>)}
      </motion.div>
      <motion.div className="shield" initial={{ opacity: 0, scale: .75, rotate: -9 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: .38, duration: 1, ease: [0.16, 1, .3, 1] }}>
        <svg viewBox="0 0 200 220" fill="none" xmlns="http://www.w3.org/2000/svg"><motion.path d="M100 8L184 39V105C184 155 149 193 100 212C51 193 16 155 16 105V39L100 8Z" stroke="#F3BD68" strokeWidth="2" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: .45, duration: 1.2 }} /><motion.path d="M100 34L158 55V104C158 138 135 163 100 179C65 163 42 138 42 104V55L100 34Z" stroke="#FF5B3D" strokeWidth="1.5" strokeDasharray="5 7" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: .9 }} transition={{ delay: .9, duration: 1.2 }} /><motion.circle cx="100" cy="103" r="18" stroke="#DCEFE3" strokeWidth="2" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.35, type: 'spring', stiffness: 240, damping: 20 }} /><path d="M100 93V113M90 103H110" stroke="#DCEFE3" strokeWidth="2" /></svg>
      </motion.div>
      <motion.div className="rate-limit" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: .45 }}><i /> protection active / 40 req · min</motion.div>
    </motion.div>
  );
}