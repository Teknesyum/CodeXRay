import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TopologicalOutput from './TopologicalOutput';

afterEach(cleanup);

describe('TopologicalOutput', () => {
  it('renders the current wave and a bounded linear ordering track', () => {
    const { container } = render(<TopologicalOutput locale="tr" nodeCount={4} vars={{ wave: 2, order: ['plan', 'design'] }} />);
    expect(screen.getByRole('status', { name: 'Topolojik sıralama çıktısı' })).toHaveTextContent('DALGA 2');
    expect(screen.getByText('plan')).toBeVisible();
    expect(screen.getByText('design')).toHaveClass('newest');
    expect(container.querySelectorAll('.topological-output-track > *')).toHaveLength(4);
  });
});
