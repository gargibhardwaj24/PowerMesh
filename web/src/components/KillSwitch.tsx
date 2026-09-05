import { useState } from 'react';
import { Zap } from 'lucide-react';

const RED   = '#FF2424';
const BLACK = '#0D0D0D';

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

  const pad = size === 'md' ? '9px 18px' : '6px 12px';
  const fs  = size === 'md' ? '14px' : '12px';

  return (
    <button
      onClick={handleClick}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 700,
        fontFamily: 'Instrument Sans',
        fontSize: fs,
        padding: pad,
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'transform 0.08s ease, box-shadow 0.08s ease',
        background: confirming ? RED : 'transparent',
        color: confirming ? '#FFFFFF' : RED,
        border: `2.5px solid ${RED}`,
        boxShadow: confirming ? `3px 3px 0 ${BLACK}` : `2px 2px 0 ${RED}`,
        letterSpacing: '0.02em',
      }}
      onMouseEnter={e => {
        if (!confirming) {
          e.currentTarget.style.background = RED;
          e.currentTarget.style.color = '#FFFFFF';
          e.currentTarget.style.transform = 'translate(-1px, -1px)';
          e.currentTarget.style.boxShadow = `3px 3px 0 ${BLACK}`;
        }
      }}
      onMouseLeave={e => {
        if (!confirming) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = RED;
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = `2px 2px 0 ${RED}`;
        }
      }}
    >
      <Zap size={size === 'md' ? 13 : 11} fill={confirming ? '#FFFFFF' : 'none'} />
      {confirming ? '⚠ Confirm stop' : label}
    </button>
  );
}
