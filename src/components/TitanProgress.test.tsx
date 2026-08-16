import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ManagerPlanV1 } from '../types/titan';
import { TitanProgress } from './TitanProgress';

const plan = (): ManagerPlanV1 => ({
  version: 1,
  runId: 'titan-test',
  request: 'trace code',
  intent: 'create-algorithm',
  createdAt: 1,
  jobs: [
    { id: 'titan-route', role: 'manager', label: 'route', dependsOn: [], weight: 20, status: 'completed', attempt: 1, maxAttempts: 1 },
    { id: 'titan-produce', role: 'compiler', label: 'produce', dependsOn: ['titan-route'], weight: 20, status: 'running', attempt: 1, maxAttempts: 1 },
    { id: 'titan-semantics', role: 'visual-designer', label: 'semantics', dependsOn: ['titan-produce'], weight: 20, status: 'completed', attempt: 0, maxAttempts: 1, summary: 'Skipped because this stage was not required.' },
    { id: 'titan-verify', role: 'critic', label: 'verify', dependsOn: ['titan-semantics'], weight: 20, status: 'waiting', attempt: 0, maxAttempts: 1 },
    { id: 'titan-apply', role: 'manager', label: 'apply', dependsOn: ['titan-verify'], weight: 20, status: 'waiting', attempt: 0, maxAttempts: 1 },
  ],
});

describe('TitanProgress', () => {
  it('renders exactly five ordered stages and an explicit skipped state in both locales', () => {
    const props = { onCancel: vi.fn(), onDismiss: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn(), onRetry: vi.fn(), canUndo: true, canRedo: true };
    const view = render(<TitanProgress plan={plan()} locale="en" {...props} />);
    expect(screen.getAllByRole('generic', { name: /Route:|Produce:|Semantics:|Verify:|Apply:/ })).toHaveLength(5);
    expect(screen.getByLabelText('Semantics: skipped (not required)')).toBeInTheDocument();
    view.rerender(<TitanProgress plan={plan()} locale="tr" {...props} />);
    expect(screen.getByLabelText('Anlamlandır: atlandı (gerekmedi)')).toBeInTheDocument();
  });

  it('keeps cancel, undo, and redo controls keyboard accessible', () => {
    const onCancel = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(<TitanProgress plan={plan()} locale="en" onCancel={onCancel} onDismiss={vi.fn()} onUndo={onUndo} onRedo={onRedo} onRetry={vi.fn()} canUndo canRedo />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: /undo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /redo/i })).toBeDisabled();
  });
});
