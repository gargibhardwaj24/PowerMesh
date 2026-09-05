import { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Network, Monitor, Upload, Home, User, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
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

const NAV_BG    = '#0B1526';
const NAV_HI    = '#172540';
const NAV_GOLD  = '#C9A24A';
const NAV_TEXT  = '#C8D8EC';
const NAV_MUTED = '#5E7A98';

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
      style={{ width: 192, background: NAV_BG, borderRight: '1px solid #172040' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 mb-2">
        <svg viewBox="0 0 28 28" width="28" height="28" style={{ flexShrink: 0 }}>
          <path d="M14 3 L25 9 L25 21 L14 27 L3 21 L3 9 Z" fill="none" stroke={NAV_GOLD} strokeWidth="1.8" />
          <circle cx="14" cy="14" r="3" fill={NAV_GOLD} />
        </svg>
        <span className="font-display text-15 tracking-wide" style={{ color: NAV_GOLD }}>
          PowerMesh
        </span>
      </div>

      {/* Nav links */}
      <div className="flex flex-col gap-0.5 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-13 font-medium transition-colors duration-150',
              isActive
                ? 'text-white'
                : 'hover:text-white',
            )}
            style={({ isActive }) => ({
              color: isActive ? '#fff' : NAV_MUTED,
              background: isActive ? NAV_HI : 'transparent',
              borderLeft: isActive ? `3px solid ${NAV_GOLD}` : '3px solid transparent',
            })}
          >
            <Icon size={15} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            {label}
          </NavLink>
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Identity switcher */}
      <div className="px-2 pb-4" ref={identityRef}>
        <button
          onClick={() => setIdentityOpen(v => !v)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-13 transition-colors"
          style={{
            color: NAV_TEXT,
            background: identityOpen ? NAV_HI : 'transparent',
          }}
          onMouseEnter={e => { if (!identityOpen) e.currentTarget.style.background = NAV_HI; }}
          onMouseLeave={e => { if (!identityOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-11 font-mono font-medium flex-shrink-0"
            style={{ background: '#24405F', color: NAV_GOLD }}
          >
            {viewingAs.slice(0, 2).toUpperCase()}
          </div>
          <span className="flex-1 text-left" style={{ color: NAV_TEXT }}>{viewingAs}</span>
          <ChevronDown size={12} style={{ color: NAV_MUTED, transform: identityOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
        </button>

        {identityOpen && (
          <div
            className="mt-1 rounded-lg overflow-hidden"
            style={{ background: NAV_HI, border: '1px solid #24405F' }}
          >
            <div className="px-3 py-1.5 text-11 uppercase tracking-wider" style={{ color: NAV_MUTED }}>
              Viewing as
            </div>
            {IDENTITIES.map(({ id, label }) => (
              <button
                key={id}
                className="w-full flex items-center gap-2 px-3 py-2 text-13 text-left transition-colors"
                style={{
                  color: viewingAs === id ? NAV_GOLD : NAV_TEXT,
                  background: viewingAs === id ? 'rgba(201,162,74,0.12)' : 'transparent',
                }}
                onMouseEnter={e => { if (viewingAs !== id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (viewingAs !== id) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => { setViewingAs(id); setIdentityOpen(false); }}
              >
                <User size={12} />
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
