import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader, MapPin, Maximize2, Minimize2, Send, Trash2 } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion } from '../services/aiService';
import type { AssistantMessage } from '../services/aiContext';
import {
  extractTimelineAction,
  interpretTimelineRequest,
  resolveTimelineTarget,
  stripTimelineActions,
  type TimelineAction,
} from '../services/aiTimelineControl';
import { t, translateRuntimeText } from '../i18n/translations';
import './AiAssistant.css';

const CHAT_STORAGE_KEY = 'codexray.ai-chat.v1';
const MAX_STORED_MESSAGES = 24;

const navigationExplanationPrompt = (
  originalQuestion: string,
  action: TimelineAction,
  targetIndex: number,
): string => action.type === 'play'
  ? [
    `Original request: ${originalQuestion}`,
    `CodeXRay safely started playback from step ${targetIndex + 1}.`,
    'Briefly confirm that playback is running. It may advance while you answer, so do not claim that the starting snapshot is still the visible current step.',
    'Do not emit another CODEXRAY_ACTION directive in this response.',
  ].join('\n')
  : [
    `Original request: ${originalQuestion}`,
    `CodeXRay has now safely applied the requested timeline action "${action.type}".`,
    `The live simulation is paused at step ${targetIndex + 1}.`,
    'Explain the exact current code line, changed variables or visual state, why this moment matters, and what the next deterministic action will be.',
    'Do not emit another CODEXRAY_ACTION directive in this response.',
  ].join('\n');

const loadChatHistory = (): AssistantMessage[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((message): message is AssistantMessage =>
        Boolean(
          message
          && typeof message === 'object'
          && 'role' in message
          && (message.role === 'system' || message.role === 'user' || message.role === 'ai')
          && 'content' in message
          && typeof message.content === 'string',
        ))
      .slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
};

