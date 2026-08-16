import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';

beforeEach(() => {
  localStorage.removeItem('codexray.layout.v2');
  localStorage.setItem('codexray.locale', 'tr');
});

afterEach(() => cleanup());

describe('right workspace layout', () => {
  it('keeps controls visible at their minimum height while maximizing the assistant', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const controls = container.querySelector('.control-container');

    expect(controls).toHaveStyle({ height: '58px' });
    await user.click(await screen.findByRole('button', { name: 'YZ panelini büyüt' }, { timeout: 5_000 }));

    expect(controls).not.toHaveClass('collapsed');
    expect(controls).toHaveStyle({ height: '58px' });
    expect(controls?.querySelector('.simulate-btn')).not.toBeNull();
  });

  it('maximizes and restores the simulation panel while keeping controls available', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const visualizer = container.querySelector('.visualizer-container');
    const assistant = container.querySelector('.assistant-container');
    const controls = container.querySelector('.control-container');

    await user.click(await screen.findByRole('button', { name: 'Simülasyon panelini büyüt' }, { timeout: 5_000 }));

    expect(visualizer).toHaveClass('maximized');
    expect(visualizer).toHaveStyle({ flex: '1' });
    expect(assistant).toHaveStyle({ display: 'none' });
    expect(controls).toHaveStyle({ height: '58px' });
    expect(controls?.querySelector('.simulate-btn')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Simülasyon panelini geri yükle' }));
    expect(visualizer).not.toHaveClass('maximized');
    expect(assistant).not.toHaveStyle({ display: 'none' });
  });
});
