import { useRef, useState } from 'react';
import { Upload, Plus } from 'lucide-react';
import type { Tool } from '../types';

export default function Dropzone({
  tool,
  onFiles,
  compact = false,
  disabled = false,
}: {
  tool: Tool;
  onFiles: (files: File[]) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className={`dropzone ${compact ? 'compact' : ''} ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        accept={tool.accept}
        multiple={tool.multiple}
        disabled={disabled}
        aria-label="Choose files"
        onChange={(event) => {
          onFiles(Array.from(event.target.files || []));
          event.target.value = '';
        }}
      />
      {compact ? (
        <button className="add-files" disabled={disabled} onClick={() => input.current?.click()}>
          <Plus size={16} />
          {tool.multiple ? 'Add files' : 'Replace file'}
        </button>
      ) : (
        <>
          <div className="upload-icon">
            <Upload size={25} strokeWidth={1.7} />
          </div>
          <h2>
            Drop your{' '}
            {tool.group === 'Images' || tool.id === 'jpg-to-pdf'
              ? 'images'
              : tool.id === 'docx-to-markdown'
                ? 'document'
                : tool.id === 'markdown-to-pdf'
                  ? 'Markdown file'
                  : 'PDFs'}{' '}
            here
          </h2>
          <p>
            {tool.accept.replace(/\./g, '').toUpperCase().split(',').join(' / ')}{' '}
            <span className="separator-dot" /> Up to 25 MB per file
          </p>
          <button className="primary" disabled={disabled} onClick={() => input.current?.click()}>
            <Plus size={17} />
            Choose {tool.multiple ? 'files' : 'file'}
          </button>
        </>
      )}
    </div>
  );
}
