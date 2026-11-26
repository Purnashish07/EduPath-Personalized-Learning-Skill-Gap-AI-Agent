import { z } from 'zod';
import { aiJson, aiChatCompletion, fallback, type AiResult } from './ai.js';
import {
  id,
  type ChatMessage,
  type DocumentAnalysis,
  type LearningPathPhase,
  type LearningTask,
  type PracticeAttempt,
  type Profile,
  type SkillGap,
  type WeeklyPlanItem,
} from '../store.js';

export const skillGapSchema = z.object({
  skill: z.string().min(1),
  currentLevel: z.number().min(0).max(5),
  requiredLevel: z.number().min(1).max(5),
  status: z.string().min(1),
  priority: z.string().min(1),
  reason: z.string().min(1),
  action: z.string().min(1),
});

export const learningPathSchema = z
  .array(
    z.object({
      phase: z.string().min(1),
      weeks: z.number().min(1).max(24),
      objectives: z.array(z.string().min(1)).min(1),
      difficulty: z.string().optional(),
    })
  )
  .min(1)
  .max(10);

type CompetencySpec = {
  skill: string;
  aliases?: string[];
  requiredBase: number;
  order: number;
  reason: string;
  action: string;
};

const ROLE_COMPETENCIES: Record<string, CompetencySpec[]> = {
  'ai engineer': [
    {
      skill: 'Python',
      requiredBase: 4,
      order: 1,
      reason: 'Primary language for ML pipelines, data tooling, and API backends.',
      action: 'Use async Python, typing, and pytest in your AI services.',
    },
    {
      skill: 'Machine Learning',
      aliases: ['scikit-learn', 'pytorch', 'tensorflow', 'deep learning'],
      requiredBase: 4,
      order: 2,
      reason: 'Core modeling, evaluation, and training fundamentals.',
      action: 'Train, regularize, and benchmark supervised and neural models.',
    },
    {
      skill: 'Transformers',
      aliases: ['hugging face', 'attention', 'nlp'],
      requiredBase: 4,
      order: 3,
      reason: 'Foundational architecture behind modern LLMs and embeddings.',
      action: 'Implement scaled dot-product attention and fine-tune a Hugging Face model.',
    },
    {
      skill: 'RAG',
      aliases: ['langchain', 'vector', 'retrieval'],
      requiredBase: 4,
      order: 4,
      reason: 'Key pattern for grounding LLM responses in domain documents.',
      action: 'Build hybrid chunking + retrieval pipelines with citation verification.',
    },
    {
      skill: 'LLM Evaluation',
      aliases: ['evaluation', 'evals'],
      requiredBase: 4,
      order: 5,
      reason: 'Required to measure retrieval Recall@k, faithfulness, and regressions.',
      action: 'Build a golden-set evaluation suite with automated metrics.',
    },
    {
      skill: 'MLOps',
      aliases: ['docker', 'kubernetes', 'ci/cd', 'monitoring'],
      requiredBase: 4,
      order: 6,
      reason: 'Essential for containerizing, deploying, and monitoring production models.',
      action: 'Containerize an inference API with Docker and add latency/error tracking.',
    },
  ],
  'full-stack developer': [
    {
      skill: 'TypeScript',
      aliases: ['javascript'],
      requiredBase: 4,
      order: 1,
      reason: 'Type safety across shared frontend and backend interfaces.',
      action: 'Enforce strict TypeScript schemas and shared API contracts.',
    },
    {
      skill: 'React',
      aliases: ['next.js', 'frontend'],
      requiredBase: 4,
      order: 2,
      reason: 'Modern component architecture, state management, and accessibility.',
      action: 'Build modular accessible React views with async error/loading states.',
    },
    {
      skill: 'Node.js',
      aliases: ['express', 'rest api', 'fastapi'],
      requiredBase: 4,
      order: 3,
      reason: 'Backend API design, validation, auth, and error handling.',
      action: 'Design validated REST APIs with rate limiting and integration tests.',
    },
    {
      skill: 'PostgreSQL',
      aliases: ['sql', 'mongodb', 'database'],
      requiredBase: 4,
      order: 4,
      reason: 'Relational data modeling, indexing, and safe parameterized queries.',
      action: 'Write normalized schemas, migrations, and indexed queries.',
    },
    {
      skill: 'Docker',
      aliases: ['ci/cd', 'aws', 'cloud'],
      requiredBase: 3,
      order: 5,
      reason: 'Reproducible builds, CI testing, and production deployment.',
      action: 'Add multi-stage Dockerfiles and automated CI build/test checks.',
    },
  ],
  'data scientist': [
    {
      skill: 'Python',
      aliases: ['pandas', 'numpy'],
      requiredBase: 4,
      order: 1,
      reason: 'Core analytical and statistical programming environment.',
      action: 'Practice vectorized transformations with Pandas and NumPy.',
    },
    {
      skill: 'SQL',
      aliases: ['postgresql'],
      requiredBase: 4,
      order: 2,
      reason: 'Essential for querying analytical datasets and feature tables.',
      action: 'Master window functions, CTEs, and query optimization.',
    },
    {
      skill: 'Machine Learning',
      aliases: ['scikit-learn', 'deep learning'],
      requiredBase: 4,
      order: 3,
      reason: 'Predictive modeling, cross-validation, and feature engineering.',
      action: 'Build end-to-end tabular ML pipelines with strict leak-free validation.',
    },
    {
      skill: 'Experimentation & Statistics',
      aliases: ['a/b testing', 'statistics'],
      requiredBase: 4,
      order: 4,
      reason: 'Required for hypothesis testing and causal business decisions.',
      action: 'Design power calculations and interpret confidence intervals.',
    },
  ],
};

