import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { JobStatus } from '../../../packages/contracts/src/index';
import type { CoordinatorJob, JobEvent } from '../api/coordinator';

const SAMPLE_INTERVAL_MS = 2_000;
const MAX_SAMPLE_COUNT = 18;

interface Sample {
  available: number;
  used: number;
}

function points(values: number[], width: number, height: number, maximum: number): string {
  if (values.length === 0) return '';
  const divisor = Math.max(values.length - 1, 1);
  return values.map((value, index) => {
    const x = (index / divisor) * width;
    const y = height - (value / Math.max(maximum, 1)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

export function CapacityGraph({ available, used }: { available: number; used: number }) {
  const reduceMotion = useReducedMotion();
  const [samples, setSamples] = useState<Sample[]>([{ available, used }]);

  useEffect(() => {
    const sample = (): void => {
      setSamples((current) => [...current, { available, used }].slice(-MAX_SAMPLE_COUNT));
    };
    sample();
    const timer = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [available, used]);

  const max = Math.max(1, ...samples.flatMap((sample) => [sample.available, sample.used]));
  const availablePoints = points(samples.map((sample) => sample.available), 420, 112, max);
  const usedPoints = points(samples.map((sample) => sample.used), 420, 112, max);

  return (
    <figure className="telemetry-figure">
      <figcaption>
        <span>Capacity pulse</span>
        <span className="telemetry-legend"><i className="is-lime" /> available <i className="is-blue" /> used</span>
      </figcaption>
      <svg viewBox="0 0 420 132" role="img" aria-label={`${available} available slots and ${used} used slots in this session`}>
        {[0, 1, 2, 3].map((line) => <line key={line} x1="0" x2="420" y1={line * 37.3} y2={line * 37.3} className="chart-grid" />)}
        <motion.polyline
          points={availablePoints}
          className="chart-line chart-line--available"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.35 }}
        />
        <motion.polyline
          points={usedPoints}
          className="chart-line chart-line--used"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, delay: reduceMotion ? 0 : 0.06 }}
        />
      </svg>
      <div className="telemetry-figure__footer">
        <span>this session</span>
        <strong>{Math.max(available - used, 0)} free / {available} total</strong>
      </div>
    </figure>
  );
}

const STATUS_GROUPS: { label: string; statuses: readonly JobStatus[]; color: string }[] = [
  { label: 'queued', statuses: ['SUBMITTED', 'QUEUED', 'AWAITING_APPROVAL'], color: 'var(--pm-warn)' },
  { label: 'active', statuses: ['APPROVED', 'RUNNING'], color: 'var(--pm-run)' },
  { label: 'completed', statuses: ['COMPLETED'], color: 'var(--pm-ok)' },
  { label: 'stopped', statuses: ['FAILED', 'REJECTED', 'CANCELLED', 'KILLED', 'EXPIRED'], color: 'var(--pm-stop)' },
];

export function JobDistribution({ jobs }: { jobs: CoordinatorJob[] }) {
  const grouped = STATUS_GROUPS.map((group) => ({
    ...group,
    count: jobs.filter((job) => group.statuses.includes(job.status)).length,
  }));
  const total = Math.max(jobs.length, 1);
  let cursor = 0;

  return (
    <figure className="distribution">
      <figcaption>Job state distribution</figcaption>
      <svg viewBox="0 0 500 22" role="img" aria-label={`Distribution of ${jobs.length} visible jobs`}>
        <rect x="0" y="2" width="500" height="18" fill="var(--pm-raised)" />
        {grouped.map((group) => {
          const width = (group.count / total) * 500;
          const x = cursor;
          cursor += width;
          return <rect key={group.label} x={x} y="2" width={width} height="18" fill={group.color} />;
        })}
      </svg>
      <div className="distribution__legend">
        {grouped.map((group) => (
          <span key={group.label}><i style={{ background: group.color }} /> {group.label} <strong>{group.count}</strong></span>
        ))}
      </div>
    </figure>
  );
}

interface ActivityPoint {
  value: number;
}

export function SseActivityGraph({ events }: { events: Record<string, JobEvent[]> }) {
  const reduceMotion = useReducedMotion();
  const eventCount = useMemo(
    () => Object.values(events).reduce((total, jobEvents) => total + jobEvents.length, 0),
    [events],
  );
  const previousCount = useRef(eventCount);
  const [samples, setSamples] = useState<ActivityPoint[]>([{ value: 0 }]);
  const [observedEvents, setObservedEvents] = useState(0);

  useEffect(() => {
    const delta = Math.max(0, eventCount - previousCount.current);
    previousCount.current = eventCount;
    setSamples((current) => [...current, { value: delta }].slice(-MAX_SAMPLE_COUNT));
    setObservedEvents((current) => current + delta);
  }, [eventCount]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSamples((current) => [...current, { value: 0 }].slice(-MAX_SAMPLE_COUNT));
    }, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const max = Math.max(1, ...samples.map((sample) => sample.value));
  const activityPoints = points(samples.map((sample) => sample.value), 420, 92, max);
  return (
    <figure className="telemetry-figure telemetry-figure--compact">
      <figcaption><span>SSE activity</span><span className="font-mono">this session</span></figcaption>
      <svg viewBox="0 0 420 108" role="img" aria-label={`${observedEvents} SSE events observed while this view is open`}>
        {[0, 1, 2].map((line) => <line key={line} x1="0" x2="420" y1={line * 46} y2={line * 46} className="chart-grid" />)}
        <motion.polyline
          points={activityPoints}
          className="chart-line chart-line--activity"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.3 }}
        />
      </svg>
      <div className="telemetry-figure__footer">
        <span>{observedEvents === 0 ? 'waiting for streamed job events' : `${observedEvents} events observed`}</span>
      </div>
    </figure>
  );
}

