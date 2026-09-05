import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Network, Monitor, Upload, Home, User, ChevronDown } from 'lucide-react';
import { useStore, type ViewingIdentity } from '../store';

const NAV = [
  { to: '/',         icon: Home,    label: 'Overview' },
  { to: '/network',  icon: Network, label: 'Network Mesh' },
  { to: '/provider', icon: Monitor, label: 'Provider Console' },
  { to: '/request',  icon: Upload,  label: 'Requester Studio' },
];

const IDENTITIES: { id: ViewingIdentity; label: string }[] = [
  { id: 'gargi', label: 'Gargi · Provider' },
  { id: 'kavya', label: 'Kavya · Requester' },
];

const BG      = '#0D0D0D';
const HI      = '#1A1A1A';
const LIME    = '#D4FF00';
const TEXT    = '#F0F0F0';
const MUTED   = '#888888';

export default function NavRail() {
  const viewingAs = useStore(s => s.viewingAs);
  const setViewingAs = useStore(s => s.setViewingAs);
  const [identityOpen, setIdentityOpen] = useState(false);
  const identityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!identityOpen) return;
    function onDown(e: MouseEvent) {
      if (identityRef.current && !identityRef.current.contains(e.target as Node))
        setIdentityOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [identityOpen]);

  return (
    <nav
      className="flex flex-col flex-shrink-0"
      style={{ width: 192, background: BG, borderRight: `3px solid ${LIME}` }}
    >
      {/* Logo */}
      <div className="px-4 py-5 mb-1" style={{ borderBottom: `1px solid #222` }}>
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 28" width="22" height="22" style={{ flexShrink: 0 }}>
            <path d="M14 2 L26 9 L26 23 L14 26 L2 23 L2 9 Z" fill="none" stroke={LIME} strokeWidth="2.5" />
            <circle cx="14" cy="14" r="3.5" fill={LIME} />
          </svg>
          <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: '15px', color: LIME, letterSpacing: '0.04em' }}>
            POWERMESH
          </span>
        </div>
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-0.5 px-2 pt-3">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '3px',
              fontSize: '13px',
              fontWeight: isActive ? 700 : 500,
              color: isActive ? '#0D0D0D' : MUTED,
              background: isActive ? LIME : 'transparent',
              textDecoration: 'none',
              transition: 'color 0.1s, background 0.1s',
              border: isActive ? `2px solid #0D0D0D` : '2px solid transparent',
            })}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              if (!el.style.background || el.style.background === 'transparent')
                el.style.color = TEXT;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              if (el.style.background === 'transparent')
                el.style.color = MUTED;
            }}
          >
            {({ isActive }) => (
              <>
                <Icon size={14} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="flex-1" />

      {/* Identity switcher */}
      <div className="px-2 pb-4" ref={identityRef} style={{ borderTop: '1px solid #222', paddingTop: '12px' }}>
        <button
          onClick={() => setIdentityOpen(v => !v)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-13 transition-colors"
          style={{
            color: TEXT,
            background: identityOpen ? HI : 'transparent',
            border: `2px solid ${identityOpen ? '#333' : 'transparent'}`,
            borderRadius: '3px',
            cursor: 'pointer',
          }}
        >
          <div
            className="w-6 h-6 flex items-center justify-center text-11 font-medium flex-shrink-0"
            style={{ background: LIME, color: '#0D0D0D', borderRadius: '2px', fontFamily: 'JetBrains Mono', fontWeight: 700 }}
          >
            {viewingAs.slice(0, 2).toUpperCase()}
          </div>
          <span className="flex-1 text-left" style={{ color: TEXT, fontWeight: 500 }}>{viewingAs}</span>
          <ChevronDown size={12} style={{ color: MUTED, transform: identityOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </button>

        {identityOpen && (
          <div
            className="mt-1 overflow-hidden"
            style={{ background: HI, border: '2px solid #333', borderRadius: '3px' }}
          >
            <div className="px-3 py-1.5 neo-label" style={{ color: MUTED }}>
              Viewing as
            </div>
            {IDENTITIES.map(({ id, label }) => (
              <button
                key={id}
                className="w-full flex items-center gap-2 px-3 py-2 text-13 text-left"
                style={{
                  color: viewingAs === id ? LIME : TEXT,
                  background: viewingAs === id ? 'rgba(212,255,0,0.1)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: viewingAs === id ? 700 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (viewingAs !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (viewingAs !== id) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setViewingAs(id); setIdentityOpen(false); }}
              >
                <User size={11} style={{ color: viewingAs === id ? LIME : MUTED }} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
