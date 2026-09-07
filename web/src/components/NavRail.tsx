import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Activity, ChevronDown, Home, Monitor, Network, PanelLeftClose, Upload, User } from 'lucide-react';
import { useStore, type ViewingIdentity } from '../store';
import ConnectionStatus from './ConnectionStatus';

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

export default function NavRail() {
  const location = useLocation();
  const viewingAs = useStore((state) => state.viewingAs);
  const setViewingAs = useStore((state) => state.setViewingAs);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const identityRef = useRef<HTMLDivElement>(null);
  const expanded = hovered || pinned || identityOpen;
  const activeIndex = useMemo(() => {
    if (location.pathname.startsWith('/jobs/')) return 3;
    const index = NAV.findIndex((item) => item.to === location.pathname);
    return index < 0 ? 0 : index;
  }, [location.pathname]);

  useEffect(() => {
    if (!identityOpen) return;
    function onDown(e: MouseEvent) {
      if (identityRef.current && !identityRef.current.contains(e.target as Node))
        setIdentityOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [identityOpen]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key !== 'Escape') return;
      setIdentityOpen(false);
      setPinned(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="power-rail-slot">
      <nav
        className={`power-rail${expanded ? ' power-rail--expanded' : ''}`}
        aria-label="Primary navigation"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          className="power-rail__brand"
          onClick={() => setPinned((current) => !current)}
          aria-label={pinned ? 'Collapse Power Rail' : 'Expand Power Rail'}
          aria-expanded={expanded}
        >
          <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
            <path d="M14 2 L26 9 L26 23 L14 26 L2 23 L2 9 Z" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="3.5" fill="currentColor" />
          </svg>
          <span className="power-rail__label power-rail__wordmark">POWERMESH</span>
          <PanelLeftClose className="power-rail__pin" size={15} />
        </button>

        <div className="power-rail__routes">
          <span
            className="power-rail__track"
            aria-hidden="true"
            style={{ '--rail-progress': `${(activeIndex / (NAV.length - 1)) * 100}%` } as CSSProperties}
          >
            <span className="power-rail__energy" />
          </span>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `power-rail__route${isActive || (to === '/request' && location.pathname.startsWith('/jobs/')) ? ' is-active' : ''}`}
            aria-label={label}
          >
            <span className="power-rail__node"><Icon size={16} /></span>
            <span className="power-rail__label">{label}</span>
          </NavLink>
        ))}
        </div>

        <div className="power-rail__identity" ref={identityRef}>
          <ConnectionStatus compact={!expanded} />
          <button
            type="button"
            className="power-rail__identity-button"
            onClick={() => setIdentityOpen((current) => !current)}
            aria-haspopup="menu"
            aria-expanded={identityOpen}
          >
            <span className="power-rail__avatar">{viewingAs.slice(0, 2).toUpperCase()}</span>
            <span className="power-rail__label power-rail__identity-copy">
              <small>Viewing as</small>
              <strong>{viewingAs === 'gargi' ? 'Gargi · Provider' : 'Kavya · Requester'}</strong>
            </span>
            <ChevronDown className="power-rail__label" size={13} />
          </button>

          {identityOpen && expanded && (
            <div className="power-rail__identity-menu" role="menu" aria-label="Viewing identity">
            {IDENTITIES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="menuitemradio"
                aria-checked={viewingAs === id}
                onClick={() => { setViewingAs(id); setIdentityOpen(false); }}
              >
                <User size={12} />
                {label}
              </button>
            ))}
          </div>
        )}
        </div>

        <div className="power-dock__status" aria-hidden="true"><Activity size={13} /></div>
      </nav>
    </div>
  );
}
