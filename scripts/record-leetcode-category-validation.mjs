import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptRoot = path.dirname(fileURLToPath(import.meta.url));
const matrixPath = path.join(scriptRoot, '../src/data/leetcodeCategoryValidation.json');

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key?.startsWith('--') || value === undefined) {
    throw new Error('Arguments must be provided as --key value pairs.');
  }
  args.set(key.slice(2), value);
}

const categoryId = args.get('category');
const problemId = args.get('problem');
const model = args.get('model');
const outcome = args.get('outcome');
const notes = args.get('notes') ?? '';

if (!categoryId || !problemId || !model || !['passed', 'failed'].includes(outcome)) {
  throw new Error('Required: --category, --problem, --model, and --outcome passed|failed.');
}

const gateNames = ['source', 'input', 'trace', 'visual', 'finalResult'];
const gates = Object.fromEntries(gateNames.map((gate) => [gate, args.get(gate) === 'true']));
const completePass = outcome === 'passed' && gateNames.every((gate) => gates[gate]);
if (outcome === 'passed' && !completePass) {
  throw new Error('A passing result requires all five gates to be true.');
}

const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const category = matrix.categories.find((entry) => entry.id === categoryId);
const problem = matrix.problems.find((entry) => entry.id === problemId);
if (!category) throw new Error(`Unknown category: ${categoryId}`);
if (!problem) throw new Error(`Unknown LeetCode problem: ${problemId}`);
if (!problem.categories.includes(categoryId) || !category.problemIds.includes(problemId)) {
  throw new Error(`Problem ${problemId} does not belong to ${categoryId}.`);
}

const attempt = {
  attemptedAt: new Date().toISOString(),
  categoryId,
  model,
  outcome,
  gates,
  notes,
};

problem.validations.push(attempt);
category.modelAttempts.push({ problemId, ...attempt });
category.testedProblemIds = [...new Set([...category.testedProblemIds, problemId])];
category.passedProblemIds = category.passedProblemIds.filter((id) => id !== problemId);
category.failedProblemIds = category.failedProblemIds.filter((id) => id !== problemId);

if (completePass) {
  category.passedProblemIds.push(problemId);
  category.status = 'passed';
  category.marker = '+';
} else {
  category.failedProblemIds.push(problemId);
  if (category.passedProblemIds.length === 0) {
    category.status = 'failed';
    category.marker = '';
  }
}

matrix.updatedAt = new Date().toISOString();
fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`${categoryId}: ${outcome} with ${model} on LeetCode ${problemId}`);
