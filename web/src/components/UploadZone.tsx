import { useCallback, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  files: File[];
  onChange: (files: File[]) => void;
  accept?: string;
}

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function UploadZone({ files, onChange, accept = 'image/*' }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const valid = Array.from(incoming).filter(f => ACCEPTED.includes(f.type));
    onChange([...files, ...valid]);
  }, [files, onChange]);

  function remove(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={clsx(
          'relative flex flex-col items-center justify-center gap-2 rounded-card cursor-pointer transition-all',
          'text-15 select-none',
        )}
        style={{
          height: 120,
          border: `2px dashed ${dragging ? 'var(--pm-gold)' : 'var(--pm-line)'}`,
          background: dragging ? 'color-mix(in srgb, var(--pm-gold) 5%, transparent)' : 'var(--pm-raised)',
          color: 'var(--pm-muted)',
        }}
      >
        <Upload size={20} style={{ color: dragging ? 'var(--pm-gold)' : 'var(--pm-faint)' }} />
        <span>Drop images or click to browse</span>
        <span className="text-13" style={{ color: 'var(--pm-faint)' }}>JPEG, PNG, WebP, GIF</span>
        <input ref={inputRef} type="file" multiple accept={accept} className="sr-only"
          onChange={e => addFiles(e.target.files)} />
      </div>

      {files.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-13" style={{ color: 'var(--pm-muted)' }}>
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <span className="font-mono text-12" style={{ color: 'var(--pm-faint)' }}>{totalMb} MB</span>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
            {files.map((f, i) => {
              const url = URL.createObjectURL(f);
              return (
                <div key={i} className="relative group rounded-input overflow-hidden" style={{ aspectRatio: '1', background: 'var(--pm-raised)' }}>
                  <img src={url} alt={f.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(url)} />
                  <button
                    onClick={e => { e.stopPropagation(); remove(i); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'var(--pm-stop)', color: '#fff' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
