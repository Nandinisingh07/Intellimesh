import type { SourceCitation } from '../lib/types';

interface Props {
  sources: SourceCitation[];
}

export default function SourcePanel({ sources }: Props) {
  if (!sources.length) return null;
  return (
    <div className="space-y-2">
      {sources.map((s, i) => (
        <div key={i} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <div className="text-xs font-medium text-purple-700">
            {s.metadata?.filename} — {s.score}%
          </div>
          <p className="text-xs text-gray-600 mt-1 line-clamp-4">{s.document}</p>
        </div>
      ))}
    </div>
  );
}
