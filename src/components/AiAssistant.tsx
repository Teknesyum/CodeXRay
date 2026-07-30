import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader, Send, Trash2 } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion } from '../services/aiService';
import type { AssistantMessage } from '../services/aiContext';
import { t, translateRuntimeText } from '../i18n/translations';
import './AiAssistant.css';

const CHAT_STORAGE_KEY = 'codexray.ai-chat.v1';
const MAX_STORED_MESSAGES = 24;

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
    selectedExampleQuestion,
    setSelectedExampleQuestion,
    aiStatus,
    locale,
  } = useTimeline();
  const currentStep = steps[currentIndex];
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<AssistantMessage[]>(loadChatHistory);
  const [isTyping, setIsTyping] = useState(false);
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

  const submitQuestion = useCallback(async (userMessage: string) => {
    const history = [...chatHistory];
    setQuestion('');
    setChatHistory((previous) =>
      [...previous, { role: 'user' as const, content: userMessage }]
        .slice(-MAX_STORED_MESSAGES),
    );
    setIsTyping(true);
    try {
      const answer = await askQuestion(
        userMessage,
        {
          algorithmName,
          code,
          simulationInput,
          steps,
          currentIndex,
          analysis,
          inputError,
          isPlaying,
          locale,
        },
        history,
      );
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
    analysis,
    chatHistory,
    code,
    currentIndex,
    inputError,
    isPlaying,
    locale,
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
