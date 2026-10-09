import { useState } from 'react';
import { Check, Download, FileCheck2, Package, AlertCircle } from 'lucide-react';
import { downloadBlob, downloadOutputs, errorMessage, formatBytes } from '../lib/files';
import type { OutputFile } from '../types';

export default function Results({ outputs }: { outputs: OutputFile[] }) {
  const [packing, setPacking] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="results" aria-label="Results" aria-live="polite">
      <div className="results-heading">
        <div>
          <Check size={17} />
          <h2>{outputs.length === 1 ? 'Your file is ready' : `${outputs.length} files ready`}</h2>
        </div>
        {outputs.length > 1 && (
          <button
            className="secondary small"
            disabled={packing}
            onClick={async () => {
              setPacking(true);
              setError('');
              try {
                await downloadOutputs(outputs);
              } catch (e) {
                setError(errorMessage(e));
              } finally {
                setPacking(false);
              }
            }}
          >
            <Package size={15} />
            {packing ? 'Packing...' : 'Download all'}
          </button>
        )}
      </div>
      {error && (
        <p className="error">
          <AlertCircle size={16} />
          {error}
        </p>
      )}
      {outputs.map((output, index) => (
        <div className="result-row" key={`${output.name}-${index}`}>
          <FileCheck2 size={24} className="result-icon" />
          <div className="result-details">
            <strong>{output.name}</strong>
            <span>
              {formatBytes(output.blob.size)}
              {output.width ? ` / ${output.width} x ${output.height} px` : ''}
              {output.sourceBytes
                ? ` / ${Math.max(0, Math.round((1 - output.blob.size / output.sourceBytes) * 100))}% smaller`
                : ''}
            </span>
            {output.note && <small>{output.note}</small>}
          </div>
          <button
            className="icon-button"
            title={`Download ${output.name}`}
            aria-label={`Download ${output.name}`}
            onClick={() => downloadBlob(output.blob, output.name)}
          >
            <Download size={19} />
          </button>
        </div>
      ))}
    </section>
  );
}
