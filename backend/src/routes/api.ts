import { Router } from 'express';
import type { Request } from 'express';
import multer from 'multer';
import { z } from 'zod';
import {
  id,
  demoProfile,
  createDemoTasks,
  type Profile,
  type ChatMessage,
  type PracticeQuestion,
  type ProjectIdea,
  type SkillGap,
  type UserState,
  type WeeklyPlanItem,
} from '../store.js';
import { checkDbHealth } from '../db.js';
import { extract } from '../services/parser.js';
import {
  analyzeGaps,
  generatePath,
  generateChatResponse,
} from '../services/planner.js';
import { ai, fallback } from '../services/ai.js';
import {
  PersistenceError,
  persistenceMode,
  persistenceModeError,
  repository,
} from '../services/repository.js';
import { AuthenticationError, verifySupabaseAccessToken } from '../auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const getUserId = (req: Request): string => {
  if (!req.userId) {
    throw new AuthenticationError(401, 'Authentication is required');
  }
  return req.userId;
};

async function getUserState(userId: string): Promise<UserState> {
  const state = await repository.getState(userId);
  if (
    persistenceMode !== 'memory' ||
    userId !== 'demo-user' ||
    state.profile
  ) {
    return state;
  }

  state.profile = { ...demoProfile };
  state.gaps = [...fallback.gaps];
  state.path = [...fallback.path];
  state.tasks = createDemoTasks();
  state.plan = buildWeeklyPlan(state.profile, state.gaps);
  await repository.saveProfile(userId, state.profile);
  await repository.saveGaps(userId, state.gaps);
  await repository.savePath(userId, state.path);
  await repository.saveTasks(userId, state.tasks);
  await repository.savePlan(userId, state.plan);
  return state;
}

function getProfileOrError(state: UserState): Profile {
  if (!state.profile) {
    const err = new Error('Profile not found. Create a profile first.') as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }
  return state.profile;
}

function buildWeeklyPlan(
  profile: Profile,
  gaps: typeof fallback.gaps
): WeeklyPlanItem[] {
  const high = gaps.filter((x: SkillGap) => x.priority === 'High');
  const medium = gaps.filter((x: SkillGap) => x.priority === 'Medium');
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

function getStruggleSkills(state: UserState): string[] {
  const attempts = state.attempts;
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

function computeProgressSummary(state: UserState) {
  const tasks = state.tasks;
  const attempts = state.attempts;
  const gaps = state.gaps;
  const completedTasks = tasks.filter((task) => task.status === 'completed');
  const progress = {
    completed: completedTasks.length,
    hours: Number(
      completedTasks
        .reduce((sum, task) => sum + (task.minutes || 0) / 60, 0)
        .toFixed(2)
    ),
  };
  const struggleSkills = getStruggleSkills(state);

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

router.get('/health', async (_req, res) => {
  const database =
    persistenceMode !== 'memory' && persistenceMode !== 'unconfigured'
      ? await checkDbHealth()
      : { configured: false, connected: false };
  res.json({
    ok: true,
    mode: process.env.LLM_API_KEY?.trim() ? 'ai' : 'demo',
    persistence: persistenceMode,
    database: database.connected,
    databaseConfigured: database.configured,
  });
});

router.post('/auth/demo', async (_req, res) => {
  if (
    persistenceMode !== 'memory' ||
    process.env.DEMO_MODE?.trim().toLowerCase() !== 'true'
  ) {
    return res.status(403).json({
      error: 'Demo access is disabled; sign in with an authenticated account.',
    });
  }
  const state = await getUserState('demo-user');
  res.json({
    userId: 'demo-user',
    profile: state.profile,
  });
});

router.use(async (req, _res, next) => {
  try {
    if (
      persistenceMode === 'memory' &&
      process.env.DEMO_MODE?.trim().toLowerCase() === 'true'
    ) {
      req.userId = 'demo-user';
      return next();
    }
    if (persistenceMode !== 'postgres') {
      throw new PersistenceError(persistenceModeError || undefined);
    }
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match) {
      throw new AuthenticationError(401, 'Bearer access token is required');
    }
    req.userId = await verifySupabaseAccessToken(match[1]);
    return next();
  } catch (error) {
    return next(error);
  }
});

router.get('/profile', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  res.json(state.profile);
});

router.post('/profile', async (req, res) => {
  const userId = getUserId(req);
  const data = profileSchema.parse(req.body);
  await repository.saveProfile(userId, data);
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
    fallback.documentAnalysis
  );

  const docRecord = {
    id: id(),
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    text,
    analysis,
    uploadedAt: new Date().toISOString(),
  };

  await repository.saveDocument(userId, docRecord);
  return res.json(docRecord);
});