export function ReliabilityGauge({ score }: { score: number }) {
  const clamped = Math.min(1, Math.max(0, score));
  const circumference = 2 * Math.PI * 38;
  const dash = circumference * clamped;
  return (
    <div className="reliability-gauge">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${Math.round(clamped * 100)} percent reliability`}>
        <circle cx="50" cy="50" r="38" className="gauge-track" />
        <circle cx="50" cy="50" r="38" className="gauge-value" strokeDasharray={`${dash} ${circumference - dash}`} />
      </svg>
      <span><strong>{Math.round(clamped * 100)}%</strong><small>reliable</small></span>
    </div>
  );
}

export function HeartbeatSparkline({ lastHeartbeatAt }: { lastHeartbeatAt: string }) {
  const reduceMotion = useReducedMotion();
  const [samples, setSamples] = useState<number[]>([]);

  useEffect(() => {
    const sample = (): void => {
      const ageSeconds = Math.max(0, (Date.now() - Date.parse(lastHeartbeatAt)) / 1_000);
      setSamples((current) => [...current, ageSeconds].slice(-MAX_SAMPLE_COUNT));
    };
    sample();
    const timer = window.setInterval(sample, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [lastHeartbeatAt]);

  const maximum = Math.max(1, ...samples);
  const samplePoints = points(samples, 300, 68, maximum);
  const currentAge = samples[samples.length - 1] ?? 0;

  return (
    <figure className="heartbeat-sparkline">
      <figcaption><span>Heartbeat age</span><strong>{currentAge.toFixed(1)}s</strong></figcaption>
      <svg viewBox="0 0 300 78" role="img" aria-label={`Current provider heartbeat is ${currentAge.toFixed(1)} seconds old`}>
        <line x1="0" x2="300" y1="68" y2="68" className="chart-grid" />
        <motion.polyline
          points={samplePoints}
          className="chart-line chart-line--heartbeat"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        />
      </svg>
      <small>client sample · this session</small>
    </figure>
  );
}

export function MatchScoreVisual({ score }: { score: number | null }) {
  const percent = score === null ? 0 : Math.round(Math.min(1, Math.max(0, score)) * 100);
  return (
    <figure className="match-score">
      <figcaption><span>Coordinator match score</span><strong>{score === null ? 'pending' : `${percent}%`}</strong></figcaption>
      <svg viewBox="0 0 400 58" role="img" aria-label={score === null ? 'Match score pending' : `Coordinator match score ${percent} percent`}>
        <line x1="8" x2="392" y1="29" y2="29" className="match-score__track" />
        <line x1="8" x2={8 + (384 * percent) / 100} y1="29" y2="29" className="match-score__value" />
        {score !== null && <path d={`M ${8 + (384 * percent) / 100} 13 L ${1 + (384 * percent) / 100} 3 L ${15 + (384 * percent) / 100} 3 Z`} className="match-score__marker" />}
        <text x="8" y="53">0</text><text x="200" y="53" textAnchor="middle">0.5</text><text x="392" y="53" textAnchor="end">1.0</text>
      </svg>
    </figure>
  );
}

export function ProgressWaveform({ progress, complete }: { progress: number; complete: boolean }) {
  const bounded = Math.min(100, Math.max(0, progress));
  const bars = Array.from({ length: 32 }, (_, index) => 12 + Math.abs(Math.sin(index * 0.82)) * 30);
  return (
    <figure className="progress-waveform">
      <figcaption><span>Verified progress stream</span><strong>{bounded}%</strong></figcaption>
      <svg viewBox="0 0 512 56" preserveAspectRatio="none" role="img" aria-label={`Job progress ${bounded} percent`}>
        {bars.map((height, index) => {
          const active = (index / (bars.length - 1)) * 100 <= bounded;
          return (
            <rect
              key={index}
              x={index * 16 + 2}
              y={(56 - height) / 2}
              width="8"
              height={height}
              className={active ? complete ? 'is-complete' : 'is-active' : ''}
            />
          );
        })}
      </svg>
    </figure>
  );
}
