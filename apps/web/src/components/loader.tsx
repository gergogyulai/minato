import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

export default function Loader() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <motion.div
        className="minato-panel flex items-center gap-3 px-4 py-3"
        initial={{ opacity: 0, y: 8, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Loader2 className="size-4 animate-spin text-primary" />
        <motion.span
          className="minato-data text-xs text-muted-foreground/80"
          animate={{ opacity: [0.65, 1, 0.65] }}
          transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          loading route...
        </motion.span>
      </motion.div>
    </div>
  );
}
