import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  store,
  id,
  demoProfile,
  createDemoTasks,
  recalcProgress,
  type Profile,
  type ChatMessage,
  type PracticeQuestion,
  type ProjectIdea,
  type WeeklyPlanItem,
} from '../store.js';
import { pool } from '../db.js';
import { extract } from '../services/parser.js';
import {
  analyzeGaps,
  generatePath,
  generateChatResponse,
} from '../services/planner.js';
import { ai, fallback } from '../services/ai.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const getUserId = (req: { headers: Record<string, unknown> }): string => {
  const raw = req.headers['x-user-id'];
  return typeof raw === 'string' && raw.trim() ? raw.trim() : 'demo-user';
};

function ensureDemoSeeded(userId: string): void {
  if (userId !== 'demo-user') return;

  if (!store.profiles.has(userId)) {
    store.profiles.set(userId, { ...demoProfile });
  }
  if (!store.gaps.has(userId)) {
    store.gaps.set(userId, [...fallback.gaps]);
  }
  if (!store.paths.has(userId)) {
    store.paths.set(userId, [...fallback.path]);
  }
  if (!store.tasks.has(userId)) {
    store.tasks.set(userId, createDemoTasks());
    recalcProgress(userId);
  }
  if (!store.plans.has(userId)) {
    store.plans.set(
      userId,
      buildWeeklyPlan(
        store.profiles.get(userId)!,
        store.gaps.get(userId) || fallback.gaps
      )
    );
  }
}

function getProfileOrError(userId: string): Profile {
  ensureDemoSeeded(userId);
  const profile = store.profiles.get(userId);
  if (!profile) {
    const err = new Error('Profile not found. Create a profile first.') as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }
  return profile;
}

function buildWeeklyPlan(
  profile: Profile,
  gaps: typeof fallback.gaps
): WeeklyPlanItem[] {
  const high = gaps.filter((x) => x.priority === 'High');
  const medium = gaps.filter((x) => x.priority === 'Medium');
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
      const target = high[i] || high[0];
      return {
        day,
        title: target ? `${target.skill}: deep-dive & notes` : 'Core AI foundations',
        minutes: Math.min(profile.study_minutes, 60),
        type: 'Learning',
      };
    }
    if (i === 2 || i === 3) {
      const target = medium[i - 2] || high[0] || medium[0];
      return {
        day,
        title: target ? `${target.skill}: guided lab` : 'Hands-on implementation',
        minutes: Math.min(profile.study_minutes, 60),
        type: 'Practice',
      };
    }
    if (i === 4) {
      return {
        day,
        title: `${profile.target_role} mini-project sprint`,
        minutes: Math.min(profile.study_minutes, 90),
        type: 'Project',
      };
    }
    if (i === 5) {
      return {
        day,
        title: 'Portfolio build & code review',
        minutes: Math.min(profile.study_minutes, 120),
        type: 'Project',
      };
    }
    return {
      day,
      title: 'Weekly revision & adaptive assessment',
      minutes: Math.min(profile.study_minutes, 45),
      type: 'Assessment',
    };
  });
}

function getStruggleSkills(userId: string): string[] {
  const attempts = store.attempts.get(userId) || [];
  const bySkill = new Map<string, number[]>();
  for (const attempt of attempts) {
    const list = bySkill.get(attempt.skill) || [];
    list.push(attempt.score);
    bySkill.set(attempt.skill, list);
  }
  const struggles: string[] = [];
  for (const [skill, scores] of bySkill.entries()) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 70 || scores[scores.length - 1] < 60) {
      struggles.push(skill);
    }
  }
  return struggles;
}

function computeProgressSummary(userId: string) {
  ensureDemoSeeded(userId);
  const progress = store.progress.get(userId) || recalcProgress(userId);
  const tasks = store.tasks.get(userId) || [];
  const attempts = store.attempts.get(userId) || [];
  const gaps = store.gaps.get(userId) || fallback.gaps;
  const struggleSkills = getStruggleSkills(userId);

  const practiceScore = attempts.length
    ? Math.round(
        attempts.reduce((sum, item) => sum + item.score, 0) / attempts.length
      )
    : 0;

  const taskRatio = tasks.length ? progress.completed / tasks.length : 0;
  const masteredCount = gaps.filter((g) => g.status === 'Mastered').length;
  const gapClosurePct = gaps.length
    ? Math.round(
        (gaps.reduce(
          (acc, g) => acc + Math.min(1, g.currentLevel / Math.max(1, g.requiredLevel)),
          0
        ) /
          gaps.length) *
          100
      )
    : 0;

  const overall = Math.min(
    100,
    Math.round(taskRatio * 55 + (practiceScore / 100) * 25 + (gapClosurePct / 100) * 20)
  );

  return {
    completed: progress.completed,
    totalTasks: tasks.length,
    hours: progress.hours,
    practiceScore,
    attemptsCount: attempts.length,
    masteredCount,
    gapReduction: gapClosurePct,
    struggleSkills,
    overall,
  };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  education_status: z.string().trim().default(''),
  experience_level: z.string().trim().default('Intermediate'),
  target_role: z.string().trim().min(1, 'Target role is required'),
  career_goal: z.string().trim().default(''),
  study_minutes: z.coerce.number().int().min(15).max(720),
  learning_style: z.string().trim().default('Project-based'),
  areas_to_improve: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
});

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.LLM_API_KEY?.trim() ? 'ai' : 'demo',
    database: Boolean(pool),
  });
});