interface AiAssistantProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const AiAssistant = ({ collapsed, onToggleCollapse }: AiAssistantProps) => {
  const {
    algorithmName,
    code,
    steps,
    currentIndex,
    analysis,
    simulationInput,
    inputError,
    isPlaying,
    jumpTo,
    pause,
    play,
    pinnedVariables,
    selectedExampleQuestion,
    setSelectedExampleQuestion,
    aiStatus,
    aiContextWindow,
    isAiMaximized,
    setIsAiMaximized,
    locale,
  } = useTimeline();
  const currentStep = steps[currentIndex];
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<AssistantMessage[]>(loadChatHistory);
  const [isTyping, setIsTyping] = useState(false);
  const [tourSteps, setTourSteps] = useState<number[]>([]);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const panelTitle = t('masterCoder', locale);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatHistory, analysis, currentStep, isTyping]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(chatHistory.slice(-MAX_STORED_MESSAGES)),
      );
    } catch {
      // Conversation memory remains available for this session when storage is unavailable.
    }
  }, [chatHistory]);

  const applyTimelineAction = useCallback((action: TimelineAction): number => {
    const targetIndex = resolveTimelineTarget(action, steps, currentIndex);
    if (action.type === 'play') {
      play();
      return targetIndex;
    }
    pause();
    if (action.type === 'tour') setTourSteps(action.checkpoints);
    jumpTo(targetIndex);
    return targetIndex;
  }, [currentIndex, jumpTo, pause, play, steps]);

  const submitQuestion = useCallback(async (userMessage: string) => {
    const history = [...chatHistory];
    setQuestion('');
    setChatHistory((previous) =>
      [...previous, { role: 'user' as const, content: userMessage }]
        .slice(-MAX_STORED_MESSAGES),
    );
    setIsTyping(true);
    try {
      const directAction = interpretTimelineRequest(userMessage, steps, currentIndex);
      let targetIndex = currentIndex;
      let workspaceIsPlaying = isPlaying;
      let modelQuestion = userMessage;
      if (directAction) {
        targetIndex = applyTimelineAction(directAction);
        workspaceIsPlaying = directAction.type === 'play';
        modelQuestion = navigationExplanationPrompt(userMessage, directAction, targetIndex);
      }
      let answer = await askQuestion(
        modelQuestion,
        {
          algorithmName,
          code,
          simulationInput,
          steps,
          currentIndex: targetIndex,
          analysis,
          inputError,
          isPlaying: workspaceIsPlaying,
          pinnedVariables,
          contextWindow: aiContextWindow,
          locale,
        },
        history,
      );
      const modelAction = directAction
        ? null
        : extractTimelineAction(answer, steps, currentIndex);
      if (modelAction) {
        targetIndex = applyTimelineAction(modelAction);
        workspaceIsPlaying = modelAction.type === 'play';
        answer = await askQuestion(
          navigationExplanationPrompt(userMessage, modelAction, targetIndex),
          {
            algorithmName,
            code,
            simulationInput,
            steps,
            currentIndex: targetIndex,
            analysis,
            inputError,
            isPlaying: workspaceIsPlaying,
            pinnedVariables,
            contextWindow: aiContextWindow,
            locale,
          },
          history,
        );
      }
      answer = stripTimelineActions(answer);
      setChatHistory((previous) =>
        [...previous, { role: 'ai' as const, content: answer }]
          .slice(-MAX_STORED_MESSAGES),
      );
    } catch (error) {
      setChatHistory((previous) =>
        [...previous, {
          role: 'system' as const,
          content: translateRuntimeText(error instanceof Error ? error.message : 'The local model could not answer.', locale),
        }].slice(-MAX_STORED_MESSAGES),
      );
    } finally {
      setIsTyping(false);
    }
  }, [
    algorithmName,
    aiContextWindow,
    analysis,
    applyTimelineAction,
    chatHistory,
    code,
    currentIndex,
    inputError,
    isPlaying,
    locale,
    pinnedVariables,
    simulationInput,
    steps,
  ]);

  useEffect(() => {
    if (!selectedExampleQuestion) return;
    if (aiStatus === 'ready') void submitQuestion(selectedExampleQuestion);
    setSelectedExampleQuestion(null);
  }, [aiStatus, selectedExampleQuestion, setSelectedExampleQuestion, submitQuestion]);

  const systemMessage = translateRuntimeText(analysis
    ?? currentStep?.explanation
    ?? (aiStatus === 'ready'
      ? t('aiReadyPrompt', locale)
      : t('deterministicReady', locale)), locale);
  const conversationTurnCount = chatHistory.filter((message) => message.role !== 'system').length;
  const contextLabel = steps.length
    ? t('contextStep', locale, { current: currentIndex + 1, total: steps.length })
    : t('contextCodeOnly', locale);

  if (collapsed) {
    return (
      <div className="ai-assistant">
        <div className="collapsed-panel-header">
          <span>{panelTitle}</span>
          <button
            type="button"
            className="panel-toggle"
            aria-label={t('expandPanel', locale, { panel: panelTitle })}
            onClick={onToggleCollapse}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <Bot size={16} className="ai-icon" />
        <span>{panelTitle}</span>
        <span className="context-chip" title={t('contextHelp', locale)}>{contextLabel}</span>
        <span className={`local-status-dot ${aiStatus}`} title={`${t('localAi', locale)}: ${t(`status_${aiStatus}`, locale)}`} />
        <button
          type="button"
          className={`panel-action-btn maximize-btn neon-toggle ${isAiMaximized ? 'active' : ''}`}
          aria-label={isAiMaximized ? 'Minimize AI panel' : 'Maximize AI panel'}
          onClick={() => setIsAiMaximized(!isAiMaximized)}
          title={isAiMaximized ? 'Küçült' : 'Tam Ekran'}
        >
          {isAiMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          type="button"
          className="clear-chat-btn"
          aria-label={t('clearConversation', locale)}
          title={t('memoryCount', locale, { count: conversationTurnCount })}
          onClick={() => setChatHistory([])}
          disabled={conversationTurnCount === 0 || isTyping}
        >
          <Trash2 size={13} />
        </button>
        <button
          type="button"
          className="panel-toggle"
          aria-label={t('collapsePanel', locale, { panel: panelTitle })}
          onClick={onToggleCollapse}
        >
          −
        </button>
      </div>
      <div className="ai-body" ref={chatBodyRef}>
        <div className="chat-message system-msg"><p>{systemMessage}</p></div>
        {chatHistory.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`chat-message ${message.role}-msg`}>
            {message.role === 'ai' && <Bot size={14} className="msg-icon" />}
            <p>{message.content}</p>
          </div>
        ))}
        {isTyping && (
          <div className="chat-message ai-msg typing">
            <Loader size={14} className="spin-icon" />
            <p>{t('thinkingLocally', locale)}</p>
          </div>
        )}
      </div>
      {tourSteps.length > 0 && (
        <nav className="ai-tour" aria-label={t('guidedTour', locale)}>
          <span><MapPin size={12} /> {t('keyMoments', locale)}</span>
          <div>
            {tourSteps.map((index) => (
              <button
                key={index}
                type="button"
                className={index === currentIndex ? 'active' : ''}
                aria-label={t('goToKeyMoment', locale, { step: index + 1 })}
                disabled={isTyping || aiStatus !== 'ready'}
                onClick={() => void submitQuestion(
                  locale === 'tr'
                    ? `${index + 1}. adıma git ve bu önemli noktayı anlat`
                    : `Go to step ${index + 1} and explain this key moment`,
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </nav>
      )}
      <form
        className="ai-chat"
        onSubmit={(event) => {
          event.preventDefault();
          if (question.trim()) void submitQuestion(question.trim());
        }}
      >
        <input
          type="text"
          maxLength={600}
          placeholder={aiStatus === 'ready' ? t('askPlaceholder', locale) : t('loadModelToChat', locale)}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={isTyping || aiStatus !== 'ready'}
        />
        <button aria-label={t('sendQuestion', locale)} type="submit" className="send-btn" disabled={isTyping || aiStatus !== 'ready'}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
