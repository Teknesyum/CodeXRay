import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const masterPath = path.join(root, 'docs', 'legacy', 'CODEXRAY_MASTER_REQUIREMENTS_AND_ACCEPTANCE_TESTS.md');
const productDocuments = [
  path.join(root, 'docs', 'legacy', 'CODEXRAY_PRODUCT_REQUIREMENTS_AND_REAL_USAGE_SCENARIOS.md'),
  path.join(root, 'docs', 'PRODUCT_REQUIREMENTS.tr.md'),
];

const evidenceByPrefix: Record<string, string[]> = {
  'REQ-A11Y': ['e2e/accessibility-contract.spec.ts'],
  'REQ-AGENT': ['src/services/titanEngine.test.ts', 'e2e/titan-mode-failures.spec.ts'],
  'REQ-AI': ['src/services/localAiService.test.ts', 'e2e/real-ai.spec.ts'],
  'REQ-CATALOG': ['src/services/catalogFinalOracle.test.ts', 'e2e/unicode-and-catalog.spec.ts'],
  'REQ-CODE': ['src/services/simLang.test.ts', 'e2e/interval-dp-titan-mode.spec.ts'],
  'REQ-CONTROL': ['src/components/ControlBar.test.tsx', 'e2e/smoke.spec.ts'],
  'REQ-COREVIS': ['src/components/DynamicVisualizer.test.tsx', 'e2e/accessibility-contract.spec.ts'],
  'REQ-DEPLOY': ['scripts/deploy-lib.test.ts'],
  'REQ-EDITOR': ['src/App.test.tsx', 'e2e/smoke.spec.ts'],
  'REQ-GRAPH': ['src/components/GraphInputEditor.test.tsx', 'e2e/graph-builder-daily.spec.ts'],
  'REQ-I18N': ['src/i18n/translations.test.ts', 'e2e/search-theme-state.spec.ts'],
  'REQ-INPUT': ['src/services/inputParsers.test.ts', 'e2e/tree-input-resilience.spec.ts'],
  'REQ-LAYOUT': ['src/services/workspaceLayout.test.ts', 'e2e/responsive-layout.spec.ts'],
  'REQ-PARSER': ['src/services/inputParsers.test.ts'],
  'REQ-PERF-CORE': ['scripts/check-build-size.mjs', 'src/services/simulators.test.ts'],
  'REQ-PRESET': ['src/services/inputPresets.test.ts', 'e2e/release-tour.spec.ts'],
  'REQ-RADIO': ['e2e/radio-controller.spec.ts', 'e2e/real-radio.spec.ts'],
  'REQ-ROUTE': ['src/services/titanModeRouting.test.ts', 'e2e/ai-routing-interruption.spec.ts'],
  'REQ-SEC-CORE': ['scripts/repository-contracts.test.ts', 'e2e/markdown-resilience.spec.ts'],
  'REQ-SIM': ['src/services/simulators.test.ts', 'e2e/learning-journey.spec.ts'],
  'REQ-STORE': ['src/services/siteReset.test.ts', 'src/context/TimelineContext.test.tsx'],
  'REQ-THEME': ['e2e/theme-contrast.spec.ts', 'e2e/search-theme-state.spec.ts'],
  'REQ-TIMELINE': ['src/context/TimelineContext.test.tsx', 'e2e/learning-journey.spec.ts'],
  'REQ-TUTOR': ['src/services/teachingPlan.test.ts', 'e2e/interval-dp-titan-mode.spec.ts'],
  'REQ-TXN': ['src/context/TimelineContext.titanMode.test.tsx', 'e2e/titan-mode-failures.spec.ts'],
  'REQ-UI': ['src/services/titanModeRouting.test.ts', 'e2e/responsive-layout.spec.ts'],
  'REQ-VAR': ['src/components/VariablesPanel.test.tsx', 'src/components/DynamicVisualizer.test.tsx'],
  'REQ-VIS': ['src/components/DynamicVisualizer.test.tsx', 'e2e/graph-workflow.spec.ts'],
  'REQ-WS': ['src/context/TimelineContext.test.tsx', 'e2e/release-tour.spec.ts'],
  'APP-A11Y': ['e2e/accessibility-contract.spec.ts'],
  'APP-AI': ['src/services/localAiService.test.ts', 'e2e/real-ai.spec.ts'],
  'APP-CAT': ['src/services/catalogFinalOracle.test.ts', 'src/services/codeRegistry.test.ts'],
  'APP-CONTROL': ['src/components/ControlBar.test.tsx', 'e2e/smoke.spec.ts'],
  'APP-DEPLOY': ['scripts/deploy-lib.test.ts'],
  'APP-E2E': ['e2e/release-tour.spec.ts', 'e2e/error-isolation.spec.ts'],
  'APP-EDIT': ['src/App.test.tsx', 'e2e/smoke.spec.ts'],
  'APP-GRAPH': ['src/components/GraphInputEditor.test.tsx', 'e2e/graph-builder-daily.spec.ts'],
  'APP-I18N': ['src/i18n/translations.test.ts', 'e2e/search-theme-state.spec.ts'],
  'APP-IN': ['src/services/inputParsers.test.ts', 'e2e/tree-input-resilience.spec.ts'],
  'APP-LAYOUT': ['src/services/workspaceLayout.test.ts', 'e2e/responsive-layout.spec.ts'],
  'APP-PERF': ['scripts/check-build-size.mjs', 'src/services/randomizedRegression.test.ts'],
  'APP-RADIO': ['e2e/radio-controller.spec.ts', 'e2e/radio-autoplay.spec.ts', 'e2e/real-radio.spec.ts'],
  'APP-SEC': ['scripts/repository-contracts.test.ts', 'e2e/markdown-resilience.spec.ts'],
  'APP-SIM': ['src/services/simulators.test.ts', 'e2e/learning-journey.spec.ts'],
  'APP-STORE': ['src/services/siteReset.test.ts', 'src/context/TimelineContext.test.tsx'],
  'APP-THEME': ['e2e/theme-contrast.spec.ts', 'e2e/search-theme-state.spec.ts'],
  'APP-VIS': ['src/components/DynamicVisualizer.test.tsx', 'e2e/interval-dp-titan-mode.spec.ts'],
  'GM': ['docs/legacy/GOD_MODE_MULTI_AGENT_PLAN.md', 'src/services/gm2Contracts.test.ts'],
  'GM-E2E': ['e2e/ai-actions.spec.ts', 'e2e/titan-mode-user-graph.spec.ts', 'e2e/titan-mode-failures.spec.ts'],
  'GM-INT': ['src/services/gm2Contracts.test.ts', 'src/services/titanEngine.test.ts'],
  'GM-PERF': ['src/test/progressWatchdog.test.ts', 'scripts/check-build-size.mjs'],
  'GM-PERSIST': ['src/context/TimelineContext.titanMode.test.tsx', 'src/services/siteReset.test.ts'],
  'GM-SEC': ['src/services/simLang.test.ts', 'scripts/repository-contracts.test.ts'],
};

