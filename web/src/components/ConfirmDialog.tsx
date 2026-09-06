import { AlertTriangle, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({ open, title, description, confirmLabel, busy = false, onConfirm, onClose }: Props) {
  const dialogRef = useFocusTrap(open, onClose);
  const reduceMotion = useReducedMotion();
  if (!open) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <motion.div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        className="confirm-dialog"
        initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
      >
        <div className="confirm-dialog__icon"><AlertTriangle size={19} /></div>
        <button type="button" className="dialog-close" onClick={onClose} disabled={busy} aria-label="Close confirmation"><X size={16} /></button>
        <p className="section-kicker">Explicit confirmation</p>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{description}</p>
        <div className="confirm-dialog__actions">
          <button type="button" onClick={onClose} disabled={busy}>Keep current state</button>
          <button type="button" className="is-danger" onClick={onConfirm} disabled={busy}>{busy ? 'Applying…' : confirmLabel}</button>
        </div>
      </motion.div>
    </div>
  );
}
