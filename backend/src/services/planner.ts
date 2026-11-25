import { ai, fallback } from './ai.js';
import type {
  DocumentAnalysis,
  LearningPathPhase,
  Profile,
  SkillGap,
} from '../store.js';

export async function analyzeGaps(
  profile: Profile,
  evidence?: DocumentAnalysis
): Promise<SkillGap[]> {
  const result = await ai<SkillGap[]>(
    `Learner: ${JSON.stringify(profile)}\nEvidence: ${JSON.stringify(evidence || '')}\nCompare against target role ${profile.target_role}.`,
    'Schema: array of {skill,currentLevel,requiredLevel,status,priority,reason,action}.',
    fallback.gaps
  );
  return Array.isArray(result) ? result : fallback.gaps;
}

export async function generatePath(
  profile: Profile,
  gaps: SkillGap[]
): Promise<LearningPathPhase[]> {
  const result = await ai<LearningPathPhase[]>(
    `Create an adaptive path for ${JSON.stringify(profile)}. Gaps: ${JSON.stringify(gaps)}. Avoid teaching mastered skills unnecessarily.`,
    'Schema: array of {phase,weeks,objectives:string[]}.',
    fallback.path
  );
  return Array.isArray(result) ? result : fallback.path;
}

export async function generateChatResponse(
  profile: Profile,
  state: {
    nextAction: string;
    gaps: SkillGap[];
    progress: Record<string, unknown>;
    struggleSkills?: string[];
  },
  message: string
): Promise<{ answer: string; actions: string[]; references: string[] }> {
  const struggleNote =
    state.struggleSkills && state.struggleSkills.length > 0
      ? ` Notice you recently struggled on ${state.struggleSkills.join(', ')} — let's reinforce prerequisites before moving ahead.`
      : '';

  return ai(
    `Profile:${JSON.stringify(profile)} State:${JSON.stringify(state)} User:${message}`,
    'Schema: {answer:string,actions:string[],references:string[]}.',
    {
      answer: `Based on your current ${profile.target_role} path, focus next on "${state.nextAction}". Use your available ${profile.study_minutes} min/day for one focused concept block followed by hands-on implementation.${struggleNote}`,
      actions: [
        `Complete "${state.nextAction}"`,
        'Attempt a 4-question practice check on your highest-priority gap',
        'Log notes on any difficult prerequisite',
      ],
      references: state.gaps
        .filter((g) => g.priority === 'High')
        .map((g) => `${g.skill}: ${g.action}`),
    }
  );
}
