import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineProvider } from '../context/TimelineContext';
import { AiAssistant } from './AiAssistant';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('codexray.locale', 'en');
  localStorage.setItem('codexray.ai-chat.v1', JSON.stringify([
    { role: 'user', content: 'Explain the current step.' },
    { role: 'ai', content: 'The pointer advances after the comparison.' },
  ]));
});

afterEach(() => {
  cleanup();
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('AiAssistant response copy control', () => {
  it('copies the AI response from its message action', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(
      <TimelineProvider>
        <AiAssistant collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Copy AI response' }));

    expect(writeText).toHaveBeenCalledWith('The pointer advances after the comparison.');
    expect(screen.getByRole('button', { name: 'AI response copied' })).toHaveClass('copied');
  });

  it('previews AI Markdown while keeping user input as plain text', () => {
    localStorage.setItem('codexray.ai-chat.v1', JSON.stringify([
      { role: 'user', content: '**Do not format this**' },
      { role: 'ai', content: '## Explanation\n\nUse `index + 1`.' },
    ]));

    render(
      <TimelineProvider>
        <AiAssistant collapsed={false} onToggleCollapse={() => undefined} />
      </TimelineProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Explanation', level: 2 })).toBeInTheDocument();
    expect(screen.getByText('index + 1').tagName).toBe('CODE');
    expect(screen.getByText('**Do not format this**').querySelector('strong')).toBeNull();
  });
});
