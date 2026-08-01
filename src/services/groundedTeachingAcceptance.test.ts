import { describe, expect, it } from 'vitest';
import type { CustomSimulationPackageV1, WorkspaceSnapshotV1 } from '../types/godMode';
import { compileDpTemplatePackage, type DpTemplateId } from './dpTemplateCompiler';
import { compilePredictWinnerPackage } from './intervalDpCompiler';
import { routeGodModeRequest } from './godModeRouting';

const workspace: WorkspaceSnapshotV1 = {
  version: 1,
  algorithmName: 'Custom Code',
  code: '',
  simulationInput: { kind: 'array', text: '[8,3,5,1]' },
  steps: [],
  currentIndex: 0,
  analysis: null,
  inputError: null,
  activePackageId: null,
  packageOutOfSync: false,
};

const packages = (): CustomSimulationPackageV1[] => [
  compilePredictWinnerPackage({ id: 'pw', request: 'Predict Winner [1,5,2]', locale: 'en', workspace }),
  ...([
    ['house-robber-1d-dp', 'House Robber [2,7,9,3,1]'],
    ['lcs-2d-dp', 'LCS ["abcde","ace"]'],
    ['longest-palindrome-interval-dp', 'Longest Palindromic Subsequence "bbbab"'],
  ] as Array<[DpTemplateId, string]>).flatMap(([template, request]) => [
    compileDpTemplatePackage({ template, id: `${template}-en`, request, locale: 'en', workspace }),
    compileDpTemplatePackage({ template, id: `${template}-tr`, request, locale: 'tr', workspace }),
  ]),
];

describe('grounded teaching acceptance corpus', () => {
  it('derives every five-lens checkpoint from the exact committed snapshot', () => {
    for (const packageValue of packages()) {
      expect(packageValue.teachingPlan.checkpoints.length, packageValue.id).toBeGreaterThan(1);
      for (const { checkpoint, narration } of packageValue.teachingPlan.checkpoints) {
        const step = packageValue.steps[checkpoint.stepIndex];
        const next = packageValue.steps[checkpoint.stepIndex + 1];
        expect(narration.stepIndex, packageValue.id).toBe(checkpoint.stepIndex);
        expect(narration.activeLine, packageValue.id).toBe(step.lineNumber);
        expect(narration.decisionReason, packageValue.id).toBe(step.explanation);
        expect(narration.lenses.reasoning, packageValue.id).toBe(step.explanation);
        expect(narration.nextMove, packageValue.id).toBe(next?.explanation
          ?? (packageValue.locale === 'tr' ? 'Simülasyon tamamlandı.' : 'The simulation is complete.'));
        expect(JSON.stringify(narration), packageValue.id).not.toMatch(/undefined|NaN|\[object Object\]/);
        if (step.visualData.type === 'matrix') {
          for (const highlight of step.visualData.highlights) {
            expect(
              narration.cellDiffs.some((value) => value.includes(`dp[${highlight.row}][${highlight.column}] [${highlight.role}]`)),
              `${packageValue.id}:${checkpoint.stepIndex}`,
            ).toBe(true);
          }
        }
      }
    }
  });

  it('keeps command routing deterministic for Turkish, English, mixed language, and typo-heavy DP requests', () => {
    const corpus = [
      ['leetcode 198 house robber kodunu yz ve simule et', 'house-robber-1d-dp'],
      ['LCS cozumunu write et ve tabloyu goster', 'lcs-2d-dp'],
      ['516 en uzun palindromik alt dizi çöz ve simulate', 'longest-palindrome-interval-dp'],
      ['Predict the Winner çöz, dp tablosunu show', 'predict-winner-interval-dp'],
    ] as const;
    for (const [request, template] of corpus) {
      expect(routeGodModeRequest(request, [], 0), request).toEqual({ type: 'create-algorithm', template });
    }
  });

  it('never lets a navigation request inherit an older discussion destination', () => {
    const steps = packages()[0].steps;
    expect(routeGodModeRequest('7. adıma git', steps, 1)).toEqual({
      type: 'deterministic', actions: [{ type: 'jump', index: 6 }],
    });
    expect(routeGodModeRequest('önceki önemli checkpointe dön', steps, 6)).toEqual({
      type: 'deterministic', actions: [{ type: 'previous-important' }],
    });
  });
});
