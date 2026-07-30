import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { algorithmRegistry } from './services/codeRegistry';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('application workspace', () => {
  it('switches the complete shell to Turkish immediately', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Türkçeye geç' }));
    expect(screen.getByRole('heading', { name: 'Kaynak Kod' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simüle Et/ })).toBeInTheDocument();
    expect(screen.getByText('Değişkenler ve İz')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('tr');
  });

  it('renders the graph editor in the large right panel, not the code panel', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const dfs = algorithmRegistry.find((algorithm) => algorithm.name.includes('Depth First'));
    await user.selectOptions(screen.getByLabelText('Algorithm preset'), dfs?.code ?? '');
    const rightPanel = container.querySelector('.panel-right');
    const leftPanel = container.querySelector('.panel-left');
    expect(rightPanel).not.toBeNull();
    expect(leftPanel).not.toBeNull();
    expect(within(rightPanel as HTMLElement).getByText('Input Builder')).toBeInTheDocument();
    expect(rightPanel?.querySelector('.graph-input-editor')).not.toBeNull();
    expect(leftPanel?.querySelector('.graph-input-editor')).toBeNull();
  });

  it('collapses and expands every panel through accessible controls', async () => {
    const user = userEvent.setup();
    render(<App />);
    const panelNames = [
      'Source Code',
      'Variables & Trace',
      'Simulation View',
      'Master Coder',
      'Controls',
    ];
    for (const panelName of panelNames) {
      await user.click(screen.getByRole('button', { name: `Collapse ${panelName}` }));
      expect(screen.getByRole('button', { name: `Expand ${panelName}` })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: `Expand ${panelName}` }));
    }
  });

  it('resizes a panel boundary from the keyboard', () => {
    const { container } = render(<App />);
    const splitter = screen.getByRole('separator', { name: 'Resize left and right panels' });
    fireEvent.keyDown(splitter, { key: 'ArrowRight' });
    expect(container.querySelector('.panel-left')).toHaveStyle({ width: '460px' });
  });
});
