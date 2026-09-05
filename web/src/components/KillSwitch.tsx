import { useState } from 'react';
import { Zap } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  label?: string;
  onConfirm: () => void;
  className?: string;
  size?: 'sm' | 'md';
}

export default function KillSwitch({ label = 'Stop all', onConfirm, className, size = 'md' }: Props) {
  const [confirming, setConfirming] = useState(false);

  function handleClick() {
    if (confirming) {
      onConfirm();
      setConfirming(false);
    } else {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'flex items-center gap-1.5 font-medium rounded-input transition-all duration-150',
        size === 'md' ? 'px-4 py-2 text-15' : 'px-2.5 py-1.5 text-13',
        confirming
          ? 'text-white'
          : 'text-[var(--pm-stop)] hover:bg-[var(--pm-stop)] hover:text-white',
        className,
      )}
      style={{
        border: '1px solid var(--pm-stop)',
        background: confirming ? 'var(--pm-stop)' : 'transparent',
      }}
    >
      <Zap size={size === 'md' ? 14 : 12} />
      {confirming ? 'Confirm stop' : label}
    </button>
  );
}
