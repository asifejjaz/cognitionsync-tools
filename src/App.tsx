import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowRight,
  Check,
  ChevronDown,
  FileImage,
  Files,
  FileText,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  LockKeyhole,
  Menu,
  PanelLeftClose,
  PenLine,
  Scissors,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  AlertCircle,
  Download,
  RotateCw,
  Crop,
  LoaderCircle,
} from 'lucide-react';
import { tools, getTool } from './catalog';
import type { Tool, ToolId, OutputFile } from './types';
import { errorMessage, formatBytes, validateFiles } from './lib/files';
import Dropzone from './components/Dropzone';
import Results from './components/Results';
import ImageTools from './components/ImageTools';
const PdfTools = lazy(() => import('./components/PdfTools'));
const SignPdf = lazy(() => import('./components/SignPdf'));
const ImagesToPdf = lazy(() => import('./components/ImagesToPdf'));
const DocumentTools = lazy(() => import('./components/DocumentTools'));

const icons = {
  'compress-image': ImageIcon,
  'resize-image': Crop,
  'heic-to-jpg': FileImage,
  'webp-converter': ArrowDownUp,
  'photo-signature': PenLine,
  'jpg-to-pdf': FileImage,
  'merge-pdf': Layers,
  'split-pdf': Scissors,
  'organize-pdf': RotateCw,
  'sign-pdf': PenLine,
  'docx-to-markdown': FileText,
  'markdown-to-pdf': FileText,
};
const sampleFileFor = (id: ToolId) =>
  id === 'heic-to-jpg'
    ? ['example.heic', 'image/heic']
    : id === 'docx-to-markdown'
      ? [
          'project-notes.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]
      : id === 'markdown-to-pdf'
        ? ['project-notes.md', 'text/markdown']
        : ['merge-pdf', 'split-pdf', 'organize-pdf', 'sign-pdf'].includes(id)
          ? ['project-notes.pdf', 'application/pdf']
          : ['woodland.jpg', 'image/jpeg'];

function Workspace({ tool }: { tool: Tool }) {
  const [files, setFiles] = useState<File[]>([]);
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sampling, setSampling] = useState(false);
  const busyRef = useRef(false);
  const onError = useCallback((message: string) => setError(message), []);
  function addFiles(incoming: File[]) {
    if (busyRef.current || !incoming.length) return;
    try {
      const combined = tool.multiple ? [...files, ...incoming] : incoming.slice(0, 1);
      validateFiles(combined, tool.accept);
      setFiles(combined);
      setOutputs([]);
      setError('');
    } catch (error) {
      setError(errorMessage(error));
    }
  }
  async function useSample() {
    setSampling(true);
    setError('');
    try {
      const [name, type] = sampleFileFor(tool.id);
      const response = await fetch(`/samples/${name}`);
      if (!response.ok)
        throw new Error('The sample file is unavailable. Please choose your own file.');
      addFiles([new File([await response.blob()], name, { type })]);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setSampling(false);
    }
  }
  const onRun = useCallback(async (job: () => Promise<OutputFile[]>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setOutputs([]);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      setOutputs(await job());
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);
  const isMarkdown = tool.id === 'markdown-to-pdf';
  const groupClass = tool.group.toLowerCase();
  const Icon = icons[tool.id];
  return (
    <div className="workspace">
      <div className="breadcrumb">
        <Link to="/all-tools">All tools</Link>
        <span>/</span>
        <span>{tool.group}</span>
      </div>
      <div className="workspace-title">
        <div className={`tool-title-icon ${groupClass}`}>
          <Icon size={23} />
        </div>
        <h1>{tool.title}</h1>
        <span className="local-badge">
          <LockKeyhole size={12} />
          On your device
        </span>
      </div>
      <div className="workspace-body">
        {error && (
          <div className="error" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
            <button
              className="icon-button"
              title="Dismiss error"
              aria-label="Dismiss error"
              onClick={() => setError('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!!files.length && (
          <div className="file-toolbar">
            <div className="file-count">
              <Files size={16} />
              <strong>
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </strong>
              <span>{formatBytes(files.reduce((n, file) => n + file.size, 0))}</span>
            </div>
            <div className="file-toolbar-actions">
              <Dropzone compact tool={tool} onFiles={addFiles} disabled={busy} />
              <button
                className="icon-button"
                title="Clear files"
                aria-label="Clear files"
                disabled={busy}
                onClick={() => {
                  setFiles([]);
                  setOutputs([]);
                  setError('');
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>
        )}
        {files.length > 1 && (
          <div className="file-list">
            {files.map((file, index) => (
              <div key={`${file.name}-${index}`}>
                <span title={file.name}>{file.name}</span>
                <small>{formatBytes(file.size)}</small>
                <button
                  className="icon-button"
                  title={`Remove ${file.name}`}
                  aria-label={`Remove file ${index + 1}`}
                  disabled={busy}
                  onClick={() => {
                    setFiles((current) => current.filter((_, i) => i !== index));
                    setOutputs([]);
                    setError('');
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {!files.length && !isMarkdown && (
          <>
            <Dropzone tool={tool} onFiles={addFiles} disabled={busy || sampling} />
            <div className="sample-row">
              <div className="sample-thumbnail">
                {tool.group === 'Images' || tool.id === 'jpg-to-pdf' ? (
                  <img src="/samples/woodland.jpg" alt="Woodland sample photograph" />
                ) : (
                  <FileText size={24} />
                )}
              </div>
              <div>
                <strong>Start with a sample</strong>
                <span>{sampleFileFor(tool.id)[0]}</span>
              </div>
              <button className="secondary small" disabled={sampling} onClick={useSample}>
                {sampling ? <LoaderCircle size={15} className="spin" /> : <ArrowRight size={15} />}
                Try sample
              </button>
            </div>
          </>
        )}
        {isMarkdown && !files.length && (
          <div className="file-toolbar">
            <div className="file-count">
              <FileText size={16} />
              <span>project-notes.md</span>
            </div>
            <Dropzone compact tool={tool} onFiles={addFiles} />
          </div>
        )}
        <Suspense
          fallback={
            <div className="loading" role="status">
              Opening workspace...
            </div>
          }
        >
          {!!files.length && tool.group === 'Images' && (
            <ImageTools tool={tool} files={files} busy={busy} onRun={onRun} onError={onError} />
          )}
          {!!files.length && tool.id === 'jpg-to-pdf' && (
            <ImagesToPdf files={files} busy={busy} onRun={onRun} onError={onError} />
          )}
          {!!files.length && ['merge-pdf', 'split-pdf', 'organize-pdf'].includes(tool.id) && (
            <PdfTools tool={tool} files={files} busy={busy} onRun={onRun} onError={onError} />
          )}
          {!!files.length && tool.id === 'sign-pdf' && (
            <SignPdf file={files[0]} busy={busy} onRun={onRun} onError={onError} />
          )}
          {(isMarkdown || (tool.id === 'docx-to-markdown' && files.length > 0)) && (
            <DocumentTools
              tool={tool}
              file={files[0]}
              busy={busy}
              onRun={onRun}
              onError={onError}
            />
          )}
        </Suspense>
        {busy && (
          <div className="processing" role="status">
            <LoaderCircle size={16} className="spin" />
            Processing {files.length || 1} {files.length === 1 || !files.length ? 'file' : 'files'}
            ...
          </div>
        )}
        {!!outputs.length && <Results outputs={outputs} />}
      </div>
      <div className="privacy-strip">
        <ShieldCheck size={18} />
        <span>Your files are processed on this device.</span>
        <Link to="/privacy">
          File privacy
          <ArrowRight size={13} />
        </Link>
      </div>
      <section className="related-tools">
        <div className="section-heading">
          <h2>Related tools</h2>
          <Link to="/all-tools">
            View all
            <ArrowRight size={14} />
          </Link>
        </div>
        <div className="related-grid">
          {tools
            .filter((other) => other.group === tool.group && other.id !== tool.id)
            .slice(0, 3)
            .map((other) => {
              const RelatedIcon = icons[other.id];
              return (
                <Link key={other.id} to={`/tools/${other.id}`}>
                  <div className={`related-icon ${groupClass}`}>
                    <RelatedIcon size={19} />
                  </div>
                  <span>{other.nav}</span>
                  <ArrowRight size={15} />
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}

function ToolRoute() {
  const { slug } = useParams();
  const tool = getTool(slug);
  return tool ? <Workspace key={tool.id} tool={tool} /> : <NotFound />;
}
function NotFound() {
  return (
    <div className="info-page">
      <h1>Tool not found</h1>
      <p>This address does not match an available tool.</p>
      <Link className="primary" to="/all-tools">
        <LayoutGrid size={16} />
        All tools
      </Link>
    </div>
  );
}
function AllTools() {
  return (
    <div className="workspace">
      <div className="breadcrumb">Filework / Tools</div>
      <h1>All tools</h1>
      {(['Images', 'PDFs', 'Documents'] as const).map((group) => (
        <section className="tool-category" key={group}>
          <h2>{group}</h2>
          <div className="all-tools-grid">
            {tools
              .filter((tool) => tool.group === group)
              .map((tool) => {
                const Icon = icons[tool.id];
                return (
                  <Link key={tool.id} to={`/tools/${tool.id}`}>
                    <div className={`tool-title-icon ${group.toLowerCase()}`}>
                      <Icon size={22} />
                    </div>
                    <h3>{tool.title}</h3>
                    <ArrowRight size={17} />
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}

function InfoPage({ type }: { type: 'privacy' | 'about' | 'roadmap' }) {
  return (
    <article className="info-page">
      <div className="breadcrumb">
        <Link to="/all-tools">Filework</Link>
        <span>/</span>
        <span>{type}</span>
      </div>
      <h1>
        {type === 'privacy'
          ? 'File privacy'
          : type === 'about'
            ? 'About Filework'
            : 'Release roadmap'}
      </h1>
      {type === 'privacy' ? (
        <>
          <p>
            Filework processes selected files in your browser. File contents, signatures, and
            conversion results are not uploaded to a conversion server.
          </p>
          <h2>What is stored</h2>
          <p>
            This release does not store your documents or conversion history. Files remain available
            in the current tab until you clear them or leave the tool. Downloaded files are saved to
            your device.
          </p>
          <h2>Network requests</h2>
          <p>
            The browser downloads application code, fonts, and optional sample files from the
            hosting server. This release includes no advertising or analytics scripts. Ordinary
            hosting logs can include request metadata such as IP addresses.
          </p>
          <h2>Device access</h2>
          <p>
            Clipboard access occurs only when you choose Copy Markdown. Drawn signatures remain in
            the current tab. Clear files to discard a workspace.
          </p>
        </>
      ) : type === 'about' ? (
        <>
          <p>
            Filework is an independent file utility project. This first release includes image, PDF,
            and document tools.
          </p>
          <h2>Release 0.1</h2>
          <p>
            Files are limited to 25 MB each, with batches up to 100 MB and 30 files. PDF documents
            are limited to 100 pages each and merge batches to 150 pages. Browser memory and format
            support may impose additional limits.
          </p>
          <h2>Conversion accuracy</h2>
          <p>
            Review every export before submitting it. Word conversion preserves document structure,
            but complex page layouts and tracked changes require review. PDF signatures in this
            release are visible annotations without certificate verification.
          </p>
        </>
      ) : (
        <>
          <p>
            First release: 12 tools. The project backlog contains 120 candidates across images,
            PDFs, documents, developer tools, calculators, education, media, local workflows, mobile
            apps, and games.
          </p>
          <div className="roadmap-list">
            {tools.map((tool, index) => (
              <div key={tool.id}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <Link to={`/tools/${tool.id}`}>{tool.title}</Link>
                <span className="roadmap-status">
                  <Check size={14} />
                  Available
                </span>
              </div>
            ))}
          </div>
          <h2>Next candidates</h2>
          <p>
            PDF compression, Word to PDF, OCR, static QR codes, data conversion, and specialist
            calculators are planned candidates. Their build order follows user demand and conversion
            quality.
          </p>
        </>
      )}
    </article>
  );
}

export default function App() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    const tool = getTool(location.pathname.split('/').filter(Boolean).pop());
    document.title = `${tool?.title || (location.pathname === '/all-tools' ? 'All tools' : 'Filework')} | Filework`;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        tool?.description || 'Image, PDF, and document tools from Filework.',
      );
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical)
      canonical.href = `${new URL(canonical.href).origin}${location.pathname.replace(/\/$/, '') || '/'}`;
    window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    if (searchOpen) search.current?.focus();
  }, [searchOpen]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const results = tools.filter((tool) =>
    `${tool.title} ${tool.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="app-shell">
      {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} />}
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <Link className="brand" to="/tools/compress-image">
          <div className="brand-symbol">
            <Files size={23} />
          </div>
          <span>
            filework<span className="brand-period">.</span>
          </span>
        </Link>
        <Link
          to="/all-tools"
          className={`all-tools-link ${location.pathname === '/all-tools' ? 'active' : ''}`}
        >
          <LayoutGrid size={17} />
          All tools<span className="tool-count">12</span>
        </Link>
        <nav aria-label="Tools">
          {(['Images', 'PDFs', 'Documents'] as const).map((group) => (
            <div className="nav-group" key={group}>
              <h2>{group}</h2>
              {tools
                .filter((tool) => tool.group === group)
                .map((tool) => {
                  const Icon = icons[tool.id];
                  return (
                    <Link
                      key={tool.id}
                      className={location.pathname === `/tools/${tool.id}` ? 'active' : ''}
                      to={`/tools/${tool.id}`}
                    >
                      <Icon size={17} />
                      <span>{tool.nav}</span>
                      {location.pathname === `/tools/${tool.id}` && <span className="active-dot" />}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <ShieldCheck size={17} />
            <span>Local file processing</span>
          </div>
          <Link to="/roadmap">
            Release 0.1
            <ArrowRight size={14} />
          </Link>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            title="Open navigation"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <PanelLeftClose size={20} /> : <Menu size={20} />}
          </button>
          <span className="topbar-label">Your file workspace</span>
          <button
            className="search-trigger"
            onClick={() => {
              setQuery('');
              setSearchOpen(true);
            }}
          >
            <Search size={16} />
            <span>Find a tool</span>
          </button>
          <span className="topbar-status">
            <span />
            All systems local
          </span>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Navigate to="/tools/compress-image" replace />} />
            <Route path="/tools/:slug" element={<ToolRoute />} />
            <Route path="/all-tools" element={<AllTools />} />
            <Route path="/privacy" element={<InfoPage type="privacy" />} />
            <Route path="/about" element={<InfoPage type="about" />} />
            <Route path="/roadmap" element={<InfoPage type="roadmap" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer>
          <span>Filework</span>
          <div>
            <Link to="/privacy">Privacy</Link>
            <Link to="/about">About</Link>
            <Link to="/roadmap">Roadmap</Link>
            <a href="/THIRD-PARTY-NOTICES.txt">Licenses</a>
          </div>
          <span>Made for the everyday.</span>
        </footer>
      </div>
      {searchOpen && (
        <div className="modal-backdrop" onClick={() => setSearchOpen(false)}>
          <section
            className="search-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Find a tool"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="search-input">
              <Search size={19} />
              <input
                ref={search}
                aria-label="Search tools"
                placeholder="Search tools..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                className="icon-button"
                title="Close search"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="search-results">
              {results.length ? (
                results.map((tool) => {
                  const Icon = icons[tool.id];
                  return (
                    <Link key={tool.id} to={`/tools/${tool.id}`}>
                      <Icon size={19} />
                      <span>
                        {tool.title}
                        <small>{tool.group}</small>
                      </span>
                      <ArrowRight size={16} />
                    </Link>
                  );
                })
              ) : (
                <p>No tools match that search.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
