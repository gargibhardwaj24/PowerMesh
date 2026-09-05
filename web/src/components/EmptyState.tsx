import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}

export default function EmptyState({ icon, message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      {icon && <div style={{ color: 'var(--pm-faint)' }}>{icon}</div>}
      <p className="text-15 max-w-xs" style={{ color: 'var(--pm-muted)' }}>{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
