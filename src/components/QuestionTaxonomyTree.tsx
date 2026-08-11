import { useEffect, useMemo, useState } from 'react';
import type { TaxonomyGroup, TaxonomyProblemLink } from '../services/questionTaxonomy';
import './QuestionTaxonomyTree.css';

interface Props {
  groups: TaxonomyGroup[];
  initialNodeId: string | null;
  locale: 'tr' | 'en';
  onProblemSelect?: (problem: TaxonomyProblemLink) => void;
}

const PAGE_SIZE = 40;

export default function QuestionTaxonomyTree({ groups, initialNodeId, locale, onProblemSelect }: Props) {
  const [selectedId, setSelectedId] = useState(initialNodeId);
  const [page, setPage] = useState(0);
  const selected = useMemo(() => groups.flatMap((group) => group.nodes).find((node) => node.id === selectedId), [groups, selectedId]);
  const selectedGroupId = groups.find((group) => group.nodes.some((node) => node.id === selectedId))?.id;
  const pageCount = selected ? Math.max(1, Math.ceil(selected.problems.length / PAGE_SIZE)) : 1;
  const visibleProblems = selected?.problems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) ?? [];
  useEffect(() => setPage(0), [selectedId]);
  return <section className="taxonomy-tree" aria-label={locale === 'tr' ? 'Soru ağacı' : 'Problem tree'}>
    <header><strong>{locale === 'tr' ? 'Soru Ağacı' : 'Problem Tree'}</strong><span>{groups.reduce((sum, group) => sum + group.nodes.length, 0)} {locale === 'tr' ? 'dal' : 'branches'}</span></header>
    <div className="taxonomy-groups">
      {groups.map((group) => <details key={group.id} className={group.id === selectedGroupId ? 'active' : ''} open={group.id === selectedGroupId}>
        <summary>{group.label}</summary>
        <div className="taxonomy-nodes">
          {group.nodes.map((node) => <button key={node.id} type="button" className={node.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(node.id)}>
            <span>{node.label}</span><b>{node.count}</b>
          </button>)}
        </div>
      </details>)}
    </div>
    {selected && <div className="taxonomy-selection">
      <h4>{selected.label} <span>{selected.count}</span></h4>
      <div className="taxonomy-problems">
        {visibleProblems.map((problem) => <button
          type="button"
          key={`${problem.source}:${problem.id}`}
          className={`difficulty-${problem.difficulty.toLowerCase()}`}
          title={`${problem.title} · ${problem.difficulty} · ${problem.source} ${problem.id}`}
          onClick={() => onProblemSelect?.(problem)}
        ><span>{problem.title}</span><i aria-label={problem.difficulty} /></button>)}
      </div>
      {pageCount > 1 && <nav className="taxonomy-pagination" aria-label={locale === 'tr' ? 'Soru sayfaları' : 'Problem pages'}>
        <button type="button" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>{locale === 'tr' ? 'Önceki' : 'Previous'}</button>
        <span>{page + 1} / {pageCount}</span>
        <button type="button" disabled={page + 1 === pageCount} onClick={() => setPage((value) => value + 1)}>{locale === 'tr' ? 'Sonraki' : 'Next'}</button>
      </nav>}
    </div>}
  </section>;
}
