import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ZappButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "accent" | "ghost";
  className?: string;
  disabled?: boolean;
}

const variants = {
  primary: "bg-primary text-primary-foreground shadow-glow-primary",
  secondary: "bg-secondary text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  ghost: "bg-foreground/5 text-foreground",
};

export default function ZappButton({ children, onClick, loading, variant = "primary", className, disabled }: ZappButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "h-14 w-full rounded-lg font-bold text-base flex items-center justify-center gap-2 transition-all disabled:opacity-50",
        variants[variant],
        className
      )}
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : children}
    </motion.button>
  );
}
