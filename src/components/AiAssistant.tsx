import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Loader } from 'lucide-react';
import { useTimeline } from '../context/TimelineContext';
import { askQuestion } from '../services/aiService';
import { t } from '../i18n/translations';
import './AiAssistant.css';

interface ChatMessage {
  role: 'system' | 'user' | 'ai';
  content: string;
}

const TypewriterText: React.FC<{ text: string }> = ({ text }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let currentText = '';
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        currentText += text.charAt(i);
        setDisplayedText(currentText);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 15);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayedText}</span>;
};

export const AiAssistant: React.FC = () => {
  const { code, steps, currentIndex, analysis, language, apiKey, selectedExampleQuestion, setSelectedExampleQuestion } = useTimeline();
  const currentStep = steps[currentIndex];
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [chatHistory, analysis, currentStep, isTyping]);

  // Clear history on new algorithm/code
  useEffect(() => {
    setChatHistory([]);
  }, [code]);

  useEffect(() => {
    if (selectedExampleQuestion) {
      submitQuestion(`${selectedExampleQuestion}\n\nBu soruyu mevcut algoritma ile nasıl çözebiliriz?`);
      setSelectedExampleQuestion(null);
    }
  }, [selectedExampleQuestion]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    await submitQuestion(question.trim());
  };

  const submitQuestion = async (userMessage: string) => {
    setQuestion('');
    const currentHistory = [...chatHistory];
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    const answer = await askQuestion(userMessage, code, currentStep, language, apiKey, currentHistory);
    
    setChatHistory(prev => [...prev, { role: 'ai', content: answer }]);
    setIsTyping(false);
  };

  const getSystemMessage = () => {
    if (analysis) return analysis;
    if (currentStep?.explanation) return currentStep.explanation;
    return t('awaitingData', language);
  };

  return (
    <div className="ai-assistant">
      <div className="ai-header">
        <Bot size={16} className="ai-icon" />
        <span>{t('bilgicDede', language)}</span>
      </div>
      <div className="ai-body" ref={chatBodyRef}>
        <div className="chat-message system-msg">
          <p><TypewriterText text={getSystemMessage()} /></p>
        </div>
        
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-message ${msg.role}-msg`}>
            {msg.role === 'ai' && <Bot size={14} className="msg-icon" />}
            <p>{msg.role === 'ai' && idx === chatHistory.length - 1 ? <TypewriterText text={msg.content} /> : msg.content}</p>
          </div>
        ))}
        
        {isTyping && (
          <div className="chat-message ai-msg typing">
            <Loader size={14} className="spin-icon" />
            <p>{language === 'en' ? "Thinking..." : "Düşünüyor..."}</p>
          </div>
        )}
      </div>

      <form className="ai-chat" onSubmit={handleAsk}>
        <input 
          type="text" 
          placeholder={t('askPlaceholder', language)} 
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isTyping}
        />
        <button type="submit" className="send-btn" disabled={isTyping}>
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