const numericId = /\b(?:REQ|APP|GM)-[A-Z0-9-]*\d\b/g;
const prefixOf = (id: string) => id.replace(/-\d+$/, '');

describe('master requirements coverage manifest', () => {
  it('maps every requirement and acceptance ID to existing executable evidence', async () => {
    const master = await readFile(masterPath, 'utf8');
    const ids = [...new Set(master.match(numericId) ?? [])].sort();
    expect(ids.length).toBeGreaterThan(350);
    const unmapped = ids.filter((id) => !evidenceByPrefix[prefixOf(id)]);
    expect(unmapped).toEqual([]);
    const evidence = [...new Set(ids.flatMap((id) => evidenceByPrefix[prefixOf(id)]))];
    await expect(Promise.all(evidence.map((file) => access(path.join(root, file))))).resolves.toBeDefined();
  });

  it('keeps product approval checklists closed and document statuses current', async () => {
    const master = await readFile(masterPath, 'utf8');
    expect(master).toContain('Durum: `UYGULANDI / COVERED`');
    for (const documentPath of productDocuments) {
      const document = await readFile(documentPath, 'utf8');
      expect(document).not.toMatch(/^- \[ \]/m);
      expect(document).toContain('Durum: `UYGULANDI / COVERED`');
    }
  });
});
