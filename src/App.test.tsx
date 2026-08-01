import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { algorithmRegistry } from './services/codeRegistry';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
});
afterEach(() => cleanup());

describe('application workspace', () => {
  it('switches the complete shell to Turkish immediately', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /UI Settings/ }));
    await user.click(screen.getByRole('button', { name: 'Türkçe (TR)' }));
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
    expect(container.querySelector('.code-highlight-overlay .code-token.type')).toHaveTextContent('void');
    expect(container.querySelector('.code-highlight-overlay .code-token.function')).toHaveTextContent('DFS');
    await user.click(within(rightPanel as HTMLElement).getByRole('button', { name: 'Show simulation' }));
    expect(within(rightPanel as HTMLElement).getByRole('button', { name: 'Edit input' })).toBeInTheDocument();
    await user.click(within(rightPanel as HTMLElement).getByRole('button', { name: 'Collapse Simulation View' }));
    expect(within(rightPanel as HTMLElement).getByRole('button', { name: 'Edit input' })).toBeInTheDocument();
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
    expect(container.querySelector('.panel-left')).toHaveStyle({ width: '480px' });
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
    expect(screen.getByRole('option', { name: /DeepSeek R1 Distill Qwen 7B/ }))
      .toBeInTheDocument();
    expect(screen.getByText(/browser-managed OPFS\/cache/)).toBeInTheDocument();
    expect(screen.getByText(/initializes automatically/)).toBeInTheDocument();
    expect(screen.getByText('v2.1.2')).toBeInTheDocument();

    await user.selectOptions(modelSelect, 'Qwen3.5-9B-q4f32_1-MLC');
    const contextSelect = screen.getByRole('combobox', { name: 'Context window' });
    expect(contextSelect).toHaveValue('4096');
    expect(within(contextSelect).getByRole('option', { name: /8K context.*experimental/ }))
      .toBeInTheDocument();
    expect(within(contextSelect).getByRole('option', { name: /16K context.*experimental/ }))
      .toBeInTheDocument();
    expect(within(contextSelect).getByRole('option', { name: /32K context.*experimental/ }))
      .toBeInTheDocument();

    await user.selectOptions(modelSelect, 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC');
    expect(screen.getByText(/8 GB GPU is recommended/)).toBeInTheDocument();

    await user.selectOptions(modelSelect, 'Qwen2.5-Coder-0.5B-Instruct-q4f32_1-MLC');
    expect(within(contextSelect).getByRole('option', { name: /8K context.*experimental/ }))
      .toBeInTheDocument();
    expect(within(contextSelect).getByRole('option', { name: /16K context.*experimental/ }))
      .toBeInTheDocument();
    expect(within(contextSelect).getByRole('option', { name: /32K context.*experimental/ }))
      .toBeInTheDocument();
  });

  it('opens the requested YouTube Music playlist in a compact radio player', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByTitle('CodeXRay YouTube playlist player')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Play radio without opening' }));
    expect(screen.getByRole('button', { name: 'Open CodeXRay Radio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Radio')).toHaveStyle({ display: 'none' });
    await user.click(screen.getByRole('button', { name: 'Open CodeXRay Radio' }));
    const player = screen.getByTitle('CodeXRay YouTube playlist player');
    expect(player.getAttribute('src')).toContain('playlist=');
    expect(player.getAttribute('src')).toContain('/embed/8zj8h15VmQw');
    expect(player.getAttribute('src')).toContain('autoplay=0');
    expect(screen.getByRole('link', { name: 'Open playlist in YouTube Music' }).getAttribute('href'))
      .toContain('music.youtube.com/playlist');
    await user.click(screen.getByRole('button', { name: 'Close CodeXRay Radio' }));
    expect(screen.getByRole('button', { name: 'Open CodeXRay Radio' })).toBeInTheDocument();
    expect(screen.getByLabelText('Radio')).toHaveStyle({ display: 'none' });
  });

  it('keeps the active radio iframe stable when the interface language changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open CodeXRay Radio' }));
    const player = screen.getByTitle('CodeXRay YouTube playlist player');
    const initialSrc = player.getAttribute('src');
    expect(initialSrc).toContain('autoplay=0');
    expect(initialSrc).not.toContain('hl=');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: /UI Settings/ }));
    await user.click(screen.getByRole('button', { name: 'Türkçe (TR)' }));

    const translatedPlayer = screen.getByTitle('CodeXRay YouTube oynatma listesi');
    expect(translatedPlayer).toBe(player);
    expect(translatedPlayer.getAttribute('src')).toBe(initialSrc);
  });
});