router.post('/auth/demo', (_req, res) => {
  ensureDemoSeeded('demo-user');
  res.json({
    userId: 'demo-user',
    profile: store.profiles.get('demo-user'),
  });
});

router.get('/profile', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.profiles.get(userId) || null);
});

router.post('/profile', (req, res) => {
  const userId = getUserId(req);
  const data = profileSchema.parse(req.body);
  store.profiles.set(userId, data);
  res.json(data);
});

router.post('/documents/upload', upload.single('file'), async (req, res) => {
  const userId = getUserId(req);
  if (!req.file) {
    return res.status(400).json({ error: 'File required' });
  }

  const text = (await extract(req.file)).trim();
  if (!text) {
    return res
      .status(400)
      .json({ error: 'Could not extract readable text from the uploaded file.' });
  }

  const analysis = await ai(
    `Extract learner evidence from: ${text.slice(0, 12000)}`,
    'Schema: {technicalSkills:string[],softSkills:string[],projects:string[],experience:string,certifications:string[],education:string}.',
    fallback.profile
  );

  const docRecord = {
    id: id(),
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    text,
    analysis,
    uploadedAt: new Date().toISOString(),
  };

  store.documents.set(userId, docRecord);
  return res.json(docRecord);
});

router.get('/documents', (req, res) => {
  res.json(store.documents.get(getUserId(req)) || null);
});

router.post('/skill-gap/analyze', async (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const doc = store.documents.get(userId);
  const gaps = await analyzeGaps(profile, doc?.analysis);
  store.gaps.set(userId, gaps);
  res.json(gaps);
});

router.get('/skill-gap', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.gaps.get(userId) || fallback.gaps);
});

router.post('/learning-path/generate', async (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const gaps = store.gaps.get(userId) || fallback.gaps;
  const path = await generatePath(profile, gaps);
  store.paths.set(userId, path);
  res.json(path);
});

router.get('/learning-path', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.paths.get(userId) || fallback.path);
});

router.post('/weekly-plan/generate', (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const gaps = store.gaps.get(userId) || fallback.gaps;
  const plan = buildWeeklyPlan(profile, gaps);
  store.plans.set(userId, plan);
  res.json(plan);
});

router.get('/weekly-plan', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.plans.get(userId) || []);
});

router.get('/tasks', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.tasks.get(userId) || []);
});

router.post('/tasks/seed', (req, res) => {
  const userId = getUserId(req);
  const tasks = createDemoTasks();
  store.tasks.set(userId, tasks);
  recalcProgress(userId);
  res.json(tasks);
});

router.patch('/tasks/:id', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  const tasks = store.tasks.get(userId) || [];
  const task = tasks.find((x) => x.id === req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  const body = z
    .object({
      status: z.enum(['todo', 'in_progress', 'completed']).optional(),
      notes: z.string().optional(),
    })
    .parse(req.body || {});

  task.status = body.status || 'completed';
  if (body.notes !== undefined) {
    task.notes = body.notes;
  }

  recalcProgress(userId);
  return res.json(task);
});

router.get('/practice', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.practice.get(userId) || []);
});

router.post('/practice/generate', async (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const gaps = store.gaps.get(userId) || fallback.gaps;
  const result = await ai<PracticeQuestion[]>(
    `Generate 4 practice questions for ${profile.target_role}. Profile ${JSON.stringify(profile)} gaps ${JSON.stringify(gaps)}`,
    'Schema: array of {id,question,type,options:string[],answer,explanation,skill,difficulty}.',
    fallback.practice
  );
  const questions = Array.isArray(result) ? result : [result];
  store.practice.set(userId, questions);
  res.json(questions);
});

