import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 500);
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="flex flex-col items-center"
          >
            <motion.div
              className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center mb-6 shadow-glow-primary"
              animate={{ boxShadow: ["0 0 20px -4px hsl(255 100% 62% / 0.3)", "0 0 40px -2px hsl(255 100% 62% / 0.6)", "0 0 20px -4px hsl(255 100% 62% / 0.3)"] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap size={40} className="text-primary-foreground" />
            </motion.div>
            <motion.h1
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-4xl font-extrabold tracking-tight mb-2"
            >
              zapp
            </motion.h1>
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm text-muted-foreground tracking-widest uppercase"
            >
              money moves faster.
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
