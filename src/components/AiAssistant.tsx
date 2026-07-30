import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader, Send } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion } from '../services/aiService';
import { t } from '../i18n/translations';
import './AiAssistant.css';

interface ChatMessage {
  role: 'system' | 'user' | 'ai';
  content: string;
}

export const AiAssistant = () => {
  const {
    algorithmName,
    code,
    steps,
    currentIndex,
    analysis,
    selectedExampleQuestion,
    setSelectedExampleQuestion,
    aiStatus,
  } = useTimeline();
  const currentStep = steps[currentIndex];
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [chatHistory, analysis, currentStep, isTyping]);

  useEffect(() => setChatHistory([]), [code]);

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
      );
      setChatHistory((previous) => [...previous, { role: 'ai', content: answer }]);
    } catch (error) {
      setChatHistory((previous) => [...previous, {
        role: 'system',
        content: error instanceof Error ? error.message : 'The local model could not answer.',
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [algorithmName, chatHistory, code, currentStep]);

  useEffect(() => {
    if (!selectedExampleQuestion) return;
    if (aiStatus === 'ready') void submitQuestion(selectedExampleQuestion);
    setSelectedExampleQuestion(null);
  }, [aiStatus, selectedExampleQuestion, setSelectedExampleQuestion, submitQuestion]);

  const systemMessage = analysis
    ?? currentStep?.explanation
    ?? (aiStatus === 'ready'
      ? 'Local AI is ready. Run a simulation or ask about the selected code.'
      : 'Deterministic simulation is ready. Load the optional local model in Settings to chat.');

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <Bot size={16} className="ai-icon" />
        <span>{t('masterCoder')}</span>
        <span className={`local-status-dot ${aiStatus}`} title={`Local AI: ${aiStatus}`} />
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
            <p>Thinking locally…</p>
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
          placeholder={aiStatus === 'ready' ? t('askPlaceholder') : 'Load the local model in Settings to chat'}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={isTyping || aiStatus !== 'ready'}
        />
        <button aria-label="Send question" type="submit" className="send-btn" disabled={isTyping || aiStatus !== 'ready'}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
