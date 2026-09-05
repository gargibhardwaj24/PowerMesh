import { useStore } from '../store';

export default function ConnectionBanner() {
  const connection = useStore(s => s.connection);

  if (connection === 'open') return null;

  const label = connection === 'connecting' ? 'Connecting to coordinator…'
    : connection === 'reconnecting' ? 'Reconnecting to coordinator…'
    : 'Connection failed — check coordinator';

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center text-13 font-mono py-1.5"
      style={{ background: '#FF8C00', color: '#0D0D0D', fontWeight: 700, border: '0 0 2px 0', borderBottom: '2px solid #0D0D0D', letterSpacing: '0.04em' }}
    >
      {label}
    </div>
  );
}
