import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Check, Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '../store';
import StatusStepper from '../components/StatusStepper';
import LogConsole from '../components/LogConsole';
import ScoreBar from '../components/ScoreBar';
import ResultCard from '../components/ResultCard';
import EmptyState from '../components/EmptyState';
import type { MatchCandidate } from '../api/types';

function SecurityRow({ label, value, check }: { label: string; value: string; check?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid var(--pm-line)' }}>
      <span className="text-13 flex-1" style={{ color: 'var(--pm-muted)' }}>{label}</span>
      <span className="font-mono text-13" style={{ color: 'var(--pm-text)' }}>{value}</span>
      {check !== undefined && (
        check
          ? <Check size={12} style={{ color: 'var(--pm-ok)', flexShrink: 0 }} />
          : <Lock size={12} style={{ color: 'var(--pm-ok)', flexShrink: 0 }} />
      )}
    </div>
  );
}

function CandidateRow({ candidate, isWinner }: { candidate: MatchCandidate; isWinner: boolean }) {
  const { scores, eliminated, elimination_reason, device_name, capability_id } = candidate;

  return (
    <div
      className="p-3 rounded-input mb-2"
      style={{
        borderLeft: `3px solid ${isWinner ? 'var(--pm-gold)' : 'var(--pm-line)'}`,
        background: 'var(--pm-raised)',
        opacity: eliminated ? 0.6 : 1,
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <span style={{ color: isWinner ? 'var(--pm-ok)' : 'var(--pm-stop)', fontFamily: 'monospace' }}>
          {isWinner ? '✓' : '✗'}
        </span>
        <span className="text-13 font-medium" style={{
          color: 'var(--pm-text)',
          textDecoration: eliminated ? 'line-through' : 'none',
        }}>
          {device_name}
        </span>
        <span className="text-12" style={{ color: 'var(--pm-muted)' }}>· {capability_id}</span>
        {!eliminated && (
          <span className="ml-auto font-mono text-13" style={{ color: 'var(--pm-gold)' }}>
            {scores.total.toFixed(2)}
          </span>
        )}
        {eliminated && (
          <span className="ml-auto text-12 font-mono" style={{ color: 'var(--pm-stop)' }}>eliminated</span>
        )}
      </div>
      {eliminated && elimination_reason ? (
        <div className="text-12 font-mono" style={{ color: 'var(--pm-muted)' }}>{elimination_reason}</div>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1">
          {[
            ['fit',   scores.capability_fit],
            ['avail', scores.availability],
            ['lat',   scores.latency],
            ['rel',   scores.reliability],
            ['eff',   scores.efficiency],
          ].map(([label, value]) => (
            <ScoreBar key={label as string} label={label as string} value={value as number} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const job = useStore(s => id ? s.jobs[id] : undefined);
  const logsArr = useStore(useShallow(s => id ? (s.logs[id] ?? []) : []));
  const match = useStore(s => id ? s.matches[id] : undefined);
  const result = useStore(s => id ? s.results[id] : undefined);
  const [matchExpanded, setMatchExpanded] = useState(true);

  useEffect(() => {
    if (!id) return;
    useStore.getState().fetchMatch(id);
    if (job?.status === 'completed') useStore.getState().fetchResult(id);
  }, [id, job?.status]);

  useEffect(() => {
    if (job?.status === 'running') setMatchExpanded(false);
  }, [job?.status]);

  if (!job) {
    return <EmptyState message="Job not found." />;
  }

  const isRunning = job.status === 'running';
  const isDone = job.status === 'completed';

  const progressPct = job.progress ?? 0;
  const elapsedMs = job.started_at
    ? (job.finished_at ? new Date(job.finished_at).getTime() : Date.now()) - new Date(job.started_at).getTime()
    : 0;
  const elapsedSec = (elapsedMs / 1000).toFixed(1);

  function downloadResults() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_${job!.id}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-display text-24">Job detail</h1>
          <span className="font-mono text-13" style={{ color: 'var(--pm-faint)' }}>{job.id}</span>
        </div>
      </div>

      {/* a) Status rail */}
      <div
        className="p-4 rounded-card"
        style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
      >
        <StatusStepper status={job.status} />
      </div>

      {/* b) Match explanation */}
      {match && (
        <div
          className="rounded-card overflow-hidden"
          style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
        >
          <button
            onClick={() => setMatchExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-15 font-medium"
            style={{ color: 'var(--pm-text)' }}
          >
            Match explanation
            <span className="text-12 font-mono" style={{ color: 'var(--pm-faint)' }}>
              {matchExpanded ? '▲ collapse' : '▼ expand'}
            </span>
          </button>
          {matchExpanded && (
            <div className="px-4 pb-4">
              {match.candidates.map(c => (
                <CandidateRow
                  key={c.capability_id}
                  candidate={c}
                  isWinner={c.device_id === match.winner_device_id}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* c) Live execution */}
      {(isRunning || isDone || logsArr.length > 0) && (
        <div
          className="p-4 rounded-card"
          style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
        >
          <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 280px' }}>
            {/* Left: logs + progress */}
            <div>
              {/* Progress */}
              {(isRunning || progressPct > 0) && (
                <div className="mb-3">
                  <div className="flex justify-between text-12 font-mono mb-1" style={{ color: 'var(--pm-muted)' }}>
                    <span>{progressPct}% · {job.input_count} items</span>
                    <span>{elapsedSec}s elapsed</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--pm-raised)', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${progressPct}%`,
                        background: isDone ? 'var(--pm-ok)' : 'var(--pm-run)',
                        borderRadius: 2,
                        transition: 'width 300ms',
                      }}
                    />
                  </div>
                </div>
              )}
              <LogConsole lines={logsArr} />
            </div>

            {/* Right: security panel */}
            <div>
              <div className="text-13 font-medium mb-2" style={{ color: 'var(--pm-muted)' }}>Security panel</div>
              {result?.sandbox ? (
                <div>
                  <SecurityRow label="Network"         value={result.sandbox.network}          check={false} />
                  <SecurityRow label="Host filesystem" value={result.sandbox.filesystem}       check={false} />
                  <SecurityRow label="Workspace"       value="tmpfs, 256 MB"                  check={false} />
                  <SecurityRow label="Memory limit"    value={`${result.sandbox.memory_limit_mb} MB`} check={true} />
                  <SecurityRow label="CPU limit"       value={`${result.sandbox.cpu_limit_cores} cores`} check={true} />
                  <SecurityRow label="Runtime limit"   value={`${result.sandbox.runtime_limit_sec} s`} check={true} />
                  <SecurityRow label="Actual runtime"  value={`${result.sandbox.actual_runtime_sec} s`} />
                  <SecurityRow label="Workspace destroyed" value={new Date(result.sandbox.workspace_destroyed_at).toLocaleTimeString()} check={true} />
                </div>
              ) : (
                <div className="text-13 font-mono" style={{ color: 'var(--pm-faint)' }}>
                  {isRunning ? 'Enforcing limits…' : 'Awaiting execution'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* d) Result view */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div
              className="rounded-card overflow-hidden"
              style={{ background: 'var(--pm-cream)', border: '1px solid #e8dcc8' }}
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-18" style={{ color: '#3d3020' }}>Results</h2>
                  <button
                    onClick={downloadResults}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-input text-13 font-medium transition-colors"
                    style={{ border: '1px solid #c8b89a', color: '#7a6a50', background: 'transparent' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#f0e8d8'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Download size={13} />
                    Download results (JSON)
                  </button>
                </div>

                <div
                  className="grid gap-4 mb-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
                >
                  {result.items.map((item, i) => (
                    <ResultCard
                      key={i}
                      filename={item.filename}
                      thumbnailUrl={item.thumbnail_url}
                      predictions={item.predictions}
                      inferenceMs={item.inference_ms}
                    />
                  ))}
                </div>

                <div
                  className="text-13 font-mono pt-3"
                  style={{ borderTop: '1px solid #e0d0b8', color: '#9a8060' }}
                >
                  Executed on {result.executed_on.device_name} · {result.executed_on.capability_label}
                  {result.sandbox.actual_runtime_sec && ` · ${result.sandbox.actual_runtime_sec}s`}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
