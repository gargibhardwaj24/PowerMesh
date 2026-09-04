import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';
import type { LogLine } from '../api/types';

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  info:  'var(--pm-run)',
  warn:  'var(--pm-warn)',
  error: 'var(--pm-stop)',
  debug: 'var(--pm-faint)',
};

interface Props {
  lines: LogLine[];
  className?: string;
}

export default function LogConsole({ lines, className }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  useEffect(() => {
    if (!userScrolled && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, userScrolled]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    setUserScrolled(!atBottom);
  }

  function jumpToLatest() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUserScrolled(false);
    }
  }

  return (
    <div className={clsx('relative', className)}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="overflow-y-auto font-mono text-12 leading-relaxed p-3"
        style={{
          height: 224,
          background: 'var(--pm-void)',
          borderRadius: 6,
          border: '1px solid var(--pm-line)',
        }}
      >
        {lines.length === 0 ? (
          <span style={{ color: 'var(--pm-faint)' }}>Waiting for logs…</span>
        ) : (
          lines.map((l, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span style={{ color: LEVEL_COLOR[l.level], minWidth: 32, flexShrink: 0 }}>
                {l.level.toUpperCase().slice(0, 3)}
              </span>
              <span style={{ color: 'var(--pm-text)' }}>{l.line}</span>
            </div>
          ))
        )}
      </div>
      {userScrolled && (
        <button
          onClick={jumpToLatest}
          className="absolute bottom-3 right-3 flex items-center gap-1 text-11 px-2 py-1 rounded-pill"
          style={{ background: 'var(--pm-raised)', color: 'var(--pm-run)', border: '1px solid var(--pm-run)' }}
        >
          <ArrowDown size={10} />
          jump to latest
        </button>
      )}
    </div>
  );
}
