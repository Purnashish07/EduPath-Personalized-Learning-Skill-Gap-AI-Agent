import { randomUUID } from 'node:crypto';

export type Profile = {
  name: string;
  education_status: string;
  experience_level: string;
  target_role: string;
  career_goal: string;
  study_minutes: number;
  learning_style: string;
  areas_to_improve: string[];
  skills: string[];
};

export type DocumentAnalysis = {
  technicalSkills: string[];
  softSkills: string[];
  projects: string[];
  experience: string;
  certifications: string[];
  education: string;
};

export type DocumentRecord = {
  id: string;
  filename: string;
  mimeType: string;
  text: string;
  analysis: DocumentAnalysis;
  uploadedAt: string;
};

export type SkillGap = {
  skill: string;
  currentLevel: number;
  requiredLevel: number;
  status: string;
  priority: 'High' | 'Medium' | 'Low' | string;
  reason: string;
  action: string;
};

export type LearningPathPhase = {
  phase: string;
  weeks: number;
  objectives: string[];
};

export type WeeklyPlanItem = {
  day: string;
  title: string;
  minutes: number;
  type: string;
};

export type LearningTask = {
  id: string;
  title: string;
  skill: string;
  minutes: number;
  status: 'todo' | 'in_progress' | 'completed';
  difficulty: string;
  notes?: string;
  remedial?: boolean;
};

export type ProgressState = {
  completed: number;
  hours: number;
};

export type PracticeQuestion = {
  id: string;
  question: string;
  type: string;
  options: string[];
  answer: string;
  explanation: string;
  skill: string;
  difficulty: string;
};

export type PracticeAttempt = {
  id: string;
  questionId: string;
  skill: string;
  score: number;
  createdAt: string;
};

export type ProjectIdea = {
  title: string;
  problem: string;
  difficulty: string;
  duration: string;
  skills: string[];
  techStack: string[];
  features: string[];
  outcomes: string[];
  stretchGoals: string[];
};

export type ProgressReport = {
  generatedAt: string;
  skillsAcquired: string[];
  inProgress: string[];
  remainingGaps: string[];
  strongAreas: string[];
  weakAreas: string[];
  learningConsistency: string;
  achievements: string[];
  nextSteps: string[];
  projects: string[];
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'ai';
  content: string;
  actions?: string[];
  references?: string[];
  createdAt: string;
};

export const store = {
  profiles: new Map<string, Profile>(),
  documents: new Map<string, DocumentRecord>(),
  gaps: new Map<string, SkillGap[]>(),
  paths: new Map<string, LearningPathPhase[]>(),
  plans: new Map<string, WeeklyPlanItem[]>(),
  tasks: new Map<string, LearningTask[]>(),
  progress: new Map<string, ProgressState>(),
  practice: new Map<string, PracticeQuestion[]>(),
  attempts: new Map<string, PracticeAttempt[]>(),
  projects: new Map<string, ProjectIdea[]>(),
  reports: new Map<string, ProgressReport>(),
  messages: new Map<string, ChatMessage[]>(),
};

export const id = () => randomUUID();

export const demoProfile: Profile = {
  name: 'Alex Morgan',
  education_status: 'Computer Science student',
  experience_level: 'Intermediate',
  target_role: 'AI Engineer',
  career_goal: 'Become job-ready for an AI Engineer role',
  study_minutes: 120,
  learning_style: 'Project-based',
  areas_to_improve: ['MLOps', 'LLM Evaluation'],
  skills: ['Python', 'Machine Learning', 'RAG', 'Git', 'FastAPI'],
};

export function createDemoTasks(): LearningTask[] {
  return [
    {
      id: id(),
      title: 'Implement Attention Mechanism',
      skill: 'Transformers',
      minutes: 45,
      status: 'todo',
      difficulty: 'Intermediate',
    },
    {
      id: id(),
      title: 'Evaluate a RAG pipeline',
      skill: 'LLM Evaluation',
      minutes: 45,
      status: 'todo',
      difficulty: 'Intermediate',
    },
    {
      id: id(),
      title: 'Containerize an inference API',
      skill: 'MLOps',
      minutes: 60,
      status: 'todo',
      difficulty: 'Advanced',
    },
    {
      id: id(),
      title: 'Build FastAPI streaming endpoint',
      skill: 'Python',
      minutes: 30,
      status: 'completed',
      difficulty: 'Intermediate',
    },
  ];
}

export function recalcProgress(userId: string): ProgressState {
  const tasks = store.tasks.get(userId) || [];
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const hours = completedTasks.reduce((sum, t) => sum + (t.minutes || 0) / 60, 0);
  const state: ProgressState = {
    completed: completedTasks.length,
    hours: Number(hours.toFixed(2)),
  };
  store.progress.set(userId, state);
  return state;
}