router.get('/documents', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.document);
});

router.post('/skill-gap/analyze', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const gaps = await analyzeGaps(
    profile,
    state.document?.analysis,
    state.tasks,
    state.attempts
  );
  await repository.saveGaps(userId, gaps);
  res.json(gaps);
});

router.get('/skill-gap', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.gaps);
});

router.post('/learning-path/generate', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const gaps = state.gaps;
  const path = await generatePath(profile, gaps);
  await repository.savePath(userId, path);
  res.json(path);
});

router.get('/learning-path', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.path);
});

router.post('/weekly-plan/generate', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const gaps = state.gaps;
  const plan = buildWeeklyPlan(profile, gaps);
  await repository.savePlan(userId, plan);
  res.json(plan);
});

router.get('/weekly-plan', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.plan);
});

router.get('/tasks', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.tasks);
});

router.post('/tasks/seed', async (req, res) => {
  const userId = getUserId(req);
  const tasks = createDemoTasks();
  await repository.saveTasks(userId, tasks);
  res.json(tasks);
});

router.patch('/tasks/:id', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const tasks = state.tasks;
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

  await repository.saveTasks(userId, tasks);
  return res.json(task);
});

router.get('/practice', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.practice);
});

router.post('/practice/generate', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const result = await ai<PracticeQuestion[]>(
    `Generate 4 practice questions for ${profile.target_role}. Profile ${JSON.stringify(profile)} gaps ${JSON.stringify(state.gaps)}`,
    'Schema: array of {id,question,type,options:string[],answer,explanation,skill,difficulty}.',
    fallback.practice
  );
  const questions = Array.isArray(result) ? result : [result];
  await repository.savePractice(userId, questions);
  res.json(questions);
});

router.post('/practice/:id/submit', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  if (!state.practice.some((question) => question.id === req.params.id)) {
    return res.status(404).json({ error: 'Practice question not found' });
  }

  const body = z
    .object({
      skill: z.string().trim().min(1).default('General'),
      score: z.coerce.number().min(0).max(100),
    })
    .parse(req.body);

  const attempt = {
    id: id(),
    questionId: req.params.id,
    skill: body.skill,
    score: body.score,
    createdAt: new Date().toISOString(),
  };
  state.attempts.push(attempt);

  const struggles = getStruggleSkills(state);
  const struggleDetected = body.score < 70 || struggles.includes(body.skill);
  let intervention: string | null = null;

  if (struggleDetected) {
    const tasks = state.tasks;
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
    }
    intervention = `Added "${remedialTitle}" to your active tasks to close the prerequisite gap.`;
  }

  await repository.savePracticeResult(userId, attempt, state.tasks);
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

router.get('/projects', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.projects);
});

router.post('/projects/generate', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const result = await ai<ProjectIdea[]>(
    `Generate 3 portfolio projects for ${profile.target_role} that close these gaps: ${JSON.stringify(state.gaps)}`,
    'Schema: array of {title,problem,difficulty,duration,skills:string[],techStack:string[],features:string[],outcomes:string[],stretchGoals:string[]}.',
    fallback.projects
  );
  const projects = Array.isArray(result) ? result : [result];
  await repository.saveProjects(userId, projects);
  res.json(projects);
});

router.get('/progress', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(computeProgressSummary(state));
});

router.get('/reports', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.report);
});

router.post('/reports/generate', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const summary = computeProgressSummary(state);
  const gaps = state.gaps;
  const tasks = state.tasks;
  const projects = state.projects;

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

  await repository.saveReport(userId, report);
  res.json(report);
});

router.get('/chat', async (req, res) => {
  const state = await getUserState(getUserId(req));
  res.json(state.messages);
});

router.post('/chat', async (req, res) => {
  const userId = getUserId(req);
  const state = await getUserState(userId);
  const profile = getProfileOrError(state);
  const { message } = z
    .object({ message: z.string().trim().min(1, 'Message is required') })
    .parse(req.body);

  const tasks = state.tasks;
  const nextTask = tasks.find((t) => t.status !== 'completed');
  const progress = computeProgressSummary(state);
  const gaps = state.gaps;
  const history = state.messages;

  const out = await generateChatResponse(
    {
      profile,
      history,
      message,
      state: {
        nextAction: nextTask?.title || 'Implement Attention Mechanism',
        gaps,
        progress,
        struggleSkills: progress.struggleSkills,
        learningPathPhases: state.path.map(
          (phase) => phase.phase
        ),
        documentSkills: state.document?.analysis.technicalSkills || [],
      },
    }
  );

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
  await repository.appendMessages(userId, [userMsg, aiMsg]);
  history.push(userMsg, aiMsg);

  res.json({ ...out, messages: history });
});

export default router;
