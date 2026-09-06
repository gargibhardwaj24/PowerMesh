import { useEffect } from 'react';
import { AlertTriangle, Check, Info, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useStore, type ToastMessage } from '../store';

const TOAST_LIFETIME_MS = 4_500;

function ToastItem({ toast }: { toast: ToastMessage }) {
  const dismissToast = useStore((state) => state.dismissToast);
  const reduceMotion = useReducedMotion();
  const Icon = toast.tone === 'success' ? Check : toast.tone === 'error' ? AlertTriangle : Info;

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), TOAST_LIFETIME_MS);
    return () => window.clearTimeout(timer);
  }, [dismissToast, toast.id]);

  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 18 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
      className={`toast toast--${toast.tone}`}
      role={toast.tone === 'error' ? 'alert' : 'status'}
    >
      <span className="toast__icon"><Icon size={15} /></span>
      <span className="toast__copy">
        <strong>{toast.title}</strong>
        {toast.detail !== undefined && <small>{toast.detail}</small>}
      </span>
      <button type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </motion.div>
  );
}

export default function ToastViewport() {
  const toasts = useStore((state) => state.toasts);

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} />)}
      </AnimatePresence>
    </div>
  );
}
