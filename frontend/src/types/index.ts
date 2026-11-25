export interface Profile {
  name: string;
  education_status: string;
  experience_level: string;
  target_role: string;
  career_goal: string;
  study_minutes: number;
  learning_style: string;
  areas_to_improve: string[];
  skills: string[];
}

export interface DocumentAnalysis {
  technicalSkills: string[];
  softSkills: string[];
  projects: string[];
  experience: string;
  certifications: string[];
  education: string;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  mimeType: string;
  text: string;
  analysis: DocumentAnalysis;
  uploadedAt: string;
}

export interface SkillGap {
  skill: string;
  currentLevel: number;
  requiredLevel: number;
  status: string;
  priority: string;
  reason: string;
  action: string;
}

export interface LearningPathPhase {
  phase: string;
  weeks: number;
  objectives: string[];
}

export interface WeeklyPlanItem {
  day: string;
  title: string;
  minutes: number;
  type: string;
}

export interface LearningTask {
  id: string;
  title: string;
  skill: string;
  minutes: number;
  status: 'todo' | 'in_progress' | 'completed';
  difficulty: string;
  notes?: string;
  remedial?: boolean;
}

export interface ProgressSummary {
  completed: number;
  totalTasks: number;
  hours: number;
  practiceScore: number;
  attemptsCount: number;
  masteredCount: number;
  gapReduction: number;
  struggleSkills: string[];
  overall: number;
}

export interface PracticeQuestion {
  id: string;
  question: string;
  type: string;
  options: string[];
  answer: string;
  explanation: string;
  skill: string;
  difficulty: string;
}

export interface PracticeSubmissionResult {
  score: number;
  struggleDetected: boolean;
  intervention: string | null;
  feedback: string;
}

export interface ProjectIdea {
  title: string;
  problem: string;
  difficulty: string;
  duration: string;
  skills: string[];
  techStack: string[];
  features: string[];
  outcomes: string[];
  stretchGoals: string[];
}

export interface ProgressReport {
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
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'ai';
  content: string;
  actions?: string[];
  references?: string[];
  createdAt?: string;
}

export interface AppState {
  profile: Profile | null;
  gaps: SkillGap[];
  path: LearningPathPhase[];
  plan: WeeklyPlanItem[];
  tasks: LearningTask[];
  progress: ProgressSummary;
  practice: PracticeQuestion[];
  projects: ProjectIdea[];
  report: ProgressReport | null;
  messages: ChatMessage[];
  document: DocumentRecord | null;
}