function getTargetCompetencies(profile: Profile): CompetencySpec[] {
  const roleKey = profile.target_role.trim().toLowerCase();
  const matchedKey = Object.keys(ROLE_COMPETENCIES).find(
    (k) => roleKey.includes(k) || k.includes(roleKey)
  );
  const base = matchedKey
    ? [...ROLE_COMPETENCIES[matchedKey]]
    : [
        {
          skill: 'Data Structures & Algorithms',
          aliases: ['algorithms', 'data structures'],
          requiredBase: 4,
          order: 1,
          reason: 'Core problem-solving foundation for technical engineering roles.',
          action: 'Practice arrays, trees, graphs, and complexity analysis.',
        },
        {
          skill: 'System Design',
          aliases: ['rest api', 'postgresql', 'docker'],
          requiredBase: 4,
          order: 2,
          reason: 'Required to architect reliable, scalable software services.',
          action: 'Design APIs, caching, databases, and observability flows.',
        },
        {
          skill: 'Testing & CI/CD',
          aliases: ['git', 'ci/cd'],
          requiredBase: 4,
          order: 3,
          reason: 'Ensures code quality and safe production releases.',
          action: 'Write automated unit/integration tests and CI pipelines.',
        },
      ];

  const existingLower = new Set(base.map((c) => c.skill.toLowerCase()));
  let order = base.length + 1;
  for (const area of profile.areas_to_improve || []) {
    const clean = area.trim();
    if (clean && !existingLower.has(clean.toLowerCase())) {
      existingLower.add(clean.toLowerCase());
      base.push({
        skill: clean,
        requiredBase: 4,
        order: order++,
        reason: `Explicitly targeted improvement area for ${profile.target_role}.`,
        action: `Complete focused study blocks and hands-on practice for ${clean}.`,
      });
    }
  }
  return base;
}

