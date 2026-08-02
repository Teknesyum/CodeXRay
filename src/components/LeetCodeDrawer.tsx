import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BookOpen, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ExternalLink,
  Filter, Play, RefreshCw, Search, X,
} from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { clearCatalogCache, loadCatalog, type AlgorithmProblem } from '../services/algorithmCatalog';
import {
  clearCatalogProblemDetailsCache,
  getCatalogProblemUrl,
  loadCatalogProblemDetails,
  type CatalogProblemDetails,
} from '../services/catalogProblemDetails';
import { checkProblemSupport, type ExactSupportContract } from '../services/catalogSupportRegistry';
import { ProblemRichText } from './ProblemRichText';
import './LeetCodeDrawer.css';

const ITEMS_PER_PAGE = 50;

const focusableElements = (element: HTMLElement): HTMLElement[] => Array.from(
  element.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ),
);

const labels = (locale: 'en' | 'tr') => locale === 'tr' ? {
  title: 'Örnekler', subtitle: 'Algoritma problemlerini incele, filtrele ve doğrulanmış olanları God Mode ile simüle et.',
  close: 'Örnekleri kapat', platform: 'Platform', search: 'Başlık, ID veya etiket ara…',
  difficulty: 'Zorluk', category: 'Problem tipi', all: 'Tümü', easy: 'Kolay', medium: 'Orta', hard: 'Zor',
  loading: 'Örnekler yükleniyor…', error: 'Katalog yüklenemedi.', retry: 'Tekrar dene',
  empty: 'Bu filtrelerle eşleşen problem bulunamadı.', select: 'Ayrıntılarını görmek için bir problem seç.',
  verified: 'Simülasyonu doğrulandı', simulate: 'God Mode ile Simüle Et', unavailable: 'Exact simülasyon henüz doğrulanmadı; God Mode problem kaynağını okuyarak deneyecek.',
  tags: 'Etiketler', types: 'Problem tipleri', details: 'Problem ayrıntıları', open: 'Problem sayfasını aç', results: 'problem',
  statement: 'Problem açıklaması', inputFormat: 'Girdi biçimi', outputFormat: 'Çıktı biçimi', constraints: 'Kısıtlar', examples: 'Örnekler', notes: 'İpuçları ve notlar', signature: 'Fonksiyon imzası',
  loadingDetails: 'Problem ayrıntıları güvenli kaynaktan yükleniyor…', detailError: 'Problem ayrıntıları şu anda alınamadı.', retryDetails: 'Ayrıntıları yeniden dene', sourceWarning: 'İçerik kaynak sayfadan temizlenip doğrulanarak yüklenir.',
} : {
  title: 'Examples', subtitle: 'Explore and filter algorithm problems, then simulate verified entries with God Mode.',
  close: 'Close examples', platform: 'Platform', search: 'Search title, ID, or tag…',
  difficulty: 'Difficulty', category: 'Problem type', all: 'All', easy: 'Easy', medium: 'Medium', hard: 'Hard',
  loading: 'Loading examples…', error: 'The catalog could not be loaded.', retry: 'Try again',
  empty: 'No problems match these filters.', select: 'Select a problem to inspect its details.',
  verified: 'Simulation verified', simulate: 'Simulate with God Mode', unavailable: 'No exact simulation is verified yet; God Mode will attempt it from the problem source.',
  tags: 'Tags', types: 'Problem types', details: 'Problem details', open: 'Open problem page', results: 'problems',
  statement: 'Problem statement', inputFormat: 'Input format', outputFormat: 'Output format', constraints: 'Constraints', examples: 'Examples', notes: 'Hints and notes', signature: 'Function signature',
  loadingDetails: 'Loading problem details from the validated source…', detailError: 'Problem details are currently unavailable.', retryDetails: 'Retry details', sourceWarning: 'Content is cleaned and validated from the source page.',
};

const CollapsibleProblemSection = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => <details className="examples-collapsible is-wide">
  <summary><h4>{title}</h4><ChevronDown size={17} aria-hidden="true" /></summary>
  <div className="examples-collapsible-content">{children}</div>
</details>;

