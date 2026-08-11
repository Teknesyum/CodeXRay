import type { TraceValue } from '../types/simulation';

interface Props {
  locale: 'tr' | 'en';
  nodeCount: number;
  vars: Record<string, TraceValue>;
}

export default function TopologicalOutput({ locale, nodeCount, vars }: Props) {
  const order = Array.isArray(vars.order)
    ? vars.order.filter((value): value is string => typeof value === 'string')
    : [];
  const wave = typeof vars.wave === 'number' ? vars.wave : 1;
  return <div className="topological-output" role="status" aria-label={locale === 'tr' ? 'Topolojik sıralama çıktısı' : 'Topological ordering output'}>
    <strong>{locale === 'tr' ? `DALGA ${wave}` : `WAVE ${wave}`}</strong>
    <div className="topological-output-track">
      {Array.from({ length: nodeCount }, (_, index) => order[index]
        ? <span key={`${index}:${order[index]}`} className={index === order.length - 1 ? 'newest' : ''}>{order[index]}</span>
        : <i key={index} aria-hidden="true" />)}
    </div>
  </div>;
}