export function computeDeterministicGaps(params: {
  profile: Profile;
  evidence?: DocumentAnalysis;
  tasks?: LearningTask[];
  attempts?: PracticeAttempt[];
}): SkillGap[] {
  const { profile, evidence, tasks = [], attempts = [] } = params;
  const profileSkills = new Set(profile.skills.map((s) => s.toLowerCase()));
  const docSkills = new Set(
    (evidence?.technicalSkills || []).map((s) => s.toLowerCase())
  );

  const expModifier = /senior|advanced/i.test(profile.experience_level)
    ? 1
    : /beginner|entry/i.test(profile.experience_level)
      ? -1
      : 0;

  const competencies = getTargetCompetencies(profile);

  return competencies.map((comp) => {
    const names = [comp.skill, ...(comp.aliases || [])].map((n) =>
      n.toLowerCase()
    );
    const inProfile = names.some((n) => profileSkills.has(n));
    const inDoc = names.some((n) => docSkills.has(n));
    const completedTasksCount = tasks.filter(
      (t) =>
        t.status === 'completed' &&
        names.some((n) => t.skill.toLowerCase().includes(n))
    ).length;

    const skillAttempts = attempts.filter((a) =>
      names.some((n) => a.skill.toLowerCase().includes(n))
    );
    const avgScore = skillAttempts.length
      ? skillAttempts.reduce((sum, a) => sum + a.score, 0) /
        skillAttempts.length
      : null;

    let score = 1;
    if (inProfile) score += 2;
    if (inDoc) score += 1;
    if (completedTasksCount > 0) score += Math.min(1, completedTasksCount * 0.5);
    if (avgScore !== null) {
      if (avgScore >= 80) score += 0.5;
      else if (avgScore < 60) score -= 0.5;
    }

    const currentLevel = Math.max(1, Math.min(5, Math.round(score)));
    const requiredLevel = Math.max(
      3,
      Math.min(5, comp.requiredBase + expModifier)
    );
    const diff = requiredLevel - currentLevel;

    let status = 'Missing';
    let priority: 'High' | 'Medium' | 'Low' = 'High';
    if (diff <= 0) {
      status = 'Mastered';
      priority = 'Low';
    } else if (diff === 1 && (inProfile || inDoc || completedTasksCount > 0)) {
      status = 'In Progress';
      priority = 'Medium';
    } else if (currentLevel >= 2) {
      status = 'Weak';
      priority = diff >= 2 ? 'High' : 'Medium';
    }

    const evidenceNotes: string[] = [];
    if (inProfile) evidenceNotes.push('listed in profile');
    if (inDoc) evidenceNotes.push('verified in uploaded document');
    if (completedTasksCount > 0)
      evidenceNotes.push(`${completedTasksCount} completed task(s)`);
    if (avgScore !== null)
      evidenceNotes.push(`${Math.round(avgScore)}% practice avg`);

    const evidenceSummary =
      evidenceNotes.length > 0
        ? `Evidence: ${evidenceNotes.join(', ')}.`
        : 'No verified evidence yet.';

    return {
      skill: comp.skill,
      currentLevel,
      requiredLevel,
      status,
      priority,
      reason: `${comp.reason} (${evidenceSummary})`,
      action:
        status === 'Mastered'
          ? `Apply ${comp.skill} in capstone projects rather than repeating fundamentals.`
          : comp.action,
    };
  });
}

export function computeDeterministicPath(
  profile: Profile,
  gaps: SkillGap[]
): LearningPathPhase[] {
  const speedFactor = profile.study_minutes >= 120 ? 1 : 1.4;
  const unmastered = gaps.filter((g) => g.status !== 'Mastered');
  const high = unmastered.filter((g) => g.priority === 'High');
  const medium = unmastered.filter((g) => g.priority === 'Medium');

  const phases: LearningPathPhase[] = [];

  if (high.length > 0) {
    phases.push({
      phase: `Core Gap Foundations (${profile.target_role})`,
      weeks: Math.max(1, Math.round(2 * speedFactor)),
      difficulty: 'Intermediate',
      objectives: high.slice(0, 2).map((g) => `${g.skill}: ${g.action}`),
    });
  }

  if (high.length > 2 || medium.length > 0) {
    const midTargets = [...high.slice(2), ...medium];
    phases.push({
      phase: 'Applied Practice & Integration',
      weeks: Math.max(1, Math.round(2 * speedFactor)),
      difficulty: 'Intermediate',
      objectives: midTargets
        .slice(0, 3)
        .map((g) => `${g.skill}: ${g.action}`),
    });
  }

  phases.push({
    phase: 'Evaluation, Deployment & Production Readiness',
    weeks: Math.max(1, Math.round(2 * speedFactor)),
    difficulty: 'Advanced',
    objectives: [
      `Automated testing & validation for ${profile.target_role} workflows`,
      'Containerization, logging, and reliability checks',
    ],
  });

  phases.push({
    phase: 'Capstone Portfolio & Interview Prep',
    weeks: Math.max(1, Math.round(2 * speedFactor)),
    difficulty: 'Advanced',
    objectives: [
      `Build a ${profile.learning_style.toLowerCase()} capstone closing your top gaps`,
      `Mock technical & system design drills for ${profile.target_role}`,
    ],
  });

  return phases;
}

