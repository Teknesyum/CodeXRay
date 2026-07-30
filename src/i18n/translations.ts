type Dictionary = {
  [key: string]: string;
};

const translations: Dictionary = {
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
  masterCoder: 'Master Coder',

  // Common
  error: 'An error occurred'
};

export const t = (key: string): string => translations[key] ?? key;
