import type {
  CustomSimulationPackageV1,
  InputContractV1,
  ProgramSpecV1,
  SimLangFunctionV1,
  VisualizationContract,
} from '../../types/titan';
import type { Locale } from '../../i18n/translations';
import { compileCustomSimulationPackage } from '../customSimulationCompiler';
import { parseLite } from '../simLangLite';
import { validateProgramSpec } from '../simLang';

export type TranslatableLanguage = 'cpp' | 'java' | 'python';

export interface TranslationAttemptFailure {
  attempt: number;
  reason: string;
}

export type TranslationResult =
  | { ok: true; package: CustomSimulationPackageV1; attempts: number; failures: TranslationAttemptFailure[] }
  | { ok: false; reason: string; failures: TranslationAttemptFailure[] };

const mergeFragments = (fragments: string[]): ProgramSpecV1 => {
  if (!fragments.length) throw new Error('Translation produced no SimLang-Lite function fragments.');
  const programs = fragments.map(parseLite);
  const first = programs[0];
  const functions: SimLangFunctionV1[] = [];
  const names = new Set<string>();
  for (const program of programs) {
    if (program.inputKind !== first.inputKind || JSON.stringify(program.entry) !== JSON.stringify(first.entry)) {
      throw new Error('Every function fragment must declare the same input kind and entry block.');
    }
    for (const fn of program.functions) {
      if (names.has(fn.name)) throw new Error(`Duplicate translated function '${fn.name}'.`);
      names.add(fn.name);
      functions.push(fn);
    }
  }
  const candidate: ProgramSpecV1 = { ...first, functions };
  const validation = validateProgramSpec(candidate);
  if (!validation.valid || !validation.program) throw new Error(validation.errors.join(' '));
  return validation.program;
};

export const translateToVerifiedPackage = (options: {
  id: string;
  title: string;
  locale: Locale;
  originalLanguage: TranslatableLanguage;
  originalSource: string;
  attempts: string[][];
  input: InputContractV1;
  visualization: VisualizationContract;
  analysis: string;
  verifiedAt: number;
}): TranslationResult => {
  const failures: TranslationAttemptFailure[] = [];
  const attempts = options.attempts.slice(0, 3);
  for (let index = 0; index < attempts.length; index += 1) {
    try {
      const program = mergeFragments(attempts[index]);
      const packageValue = compileCustomSimulationPackage({
        id: options.id,
        title: options.title,
        locale: options.locale,
        program,
        input: options.input,
        visualization: options.visualization,
        analysis: options.analysis,
      });
      if (!packageValue.steps.length || !packageValue.tests.passed) {
        throw new Error('Translated program did not produce a verified deterministic trace.');
      }
      return {
        ok: true,
        package: {
          ...packageValue,
          translation: {
            version: 1,
            originalLanguage: options.originalLanguage,
            originalSource: options.originalSource,
            generatedFormat: 'simlang-lite',
            deterministicTrace: true,
            verifiedAt: options.verifiedAt,
          },
        },
        attempts: index + 1,
        failures,
      };
    } catch (error) {
      failures.push({
        attempt: index + 1,
        reason: error instanceof Error ? error.message : 'Translation validation failed.',
      });
    }
  }
  return {
    ok: false,
    reason: failures.at(-1)?.reason ?? 'No translation attempt was provided.',
    failures,
  };
};