export function buildTasksFromGaps(gaps: SkillGap[]): LearningTask[] {
  const actionable = gaps
    .filter((g) => g.status !== 'Mastered')
    .sort((a, b) => (a.priority === 'High' ? -1 : b.priority === 'High' ? 1 : 0));

  const tasks: LearningTask[] = actionable.slice(0, 4).map((g) => ({
    id: id(),
    title:
      g.priority === 'High'
        ? `Deep-dive lab: ${g.skill}`
        : `Applied practice: ${g.skill}`,
    skill: g.skill,
    minutes: g.priority === 'High' ? 45 : 35,
    status: 'todo',
    difficulty: g.requiredLevel >= 4 ? 'Intermediate' : 'Foundational',
  }));

  return tasks.length > 0
    ? tasks
    : [
        {
          id: id(),
          title: 'Build & benchmark capstone prototype',
          skill: gaps[0]?.skill || 'System Design',
          minutes: 60,
          status: 'todo',
          difficulty: 'Advanced',
        },
      ];
}

export async function analyzeGaps(
  profile: Profile,
  evidence?: DocumentAnalysis,
  tasks: LearningTask[] = [],
  attempts: PracticeAttempt[] = []
): Promise<AiResult<SkillGap[]>> {
  return aiJson({
    systemPrompt:
      'You are an engineering competency assessor. Evaluate skill gaps objectively using only the provided learner profile, document evidence, completed tasks, and practice attempts.',
    userPrompt: `Learner Profile: ${JSON.stringify(profile)}\nDocument Evidence: ${JSON.stringify(evidence || {})}\nCompleted Tasks: ${JSON.stringify(tasks.filter((t) => t.status === 'completed'))}\nPractice Attempts: ${JSON.stringify(attempts)}\nReturn array of {skill,currentLevel (0-5),requiredLevel (1-5),status (Mastered|In Progress|Weak|Missing),priority (High|Medium|Low),reason,action}.`,
    schema: z.array(skillGapSchema).min(1).max(20),
    fallbackFactory: () =>
      computeDeterministicGaps({ profile, evidence, tasks, attempts }),
  });
}

export async function generatePath(
  profile: Profile,
  gaps: SkillGap[]
): Promise<AiResult<LearningPathPhase[]>> {
  return aiJson({
    systemPrompt:
      'You are a curriculum architect. Create a dependency-ordered, realistic learning path that skips already-mastered topics and fits the learner study_minutes/day.',
    userPrompt: `Learner: ${JSON.stringify(profile)}\nSkill Gaps: ${JSON.stringify(gaps)}\nReturn array of {phase,weeks,difficulty,objectives:string[]}.`,
    schema: learningPathSchema,
    fallbackFactory: () => computeDeterministicPath(profile, gaps),
  });
}

export function buildWeeklyPlan(
  profile: Profile,
  gaps: SkillGap[]
): WeeklyPlanItem[] {
  const activeGaps = gaps.filter((g) => g.status !== 'Mastered');
  const high = activeGaps.filter((x) => x.priority === 'High');
  const medium = activeGaps.filter((x) => x.priority === 'Medium');
  const dailyCap = Math.max(15, profile.study_minutes || 60);
  const days = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  return days.map((day, i) => {
    if (i < 2) {
      const target = high[i] || high[0] || activeGaps[0];
      return {
        day,
        title: target
          ? `${target.skill}: core concepts & notes`
          : 'Core technical foundations',
        minutes: Math.min(dailyCap, 60),
        type: 'Learning',
      };
    }
    if (i === 2 || i === 3) {
      const target = medium[i - 2] || high[0] || activeGaps[0];
      return {
        day,
        title: target
          ? `${target.skill}: guided hands-on lab`
          : 'Hands-on implementation',
        minutes: Math.min(dailyCap, 60),
        type: 'Practice',
      };
    }
    if (i === 4) {
      return {
        day,
        title: `${profile.target_role} ${profile.learning_style.toLowerCase()} sprint`,
        minutes: Math.min(dailyCap, 90),
        type: 'Project',
      };
    }
    if (i === 5) {
      return {
        day,
        title: 'Portfolio build & code review',
        minutes: Math.min(dailyCap, 120),
        type: 'Project',
      };
    }
    return {
      day,
      title: 'Weekly revision & Practice Lab assessment',
      minutes: Math.min(dailyCap, 45),
      type: 'Assessment',
    };
  });
}

export async function generateChatResponse(params: {
  profile: Profile;
  history: ChatMessage[];
  message: string;
  state: {
    nextAction: string;
    gaps: SkillGap[];
    progress: Record<string, unknown>;
    struggleSkills: string[];
    learningPathPhases: string[];
    documentSkills: string[];
  };
}) {
  return aiChatCompletion({
    profile: params.profile,
    history: params.history,
    message: params.message,
    context: params.state,
  });
}
