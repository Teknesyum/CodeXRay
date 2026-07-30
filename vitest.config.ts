import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/services/inputParsers.ts',
        'src/services/simulators.ts',
        'src/services/extended*Simulators.ts',
        'src/services/compoundSimulators.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 65,
        statements: 60,
        branches: 55,
      },
    },
  },
});
