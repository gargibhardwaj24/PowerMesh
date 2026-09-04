interface Prediction { label: string; confidence: number }

interface Props {
  filename: string;
  thumbnailUrl: string;
  predictions: Prediction[];
  inferenceMs: number;
}

export default function ResultCard({ filename, thumbnailUrl, predictions, inferenceMs }: Props) {
  return (
    <div
      className="rounded-card overflow-hidden"
      style={{ border: '1px solid #e8dcc8', background: '#fff' }}
    >
      <div style={{ aspectRatio: '4/3', background: '#f5ede0', overflow: 'hidden' }}>
        <img src={thumbnailUrl} alt={filename} className="w-full h-full object-cover" />
      </div>
      <div className="p-3">
        <div className="font-mono text-12 mb-2 truncate" style={{ color: '#7a6a50' }}>{filename}</div>
        <div className="space-y-1.5">
          {predictions.slice(0, 3).map((p, i) => (
            <div key={i}>
              <div className="flex justify-between text-11 mb-0.5">
                <span style={{ color: '#3d3020' }}>{p.label}</span>
                <span className="font-mono" style={{ color: '#7a6a50' }}>{(p.confidence * 100).toFixed(0)}%</span>
              </div>
              <div style={{ height: 4, background: '#e8dcc8', borderRadius: 2, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${p.confidence * 100}%`,
                    background: i === 0 ? '#8B6914' : '#b08a3c',
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="font-mono text-11 mt-2" style={{ color: '#b08a3c' }}>{inferenceMs}ms</div>
      </div>
    </div>
  );
}
