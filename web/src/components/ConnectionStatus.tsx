import { RefreshCw } from 'lucide-react';
import { useStore } from '../store';

interface Props {
  compact?: boolean;
}

const LABELS = {
  connecting: 'Connecting',
  open: 'Coordinator live',
  reconnecting: 'Reconnecting',
  failed: 'Connection failed',
} as const;

export default function ConnectionStatus({ compact = false }: Props) {
  const connection = useStore((state) => state.connection);
  const sessions = useStore((state) => state.sessions);
  const bootstrap = useStore((state) => state.bootstrap);
  const refresh = useStore((state) => state.refresh);
  const error = useStore((state) => state.error);
  const retryable = connection === 'failed' || connection === 'reconnecting';
  const color = connection === 'open'
    ? 'var(--pm-ok)'
    : connection === 'failed'
      ? 'var(--pm-stop)'
      : 'var(--pm-warn)';
  const label = LABELS[connection];

  function retry(): void {
    void (sessions === null ? bootstrap() : refresh());
  }

  if (compact) {
    return (
      <button
        type="button"
        className="connection-status connection-status--compact"
        onClick={retryable ? retry : undefined}
        title={error ?? label}
        aria-label={retryable ? `${label}. Retry coordinator connection` : label}
      >
        <span className="connection-status__dot" style={{ background: color }} />
      </button>
    );
  }

  return (
    <div className="connection-status" role="status" aria-live="polite">
      <span className="connection-status__dot" style={{ background: color }} />
      <div className="connection-status__copy">
        <span>{label}</span>
        <small>{connection === 'open' ? 'authenticated session' : error ?? 'checking coordinator'}</small>
      </div>
      {retryable && (
        <button type="button" className="connection-status__retry" onClick={retry} aria-label="Retry coordinator connection">
          <RefreshCw size={13} />
        </button>
      )}
    </div>
  );
}
