export type Language = 'tr' | 'en';

type Dictionary = {
  [key: string]: string;
};

const translations: Record<Language, Dictionary> = {
  tr: {
    // CodeEditor
    sourceCode: 'Kaynak Kodu',
    presets: 'Hazır Algoritmalar',
    simulationInput: 'Simülasyon Girdisi:',
    placeholderCode: 'Kodunuzu buraya yapıştırın...',
    
    // ControlBar
    simulate: 'Simüle Et',
    analyze: 'Analiz Et',
    examples: 'Örnek Sorular',
    generating: 'Üretiliyor...',
    exampleQuestions: 'Örnek Mülakat Soruları',
    example: 'Örnek',
    
    // DynamicVisualizer
    simulationView: 'Simülasyon Görünümü',
    awaitingData: 'Simülasyon Verisi Bekleniyor...',
    
    // VariablesPanel
    variablesTrace: 'Değişkenler & Takip',
    
    // AiAssistant
    askPlaceholder: 'Sorunuzu buraya yazın...',
    bilgicDede: 'Bilgiç Dede',
    
    // Common
    error: 'Hata oluştu'
  },
  en: {
    // CodeEditor
    sourceCode: 'Source Code',
    presets: 'Algorithm Presets',
    simulationInput: 'Simulation Input:',
    placeholderCode: 'Paste your code here...',
    
    // ControlBar
    simulate: 'Simulate',
    analyze: 'Analyze',
    examples: 'Examples',
    generating: 'Generating...',
    exampleQuestions: 'Example Interview Questions',
    example: 'Example',
    
    // DynamicVisualizer
    simulationView: 'Simulation View',
    awaitingData: 'Awaiting Simulation Data...',
    
    // VariablesPanel
    variablesTrace: 'Variables & Trace',
    
    // AiAssistant
    askPlaceholder: 'Type your question here...',
    bilgicDede: 'Master Coder',
    
    // Common
    error: 'An error occurred'
  }
};

export const t = (key: string, lang: string): string => {
  const language = lang as Language;
  if (translations[language] && translations[language][key]) {
    return translations[language][key];
  }
  return key; // fallback to key
};
