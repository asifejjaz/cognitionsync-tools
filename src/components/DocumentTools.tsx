import { useEffect, useState } from 'react';
import { ArrowRight, Clipboard, Check, FileText, AlertCircle } from 'lucide-react';
import type { OutputFile, Tool } from '../types';
import { docxToMarkdown, markdownToPdf, safeMarkdownHtml, sampleMarkdown } from '../lib/documents';
import { basename, errorMessage } from '../lib/files';
import { Field, Segmented } from './Controls';

export default function DocumentTools({
  tool,
  file,
  busy,
  onRun,
  onError,
}: {
  tool: Tool;
  file?: File;
  busy: boolean;
  onRun: (job: () => Promise<OutputFile[]>) => void;
  onError: (message: string) => void;
}) {
  const [markdown, setMarkdown] = useState(tool.id === 'markdown-to-pdf' ? sampleMarkdown : '');
  const [preview, setPreview] = useState('');
  const [tab, setTab] = useState<'source' | 'preview'>('source');
  const [title, setTitle] = useState('project-notes');
  const [paper, setPaper] = useState<'A4' | 'LETTER'>('A4');
  const [fontSize, setFontSize] = useState(11);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (tool.id === 'markdown-to-pdf' && file) {
      if (file.size > 1024 * 1024) {
        onError('Markdown files must be smaller than 1 MB.');
        return;
      }
      file
        .text()
        .then((text) => {
          if (!cancelled) {
            setMarkdown(text);
            setTitle(basename(file.name));
          }
        })
        .catch((error) => {
          if (!cancelled) onError(errorMessage(error));
        });
    }
    if (tool.id === 'docx-to-markdown') {
      setMarkdown('');
      setPreview('');
      setWarnings([]);
    }
    return () => {
      cancelled = true;
    };
  }, [file, tool.id]);
  return (
    <div className="workbench document-workbench">
      <div className="preview-column">
        <div className="editor-toolbar">
          <div className="editor-tabs">
            <button className={tab === 'source' ? 'active' : ''} onClick={() => setTab('source')}>
              {tool.id === 'docx-to-markdown' ? 'Markdown' : 'Editor'}
            </button>
            <button className={tab === 'preview' ? 'active' : ''} onClick={() => setTab('preview')}>
              Preview
            </button>
          </div>
          <button
            className="icon-button"
            title="Copy Markdown"
            aria-label="Copy Markdown"
            disabled={!markdown}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(markdown);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              } catch {
                onError('Clipboard access is unavailable. Select and copy the text in the editor.');
              }
            }}
          >
            {copied ? <Check size={16} /> : <Clipboard size={16} />}
          </button>
        </div>
        {tab === 'source' ? (
          <textarea
            className="markdown-editor"
            aria-label="Markdown editor"
            readOnly={tool.id === 'docx-to-markdown' || busy}
            spellCheck="false"
            value={markdown}
            placeholder="Converted Markdown appears here."
            onChange={(event) => setMarkdown(event.target.value)}
          />
        ) : (
          <div
            className="markdown-preview"
            dangerouslySetInnerHTML={{
              __html: tool.id === 'docx-to-markdown' ? preview : safeMarkdownHtml(markdown),
            }}
          />
        )}
        <div className="editor-status">
          <FileText size={13} />
          <span>{markdown.length.toLocaleString()} characters</span>
          <span>UTF-8</span>
        </div>
      </div>
      <aside className="settings-panel">
        <div className="panel-heading">
          <span>Document settings</span>
        </div>
        <fieldset disabled={busy}>
          {tool.id === 'markdown-to-pdf' ? (
            <>
              <Field label="Output filename">
                <input value={title} onChange={(event) => setTitle(event.target.value)} />
              </Field>
              <Segmented
                label="Paper size"
                value={paper}
                options={[
                  { value: 'A4', label: 'A4' },
                  { value: 'LETTER', label: 'Letter' },
                ]}
                onChange={setPaper}
              />
              <Field label="Body text size">
                <div className="input-unit">
                  <input
                    aria-label="Body text size"
                    type="number"
                    min="8"
                    max="20"
                    value={fontSize}
                    onChange={(event) =>
                      setFontSize(Math.max(8, Math.min(20, Number(event.target.value))))
                    }
                  />
                  <span>pt</span>
                </div>
              </Field>
              <p className="settings-note">
                Image references export as captions. PDF text stays selectable.
              </p>
            </>
          ) : (
            <>
              <div className="document-summary">
                <span>
                  Format<strong>Markdown</strong>
                </span>
                <span>
                  Embedded images<strong>ZIP bundle</strong>
                </span>
              </div>
              <p className="settings-note">
                DOCX only. Legacy .doc files must be saved as .docx first.
              </p>
              {warnings.length > 0 && (
                <div className="conversion-warnings">
                  <span className="field-label">
                    <AlertCircle size={14} />
                    Review notes
                  </span>
                  {warnings.map((warning, index) => (
                    <p key={index}>{warning}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </fieldset>
        <button
          className="primary export-button"
          disabled={busy || (tool.id === 'docx-to-markdown' ? !file : !markdown.trim())}
          onClick={() =>
            onRun(async () => {
              if (tool.id === 'markdown-to-pdf')
                return [await markdownToPdf(markdown, title, paper, fontSize)];
              const result = await docxToMarkdown(file!);
              setMarkdown(result.markdown);
              setPreview(result.html);
              setWarnings(result.warnings);
              return result.outputs;
            })
          }
        >
          <ArrowRight size={17} />
          {busy ? 'Processing...' : tool.action}
        </button>
      </aside>
    </div>
  );
}