export const LeetCodeDrawer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { locale } = useTimeline();
  const copy = labels(locale);
  const [source, setSource] = useState('leetcode');
  const [problems, setProblems] = useState<AlgorithmProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [supportMap, setSupportMap] = useState<Record<string, ExactSupportContract>>({});
  const [problemDetails, setProblemDetails] = useState<CatalogProblemDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const fetchCatalog = useCallback((refresh = false) => {
    if (refresh) clearCatalogCache(source);
    setLoading(true);
    setError(null);
    loadCatalog({ source })
      .then((data) => {
        setProblems(data);
        setPage(1);
        setSelectedId(null);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : copy.error))
      .finally(() => setLoading(false));
  }, [copy.error, source]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    fetchCatalog();
    return () => previousFocusRef.current?.focus();
  }, [fetchCatalog, isOpen]);

  useEffect(() => {
    if (!isOpen || !drawerRef.current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return onClose();
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const elements = focusableElements(drawerRef.current);
      if (!elements.length) return;
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    focusableElements(drawerRef.current)[0]?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const categories = useMemo(() => Array.from(new Set(problems.flatMap((problem) => (
    problem.derivedCategories?.length ? problem.derivedCategories : [problem.category]
  )))).sort((a, b) => a.localeCompare(b)), [problems]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US');
    return problems.filter((problem) => {
      const types = problem.derivedCategories?.length ? problem.derivedCategories : [problem.category];
      const searchMatch = !normalized || [problem.id, problem.title, problem.slug, ...problem.tags, ...types]
        .some((value) => value.toLocaleLowerCase(locale === 'tr' ? 'tr-TR' : 'en-US').includes(normalized));
      return searchMatch
        && (difficulty === 'all' || problem.difficulty === difficulty)
        && (category === 'all' || types.includes(category));
    });
  }, [category, difficulty, locale, problems, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const visibleProblems = useMemo(() => filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE), [filtered, page]);
  const selected = problems.find((problem) => problem.id === selectedId) ?? null;

  const fetchSelectedDetails = useCallback((problem: AlgorithmProblem, refresh = false) => {
    if (refresh) clearCatalogProblemDetailsCache(problem);
    const controller = new AbortController();
    setDetailsLoading(true);
    setDetailsError(null);
    setProblemDetails(null);
    loadCatalogProblemDetails(problem, { refresh, signal: controller.signal })
      .then((details) => setProblemDetails(details))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setDetailsError(reason instanceof Error ? reason.message : copy.detailError);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });
    return () => controller.abort();
  }, [copy.detailError]);

  useEffect(() => {
    if (!isOpen || !selected) {
      setProblemDetails(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }
    return fetchSelectedDetails(selected);
  }, [fetchSelectedDetails, isOpen, selected]);

  useEffect(() => {
    if (!isOpen || visibleProblems.length === 0) return;
    let active = true;
    Promise.all(visibleProblems.map((problem) => checkProblemSupport(source, problem.id, locale)))
      .then((results) => {
        if (!active) return;
        setSupportMap((current) => {
          const next = { ...current };
          visibleProblems.forEach((problem, index) => { next[`${source}:${problem.id}`] = results[index]; });
          return next;
        });
      });
    return () => { active = false; };
  }, [isOpen, locale, source, visibleProblems]);

  if (!isOpen) return null;
  const selectedSupport = selected ? supportMap[`${source}:${selected.id}`] : undefined;
  const canSimulate = selectedSupport?.type === 'exact-simulation';
  const selectedProblemUrl = selected ? getCatalogProblemUrl(selected) : null;
  const canAttemptSimulation = Boolean(selected && (canSimulate || selectedProblemUrl));

  const simulateSelected = () => {
    if (!selected || !canAttemptSimulation) return;
    const text = canSimulate
      ? `Create catalog problem: ${source}/${selected.id}`
      : `Solve and simulate this catalog problem: ${selectedProblemUrl}`;
    window.dispatchEvent(new CustomEvent('god-mode-user-message', {
      detail: { text },
    }));
    onClose();
  };

  return <>
    <div className="examples-overlay" onClick={onClose} aria-hidden="true" />
    <div className="examples-drawer" role="dialog" aria-modal="true" aria-labelledby="examples-title" ref={drawerRef}>
      <header className="examples-header">
        <div className="examples-heading">
          <span className="examples-heading-icon"><BookOpen size={20} /></span>
          <div><h2 id="examples-title">{copy.title}</h2><p>{copy.subtitle}</p></div>
        </div>
        <button className="examples-icon-btn" type="button" onClick={onClose} aria-label={copy.close}><X size={19} /></button>
      </header>

      <section className="examples-filters" aria-label={copy.category}>
        <label><span>{copy.platform}</span><select value={source} onChange={(event) => { setSource(event.target.value); setPage(1); }}>
          <option value="leetcode">LeetCode</option><option value="cses">CSES</option><option value="codeforces">Codeforces</option><option value="atcoder">AtCoder</option>
        </select></label>
        <label className="examples-search"><span className="sr-only">{copy.search}</span><Search size={16} /><input value={query} placeholder={copy.search} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
        <label><span>{copy.difficulty}</span><select value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}>
          <option value="all">{copy.all}</option><option value="Easy">{copy.easy}</option><option value="Medium">{copy.medium}</option><option value="Hard">{copy.hard}</option>
        </select></label>
        <label><span>{copy.category}</span><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }}>
          <option value="all">{copy.all}</option>{categories.map((value) => <option key={value} value={value}>{value}</option>)}
        </select></label>
      </section>

      <main className="examples-content">
        <section className="examples-list-pane">
          <div className="examples-list-meta"><span><Filter size={14} /> {filtered.length} {copy.results}</span><button type="button" onClick={() => fetchCatalog(true)} aria-label={copy.retry}><RefreshCw size={14} /></button></div>
          {loading ? <div className="examples-state"><span className="examples-spinner" />{copy.loading}</div>
            : error ? <div className="examples-state examples-error"><p>{copy.error}</p><button type="button" onClick={() => fetchCatalog(true)}>{copy.retry}</button></div>
              : visibleProblems.length === 0 ? <div className="examples-state">{copy.empty}</div>
                : <ul className="examples-problem-list">{visibleProblems.map((problem) => {
                  const verified = supportMap[`${source}:${problem.id}`]?.type === 'exact-simulation';
                  return <li key={`${source}:${problem.id}`}>
                    <button type="button" className={`examples-problem-row${selectedId === problem.id ? ' is-selected' : ''}`} onClick={() => setSelectedId(problem.id)} aria-pressed={selectedId === problem.id}>
                      <span className="examples-problem-id">#{problem.id}</span>
                      <span className="examples-problem-name">{problem.title}</span>
                      <span className={`examples-difficulty is-${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span>
                      {verified && <CheckCircle2 className="examples-verified-icon" size={17} aria-label={copy.verified} />}
                    </button>
                  </li>;
                })}</ul>}
          <nav className="examples-pagination" aria-label="Pagination">
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Previous Page"><ChevronLeft size={17} /></button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} aria-label="Next Page"><ChevronRight size={17} /></button>
          </nav>
        </section>

        <aside className="examples-detail-pane" aria-live="polite">
          {!selected ? <div className="examples-empty-detail"><BookOpen size={34} /><p>{copy.select}</p></div> : <>
            <div className="examples-detail-title"><div><span>{source.toUpperCase()} · #{selected.id}</span><h3>{selected.title}</h3></div>{canSimulate && <CheckCircle2 size={22} aria-label={copy.verified} />}</div>
            <div className="examples-detail-grid">
              <div><span>{copy.difficulty}</span><strong className={`examples-difficulty is-${selected.difficulty.toLowerCase()}`}>{selected.difficulty}</strong></div>
              <div><span>{copy.category}</span><strong>{selected.category}</strong></div>
            </div>
            <div className="examples-detail-section"><h4>{copy.types}</h4><div className="examples-chips">{(selected.derivedCategories?.length ? selected.derivedCategories : [selected.category]).map((value) => <span key={value}>{value}</span>)}</div></div>
            <div className="examples-detail-section"><h4>{copy.tags}</h4><div className="examples-chips is-muted">{selected.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
            <div className="examples-source-note">{copy.sourceWarning}</div>
            {detailsLoading && <div className="examples-detail-loading"><span className="examples-spinner" />{copy.loadingDetails}</div>}
            {detailsError && <div className="examples-detail-error"><p>{copy.detailError}</p><small>{detailsError}</small><button type="button" onClick={() => fetchSelectedDetails(selected, true)}>{copy.retryDetails}</button></div>}
            {problemDetails && <div className="examples-problem-content">
              <section className="is-wide"><h4>{copy.statement}</h4><ProblemRichText text={problemDetails.problem.description} /></section>
              {problemDetails.problem.signature && <CollapsibleProblemSection key={`${selected.id}-signature`} title={copy.signature}><pre>{problemDetails.problem.signature}</pre></CollapsibleProblemSection>}
              {problemDetails.problem.inputFormat && <section><h4>{copy.inputFormat}</h4><ProblemRichText text={problemDetails.problem.inputFormat} /></section>}
              {problemDetails.problem.outputFormat && <section><h4>{copy.outputFormat}</h4><ProblemRichText text={problemDetails.problem.outputFormat} /></section>}
              {problemDetails.problem.examples.length > 0 && <CollapsibleProblemSection key={`${selected.id}-examples`} title={copy.examples}>{problemDetails.problem.examples.map((example, index) => <article className="examples-sample" key={`${example.input}:${index}`}><strong>#{index + 1}</strong><div><pre><b>Input</b>{'\n'}{example.input}{'\n\n'}<b>Output</b>{'\n'}{example.output}</pre>{example.explanation && <ProblemRichText className="examples-sample-explanation" text={example.explanation} />}</div></article>)}</CollapsibleProblemSection>}
              {problemDetails.problem.constraints.length > 0 && <section className="is-wide"><h4>{copy.constraints}</h4><ul>{problemDetails.problem.constraints.map((constraint, index) => <li key={`${constraint}:${index}`}><ProblemRichText text={constraint} /></li>)}</ul></section>}
              {problemDetails.problem.notes.length > 0 && <CollapsibleProblemSection key={`${selected.id}-notes`} title={copy.notes}>{problemDetails.problem.notes.map((note, index) => <ProblemRichText key={`${note}:${index}`} text={note} />)}</CollapsibleProblemSection>}
            </div>}
            {selectedProblemUrl && <a className="examples-external-link" href={selectedProblemUrl} target="_blank" rel="noreferrer">{copy.open}<ExternalLink size={14} /></a>}
            <div className={`examples-support-note${canSimulate ? ' is-verified' : ''}`}>{canSimulate ? <><CheckCircle2 size={16} />{copy.verified}</> : copy.unavailable}</div>
            <button className="examples-simulate-btn" type="button" onClick={simulateSelected} disabled={!canAttemptSimulation}><Play size={17} />{copy.simulate}</button>
          </>}
        </aside>
      </main>
    </div>
  </>;
};
