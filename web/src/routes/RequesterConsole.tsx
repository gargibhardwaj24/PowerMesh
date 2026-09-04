import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Brain, Cpu, Video, Layers, Send, AlertTriangle } from 'lucide-react';
import { useStore } from '../store';
import { api } from '../api';
import UploadZone from '../components/UploadZone';
import type { CapabilityType } from '../api/types';

const CAP_TYPES: { type: CapabilityType; label: string; sub: string; icon: typeof Brain; color: string }[] = [
  { type: 'ai_inference',    label: 'AI Inference',    sub: 'Image classification, vision models', icon: Brain,  color: '#7C3AED' },
  { type: 'cpu_compute',     label: 'CPU Compute',     sub: 'General-purpose parallel workloads',  icon: Cpu,    color: '#2563EB' },
  { type: 'video_transcode', label: 'Video Transcode', sub: 'Encoding, compression, conversion',   icon: Video,  color: '#DB2777' },
  { type: 'embeddings',      label: 'Embeddings',      sub: 'Text vectorisation, semantic search', icon: Layers, color: '#059669' },
];

export default function RequesterConsole() {
  const navigate = useNavigate();
  const viewingAs = useStore(s => s.viewingAs);
  const capsMap = useStore(useShallow(s => s.capabilities));
  const devicesMap = useStore(useShallow(s => s.devices));
  const liveCaps = useMemo(
    () => Object.values(capsMap).filter(c => c.enabled && !c.revoked),
    [capsMap],
  );

  const [selectedType, setSelectedType] = useState<CapabilityType | null>(null);
  const [selectedCapId, setSelectedCapId] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchingCaps = useMemo(
    () => selectedType ? liveCaps.filter(c => c.type === selectedType) : [],
    [liveCaps, selectedType],
  );

  const selectedCap = selectedCapId ? capsMap[selectedCapId] : null;
  const tooManyFiles = selectedCap && files.length > selectedCap.max_input_items;

  const canSubmit =
    selectedType !== null &&
    files.length > 0 &&
    matchingCaps.length > 0 &&
    !tooManyFiles &&
    !submitting;

  function pickType(type: CapabilityType) {
    setSelectedType(type);
    setSelectedCapId(null);
  }

  async function handleSubmit() {
    if (!selectedType) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await api.submitJob(files, selectedType, viewingAs);
      navigate(`/jobs/${job.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed');
      setSubmitting(false);
    }
  }

  const fmtMem = (mb: number) => mb >= 1024 ? `${mb / 1024} GB` : `${mb} MB`;
  const fmtTime = (s: number) => s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-24" style={{ color: 'var(--pm-text)' }}>Requester Studio</h1>
        <p className="text-13 mt-0.5" style={{ color: 'var(--pm-muted)' }}>
          Dispatch compute jobs to peer providers — sandboxed, approved, audited
        </p>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Left column */}
        <div className="space-y-5">

          {/* Step 1: Capability type */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-11 font-mono font-semibold"
                style={{ background: 'var(--pm-run)', color: '#fff' }}
              >1</div>
              <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Capability type</h2>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {CAP_TYPES.map(({ type, label, sub, icon: Icon, color }) => {
                const count = liveCaps.filter(c => c.type === type).length;
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => pickType(type)}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{
                      background: active ? `${color}0D` : 'var(--pm-surface)',
                      border: `1.5px solid ${active ? color : 'var(--pm-line)'}`,
                      boxShadow: active ? `0 0 0 3px ${color}18` : 'none',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18` }}
                      >
                        <Icon size={16} style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-13 font-semibold" style={{ color: active ? color : 'var(--pm-text)' }}>{label}</div>
                        <div className="text-11 leading-tight mt-0.5" style={{ color: 'var(--pm-muted)' }}>{sub}</div>
                        <div
                          className="text-11 font-mono mt-1.5"
                          style={{ color: count > 0 ? 'var(--pm-ok)' : 'var(--pm-faint)' }}
                        >
                          {count > 0 ? `${count} provider${count !== 1 ? 's' : ''} online` : 'no providers'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Upload */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-11 font-mono font-semibold"
                style={{ background: 'var(--pm-run)', color: '#fff' }}
              >2</div>
              <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Input files</h2>
            </div>
            <UploadZone files={files} onChange={setFiles} />

            {tooManyFiles && (
              <div className="mt-2 flex items-center gap-2 text-13" style={{ color: 'var(--pm-stop)' }}>
                <AlertTriangle size={14} />
                Selected provider accepts max {selectedCap!.max_input_items} items — remove {files.length - selectedCap!.max_input_items} file{files.length - selectedCap!.max_input_items > 1 ? 's' : ''}.
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">

          {/* Step 3: Provider selection */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-11 font-mono font-semibold"
                style={{ background: 'var(--pm-run)', color: '#fff' }}
              >3</div>
              <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>
                Provider selection
                <span className="ml-1.5 text-12 font-normal" style={{ color: 'var(--pm-muted)' }}>
                  {selectedType ? '(auto-match or pin one)' : '— pick a type first'}
                </span>
              </h2>
            </div>

            {!selectedType ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: 'var(--pm-surface)', border: '1px dashed var(--pm-line)' }}
              >
                <p className="text-13" style={{ color: 'var(--pm-faint)' }}>Select a capability type to see available providers</p>
              </div>
            ) : matchingCaps.length === 0 ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
              >
                <p className="text-13" style={{ color: 'var(--pm-stop)' }}>No providers online for this capability</p>
                <p className="text-12 mt-1" style={{ color: 'var(--pm-muted)' }}>Try a different type or wait for a provider to come online</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Auto-match option */}
                <button
                  onClick={() => setSelectedCapId(null)}
                  className="w-full rounded-xl p-3.5 text-left transition-all"
                  style={{
                    background: selectedCapId === null ? 'color-mix(in srgb, var(--pm-run) 6%, var(--pm-surface))' : 'var(--pm-surface)',
                    border: `1.5px solid ${selectedCapId === null ? 'var(--pm-run)' : 'var(--pm-line)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full pulse-dot" style={{ background: 'var(--pm-run)', flexShrink: 0 }} />
                    <span className="text-13 font-semibold" style={{ color: selectedCapId === null ? 'var(--pm-run)' : 'var(--pm-text)' }}>
                      Auto-match best provider
                    </span>
                    <span
                      className="ml-auto text-11 font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'color-mix(in srgb, var(--pm-run) 10%, transparent)', color: 'var(--pm-run)' }}
                    >recommended</span>
                  </div>
                  <p className="text-12 mt-1 ml-4" style={{ color: 'var(--pm-muted)' }}>
                    System scores all {matchingCaps.length} provider{matchingCaps.length !== 1 ? 's' : ''} and picks the fastest available
                  </p>
                </button>

                {/* Individual providers */}
                {matchingCaps.map(cap => {
                  const dev = devicesMap[cap.device_id];
                  const active = selectedCapId === cap.id;
                  return (
                    <button
                      key={cap.id}
                      onClick={() => setSelectedCapId(active ? null : cap.id)}
                      className="w-full rounded-xl p-3.5 text-left transition-all"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--pm-gold) 5%, var(--pm-surface))' : 'var(--pm-surface)',
                        border: `1.5px solid ${active ? 'var(--pm-gold)' : 'var(--pm-line)'}`,
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: 'var(--pm-ok)' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-13 font-medium" style={{ color: 'var(--pm-text)' }}>{cap.label}</span>
                          </div>
                          <div className="text-11 font-mono mt-0.5" style={{ color: 'var(--pm-muted)' }}>
                            {dev?.name ?? cap.device_id}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                            <span>{cap.max_cpu_cores} cores</span>
                            <span>·</span>
                            <span>{fmtMem(cap.max_memory_mb)}</span>
                            <span>·</span>
                            <span>max {fmtTime(cap.max_runtime_sec)}</span>
                            <span>·</span>
                            <span>{cap.max_input_items} items</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                            {cap.jobs_used_this_hour}/{cap.jobs_per_hour}/hr
                          </div>
                          {dev && (
                            <div className="text-11 font-mono" style={{ color: 'var(--pm-faint)' }}>
                              {(dev.reliability * 100).toFixed(0)}% reliable
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 4: Dispatch */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-11 font-mono font-semibold"
                style={{ background: 'var(--pm-run)', color: '#fff' }}
              >4</div>
              <h2 className="text-14 font-semibold" style={{ color: 'var(--pm-text)' }}>Dispatch</h2>
            </div>

            {/* Job summary card */}
            <div
              className="rounded-xl p-4 mb-3 space-y-1.5 text-13 font-mono"
              style={{ background: 'var(--pm-surface)', border: '1px solid var(--pm-line)' }}
            >
              {[
                ['Type',     selectedType ? CAP_TYPES.find(t => t.type === selectedType)?.label ?? selectedType : '—'],
                ['Files',    files.length > 0 ? `${files.length} file${files.length !== 1 ? 's' : ''}` : '—'],
                ['Provider', selectedCapId ? (capsMap[selectedCapId]?.label ?? selectedCapId) : `auto (${matchingCaps.length} available)`],
                ['As',       viewingAs],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-4">
                  <span className="w-16 flex-shrink-0" style={{ color: 'var(--pm-faint)' }}>{k}</span>
                  <span style={{ color: 'var(--pm-text)' }}>{v}</span>
                </div>
              ))}
            </div>

            {error && (
              <div className="mb-3 flex items-center gap-2 text-13 font-mono" style={{ color: 'var(--pm-stop)' }}>
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3 rounded-xl text-14 font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: canSubmit ? 'var(--pm-run)' : 'var(--pm-raised)',
                color: canSubmit ? '#fff' : 'var(--pm-faint)',
                border: canSubmit ? 'none' : '1px solid var(--pm-line)',
              }}
              onMouseEnter={e => { if (canSubmit) (e.currentTarget as HTMLElement).style.background = '#1D4ED8'; }}
              onMouseLeave={e => { if (canSubmit) (e.currentTarget as HTMLElement).style.background = 'var(--pm-run)'; }}
            >
              {submitting ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: '#fff', borderTopColor: 'transparent' }}
                  />
                  Dispatching…
                </>
              ) : (
                <>
                  <Send size={15} />
                  Dispatch Job
                </>
              )}
            </button>

            {!canSubmit && !submitting && (
              <p className="text-12 text-center mt-2" style={{ color: 'var(--pm-faint)' }}>
                {!selectedType ? 'Pick a capability type' : files.length === 0 ? 'Upload at least one file' : matchingCaps.length === 0 ? 'No providers available for this type' : tooManyFiles ? 'Too many files for selected provider' : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
