import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] flex flex-col rounded-t-[24px] glass-card"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            <div className="flex items-center justify-between p-5 pb-2 shrink-0">
              <h2 className="text-lg font-bold tracking-tight">{title}</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-foreground/5">
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            <div className="px-5 pb-8 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