router.post('/practice/:id/submit', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);

  const body = z
    .object({
      skill: z.string().trim().min(1).default('General'),
      score: z.coerce.number().min(0).max(100),
    })
    .parse(req.body);

  const attempts = store.attempts.get(userId) || [];
  attempts.push({
    id: id(),
    questionId: req.params.id,
    skill: body.skill,
    score: body.score,
    createdAt: new Date().toISOString(),
  });
  store.attempts.set(userId, attempts);

  const struggles = getStruggleSkills(userId);
  const struggleDetected = body.score < 70 || struggles.includes(body.skill);
  let intervention: string | null = null;

  if (struggleDetected) {
    const tasks = store.tasks.get(userId) || [];
    const remedialTitle = `Prerequisite review: ${body.skill}`;
    const alreadyQueued = tasks.some(
      (t) => t.title === remedialTitle && t.status !== 'completed'
    );
    if (!alreadyQueued) {
      tasks.unshift({
        id: id(),
        title: remedialTitle,
        skill: body.skill,
        minutes: 30,
        status: 'todo',
        difficulty: 'Foundational',
        remedial: true,
      });
      store.tasks.set(userId, tasks);
      recalcProgress(userId);
    }
    intervention = `Added "${remedialTitle}" to your active tasks to close the prerequisite gap.`;
  }

  res.json({
    score: body.score,
    struggleDetected,
    intervention,
    feedback:
      body.score >= 80
        ? 'Great mastery — increase difficulty and move forward.'
        : 'Struggle detected — added foundational review and extra practice before advancing.',
  });
});

router.get('/projects', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.projects.get(userId) || []);
});

router.post('/projects/generate', async (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const gaps = store.gaps.get(userId) || fallback.gaps;
  const result = await ai<ProjectIdea[]>(
    `Generate 3 portfolio projects for ${profile.target_role} that close these gaps: ${JSON.stringify(gaps)}`,
    'Schema: array of {title,problem,difficulty,duration,skills:string[],techStack:string[],features:string[],outcomes:string[],stretchGoals:string[]}.',
    fallback.projects
  );
  const projects = Array.isArray(result) ? result : [result];
  store.projects.set(userId, projects);
  res.json(projects);
});

router.get('/progress', (req, res) => {
  const userId = getUserId(req);
  res.json(computeProgressSummary(userId));
});

router.get('/reports', (req, res) => {
  const userId = getUserId(req);
  res.json(store.reports.get(userId) || null);
});

router.post('/reports/generate', (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const summary = computeProgressSummary(userId);
  const gaps = store.gaps.get(userId) || fallback.gaps;
  const tasks = store.tasks.get(userId) || [];
  const projects = store.projects.get(userId) || fallback.projects;

  const nextTask = tasks.find((t) => t.status !== 'completed');
  const report = {
    generatedAt: new Date().toISOString(),
    skillsAcquired: profile.skills,
    inProgress: gaps
      .filter((x) => x.status === 'In Progress')
      .map((x) => x.skill),
    remainingGaps: gaps
      .filter((x) => x.status !== 'Mastered')
      .map((x) => x.skill),
    strongAreas: gaps
      .filter((x) => x.status === 'Mastered' || x.currentLevel >= 4)
      .map((x) => x.skill),
    weakAreas: Array.from(
      new Set([
        ...gaps.filter((x) => x.priority === 'High').map((x) => x.skill),
        ...summary.struggleSkills,
      ])
    ),
    learningConsistency: `${summary.completed}/${summary.totalTasks} tasks completed (${summary.hours.toFixed(1)} hrs logged)`,
    achievements: [
      `Profile configured for ${profile.target_role}`,
      'Skill gaps analyzed against target role',
      `${summary.completed} learning tasks completed`,
      ...(summary.attemptsCount > 0
        ? [`Average practice score: ${summary.practiceScore}%`]
        : []),
    ],
    nextSteps: [
      nextTask
        ? `Complete next priority task: ${nextTask.title}`
        : 'Generate new practice or capstone tasks',
      'Take an adaptive practice assessment to validate gap closure',
    ],
    projects: projects.map((p) => p.title),
  };

  store.reports.set(userId, report);
  res.json(report);
});

router.get('/chat', (req, res) => {
  const userId = getUserId(req);
  ensureDemoSeeded(userId);
  res.json(store.messages.get(userId) || []);
});

router.post('/chat', async (req, res) => {
  const userId = getUserId(req);
  const profile = getProfileOrError(userId);
  const { message } = z
    .object({ message: z.string().trim().min(1, 'Message is required') })
    .parse(req.body);

  const tasks = store.tasks.get(userId) || [];
  const nextTask = tasks.find((t) => t.status !== 'completed');
  const progress = computeProgressSummary(userId);
  const gaps = store.gaps.get(userId) || fallback.gaps;

  const out = await generateChatResponse(
    profile,
    {
      nextAction: nextTask?.title || 'Implement Attention Mechanism',
      gaps,
      progress,
      struggleSkills: progress.struggleSkills,
    },
    message
  );

  const history: ChatMessage[] = store.messages.get(userId) || [];
  const userMsg: ChatMessage = {
    id: id(),
    role: 'user',
    content: message,
    createdAt: new Date().toISOString(),
  };
  const aiMsg: ChatMessage = {
    id: id(),
    role: 'ai',
    content: out.answer,
    actions: out.actions,
    references: out.references,
    createdAt: new Date().toISOString(),
  };
  history.push(userMsg, aiMsg);
  store.messages.set(userId, history);

  res.json({ ...out, messages: history });
});

export default router;
