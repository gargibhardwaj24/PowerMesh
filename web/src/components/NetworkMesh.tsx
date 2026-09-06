import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CoordinatorJob, ProviderCapability, ProviderDevice } from '../api/coordinator';

const ACTIVE_JOB_STATUSES = new Set(['APPROVED', 'RUNNING']);
const WIDTH = 760;
const HEIGHT = 430;
const CENTRE_X = WIDTH / 2;
const CENTRE_Y = HEIGHT / 2;
const RADIUS_X = 270;
const RADIUS_Y = 150;

interface DevicePoint {
  device: ProviderDevice;
  x: number;
  y: number;
  capabilities: ProviderCapability[];
  activeJobs: CoordinatorJob[];
}

interface Props {
  devices: ProviderDevice[];
  capabilities: ProviderCapability[];
  jobs: CoordinatorJob[];
  onJobSelect: (jobId: string) => void;
}

export default function NetworkMesh({ devices, capabilities, jobs, onJobSelect }: Props) {
  const reduceMotion = useReducedMotion();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const points = useMemo<DevicePoint[]>(() => devices.map((device, index) => {
    const angle = devices.length === 1 ? -Math.PI / 2 : (index / devices.length) * Math.PI * 2 - Math.PI / 2;
    return {
      device,
      x: CENTRE_X + Math.cos(angle) * RADIUS_X,
      y: CENTRE_Y + Math.sin(angle) * RADIUS_Y,
      capabilities: capabilities.filter((capability) => capability.deviceId === device.id),
      activeJobs: jobs.filter((job) => job.deviceId === device.id && ACTIVE_JOB_STATUSES.has(job.status)),
    };
  }), [capabilities, devices, jobs]);
  const selected = points.find((point) => point.device.id === selectedDeviceId) ?? points[0] ?? null;

  function selectDevice(deviceId: string): void {
    setSelectedDeviceId(deviceId);
  }

  return (
    <section className="mesh-stage" aria-labelledby="mesh-title">
      <div className="mesh-stage__header">
        <div>
          <p className="section-kicker">Live topology</p>
          <h2 id="mesh-title">Coordinator mesh</h2>
        </div>
        <div className="mesh-stage__legend">
          <span><i className="is-live" /> online</span>
          <span><i className="is-job" /> active job</span>
          <span><i className="is-capability" /> capability</span>
        </div>
      </div>

      <div className="mesh-stage__canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Network mesh with ${devices.length} provider nodes and ${capabilities.length} capabilities`}>
          <defs>
            <pattern id="mesh-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#2a2a2a" strokeWidth="1" />
            </pattern>
            <filter id="lime-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <rect width={WIDTH} height={HEIGHT} fill="url(#mesh-grid)" />

          {points.map((point) => {
            const hasActiveJob = point.activeJobs.length > 0;
            return (
              <g key={`link-${point.device.id}`}>
                <line
                  x1={CENTRE_X}
                  y1={CENTRE_Y}
                  x2={point.x}
                  y2={point.y}
                  className={hasActiveJob ? 'mesh-link mesh-link--active' : 'mesh-link'}
                />
                {hasActiveJob && (
                  <motion.circle
                    r="5"
                    fill="var(--pm-run)"
                    initial={false}
                    animate={reduceMotion ? { cx: point.x, cy: point.y } : {
                      cx: [CENTRE_X, point.x],
                      cy: [CENTRE_Y, point.y],
                    }}
                    transition={{ duration: 1.6, repeat: reduceMotion ? 0 : Infinity, ease: 'linear' }}
                  />
                )}
              </g>
            );
          })}

          <g className="mesh-coordinator">
            <polygon points="380,166 423,190 423,240 380,264 337,240 337,190" />
            <circle cx={CENTRE_X} cy={CENTRE_Y} r="10" />
            <text x={CENTRE_X} y={CENTRE_Y + 72} textAnchor="middle">COORDINATOR</text>
          </g>

          {points.map((point) => {
            const online = point.device.status === 'ONLINE';
            const selectedNode = selected?.device.id === point.device.id;
            return (
              <g
                key={point.device.id}
                className={`mesh-node${selectedNode ? ' is-selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${point.device.name}, ${point.device.status.toLowerCase()}, ${point.capabilities.length} capabilities`}
                onClick={() => selectDevice(point.device.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectDevice(point.device.id);
                  }
                }}
              >
                <circle cx={point.x} cy={point.y} r="31" className="mesh-node__halo" />
                <circle cx={point.x} cy={point.y} r="23" className={online ? 'mesh-node__core is-online' : 'mesh-node__core'} />
                <circle cx={point.x + 18} cy={point.y - 18} r="6" className={online ? 'mesh-node__status is-online' : 'mesh-node__status'} />
                {point.capabilities.slice(0, 5).map((capability, capabilityIndex) => {
                  const angle = (capabilityIndex / Math.max(point.capabilities.length, 1)) * Math.PI * 2;
                  return (
                    <circle
                      key={capability.id}
                      cx={point.x + Math.cos(angle) * 41}
                      cy={point.y + Math.sin(angle) * 41}
                      r="4.5"
                      className={capability.status === 'ACTIVE' ? 'mesh-capability is-active' : 'mesh-capability'}
                    />
                  );
                })}
                <text x={point.x} y={point.y + 55} textAnchor="middle">{point.device.name.slice(0, 18)}</text>
              </g>
            );
          })}
        </svg>

        {devices.length === 0 && (
          <div className="mesh-stage__empty">
            <strong>Mesh is waiting for its first provider.</strong>
            <span>Register a capability-bounded provider node to activate the topology.</span>
          </div>
        )}
      </div>

      {selected !== null && (
        <div className="mesh-inspector">
          <div>
            <span className="mesh-inspector__status" data-online={selected.device.status === 'ONLINE'} />
            <div><strong>{selected.device.name}</strong><small>{selected.device.platform} · capability provider</small></div>
          </div>
          <dl>
            <div><dt>Heartbeat</dt><dd>{new Date(selected.device.lastHeartbeatAt).toLocaleTimeString()}</dd></div>
            <div><dt>Capabilities</dt><dd>{selected.capabilities.length}</dd></div>
            <div><dt>Live jobs</dt><dd>{selected.activeJobs.length}</dd></div>
            <div><dt>Isolation</dt><dd>{selected.device.hardware?.executionIsolation ?? 'unreported'}</dd></div>
          </dl>
          {selected.activeJobs[0] !== undefined && (
            <button type="button" onClick={() => onJobSelect(selected.activeJobs[0].id)}>Open active job →</button>
          )}
        </div>
      )}
    </section>
  );
}
