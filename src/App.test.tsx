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
    expect(screen.getByText('Bilgiç Dede')).toBeInTheDocument();
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

  it('restores and clears local assistant conversation memory', async () => {
    localStorage.setItem('codexray.ai-chat.v1', JSON.stringify([
      { role: 'user', content: 'Where are we in the trace?' },
      { role: 'ai', content: 'The simulation is paused at the current step.' },
    ]));
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByText('Where are we in the trace?')).toBeInTheDocument();
    expect(screen.getByText('The simulation is paused at the current step.')).toBeInTheDocument();
    const dfs = algorithmRegistry.find((algorithm) => algorithm.name.includes('Depth First'));
    await user.selectOptions(screen.getByLabelText('Algorithm preset'), dfs?.code ?? '');
    expect(screen.getByText('Where are we in the trace?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear conversation memory' }));
    expect(screen.queryByText('Where are we in the trace?')).not.toBeInTheDocument();
    expect(localStorage.getItem('codexray.ai-chat.v1')).toBe('[]');
  });

  it('offers ultra local models and explains automatic browser-managed storage', async () => {
    localStorage.setItem(
      'codexray.ai-model.v1',
      'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    );
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const modelSelect = screen.getByRole('combobox', { name: 'On-device model' });
    expect(modelSelect).toHaveValue('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
    expect(screen.getByRole('option', { name: /Qwen2.5 Coder 7B/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Qwen3.5 9B.*16 GB class/ }))
      .toBeInTheDocument();
    expect(screen.getByText(/browser-managed OPFS\/cache/)).toBeInTheDocument();
    expect(screen.getByText(/initializes automatically/)).toBeInTheDocument();

    await user.selectOptions(modelSelect, 'Qwen3.5-9B-q4f32_1-MLC');
    const contextSelect = screen.getByRole('combobox', { name: 'Context window' });
    expect(contextSelect).toHaveValue('4096');
    expect(within(contextSelect).getByRole('option', { name: /8K context.*experimental/ }))
      .toBeInTheDocument();
  });

  it('opens the requested YouTube Music playlist in a compact radio player', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open CodeXRay Radio' }));
    const player = screen.getByTitle('CodeXRay YouTube playlist player');
    expect(player.getAttribute('src'))
      .toContain('list=OLAK5uy_kojiLJf49fStilkx_cFUhxqoDXzcSyfg0');
    expect(screen.getByRole('link', { name: 'Open playlist in YouTube Music' }).getAttribute('href'))
      .toContain('music.youtube.com/playlist');
    await user.click(screen.getByRole('button', { name: 'Close CodeXRay Radio' }));
    expect(screen.queryByTitle('CodeXRay YouTube playlist player')).not.toBeInTheDocument();
  });
});
