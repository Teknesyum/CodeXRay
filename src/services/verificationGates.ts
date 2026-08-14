import type { ProblemSpecV2, DpFamilyContractV2, VerificationGatesV1 } from '../types/titan';

export const validateProblemSpec = (spec: ProblemSpecV2): boolean => {
  if (!spec.title || !spec.family || !spec.statement || !spec.signature) {
    return false;
  }
  return true;
};

export const validateDpFamilyContract = (contract: DpFamilyContractV2): boolean => {
  if (contract.family !== 'dp') return false;
  if (!contract.stateVariables.length || !contract.transitionRules.length) return false;
  return true;
};

export const runVerificationGates = (
  spec: ProblemSpecV2,
  contract: DpFamilyContractV2,
  budgetValid: boolean,
  lineMappingValid: boolean,
  examplesPassed: boolean,
  edgeCasesPassed: boolean,
  propertyTestsPassed: boolean,
  finalResultValid: boolean,
  traceDeterministic: boolean,
  visualCompleteness: boolean,
  complexityConsistent: boolean,
  transactionSafe: boolean
): VerificationGatesV1 => {
  return {
    version: 1,
    schemaValid: validateProblemSpec(spec) && validateDpFamilyContract(contract),
    budgetValid,
    lineMappingValid,
    examplesPassed,
    edgeCasesPassed,
    propertyTestsPassed,
    finalResultValid,
    traceDeterministic,
    visualCompleteness,
    complexityConsistent,
    transactionSafe,
  };
};
