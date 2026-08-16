import { useEffect } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TimelineProvider, useTimeline } from '../context/TimelineContext';
import { CodeEditor } from './CodeEditor';

const TypingEditor = () => {
  const { setCode, setIsTitanModeTypingSource, setSteps } = useTimeline();

  useEffect(() => {
    setSteps([]);
    setCode('class Solution { return true; }');
    setIsTitanModeTypingSource(true);
  }, [setCode, setIsTitanModeTypingSource, setSteps]);

  return <CodeEditor collapsed={false} onToggleCollapse={() => undefined} onSaveInput={() => undefined} />;
};

afterEach(() => cleanup());

describe('CodeEditor visual continuity', () => {
  it('keeps syntax highlighting while Titan Mode types new neon text', async () => {
    const { container } = render(
      <TimelineProvider>
        <TypingEditor />
      </TimelineProvider>,
    );

    await waitFor(() => expect(container.querySelector('.titan-mode-code-typing')).not.toBeNull());
    expect(container.querySelector('.titan-mode-code-typing .code-token.keyword'))
      .toHaveTextContent('class');
    expect(container.querySelector('.titan-mode-code-new-text .code-token.keyword'))
      .toHaveTextContent('return');
    expect(container.querySelector('.code-edit-layer')).toBeNull();
  });
});
