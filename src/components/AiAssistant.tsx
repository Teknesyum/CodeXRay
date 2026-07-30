import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader, Send } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion } from '../services/aiService';
import { t, translateRuntimeText } from '../i18n/translations';
import './AiAssistant.css';

interface ChatMessage {
  role: 'system' | 'user' | 'ai';
  content: string;
}

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
    selectedExampleQuestion,
    setSelectedExampleQuestion,
    aiStatus,
    locale,
  } = useTimeline();
  const currentStep = steps[currentIndex];
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);
  const panelTitle = t('masterCoder', locale);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatHistory, analysis, currentStep, isTyping]);

  useEffect(() => setChatHistory([]), [code, locale]);

  const submitQuestion = useCallback(async (userMessage: string) => {
    const history = [...chatHistory];
    setQuestion('');
    setChatHistory((previous) => [...previous, { role: 'user', content: userMessage }]);
    setIsTyping(true);
    try {
      const answer = await askQuestion(
        userMessage,
        algorithmName,
        code,
        currentStep,
        history,
        locale,
      );
      setChatHistory((previous) => [...previous, { role: 'ai', content: answer }]);
    } catch (error) {
      setChatHistory((previous) => [...previous, {
        role: 'system',
        content: translateRuntimeText(error instanceof Error ? error.message : 'The local model could not answer.', locale),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [algorithmName, chatHistory, code, currentStep, locale]);

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
        <span className={`local-status-dot ${aiStatus}`} title={`${t('localAi', locale)}: ${t(`status_${aiStatus}`, locale)}`} />
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
