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
    await user.click(screen.getByRole('button', { name: 'YZ panelini büyüt' }));

    expect(controls).not.toHaveClass('collapsed');
    expect(controls).toHaveStyle({ height: '58px' });
    expect(controls?.querySelector('.simulate-btn')).not.toBeNull();
  });
});
