import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { newDb } from 'pg-mem';
import type { Pool } from 'pg';
import { AuthenticationError, verifySupabaseAccessToken } from '../src/auth.js';
import {
  MemoryRepository,
  PersistenceError,
  PostgresRepository,
} from '../src/services/repository.js';
import type { Profile } from '../src/store.js';

const profile = (name: string): Profile => ({
  name,
  education_status: 'Computer Science student',
  experience_level: 'Intermediate',
  target_role: 'AI Engineer',
  career_goal: 'Build reliable AI systems',
  study_minutes: 90,
  learning_style: 'Project-based',
  areas_to_improve: ['MLOps'],
  skills: ['Python'],
});

function createTestRepository() {
  const db = newDb();
  db.public.none(`
    create table profiles (
      id serial primary key, user_id text unique, name text not null,
      education_status text, experience_level text, target_role text,
      career_goal text, study_minutes integer, learning_style text,
      areas_to_improve text[], skills text[], updated_at timestamptz
    );
    create table documents (
      id text primary key, user_id text, filename text, mime_type text,
      extracted_text text, analysis jsonb, created_at timestamptz default now()
    );
    create table skill_gaps (
      id serial primary key, user_id text, sort_order integer, skill text, current_level integer,
      required_level integer, status text, priority text, reason text,
      action text, created_at timestamptz default now()
    );
    create table learning_paths (
      id serial primary key, user_id text, path jsonb,
      created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table weekly_plans (
      id serial primary key, user_id text, week_start date, plan jsonb,
      created_at timestamptz default now()
    );
    create table learning_tasks (
      id text primary key, user_id text, sort_order integer, title text, skill text, minutes integer,
      status text, difficulty text, notes text, remedial boolean,
      created_at timestamptz default now()
    );
    create table progress_records (
      id serial primary key, user_id text, metric text, value numeric, metadata jsonb,
      created_at timestamptz default now()
    );
    create table practice_attempts (
      id text primary key, user_id text, question_id text, skill text,
      score numeric, created_at timestamptz default now()
    );
    create table practice_questions (
      user_id text primary key, questions jsonb, updated_at timestamptz default now()
    );
    create table projects (
      id serial primary key, user_id text, projects jsonb,
      created_at timestamptz default now()
    );
    create table reports (
      id serial primary key, user_id text, report jsonb,
      created_at timestamptz default now()
    );
    create table chat_messages (
      id text primary key, user_id text, role text, content text,
      metadata jsonb, created_at timestamptz default now()
    );
  `);
  const PgMemPool = db.adapters.createPg().Pool;
  const pool = new PgMemPool();
  return { pool, repository: new PostgresRepository(pool as Pool) };
}

let pgMem: ReturnType<typeof createTestRepository>;
before(() => {
  pgMem = createTestRepository();
});
after(async () => {
  await pgMem.pool.end();
});

test('PostgreSQL repository creates, reads, and updates a profile', async () => {
  const userId = 'user-create-update';
  const initial = profile('First Name');
  await pgMem.repository.saveProfile(userId, initial);
  assert.deepEqual((await pgMem.repository.getState(userId)).profile, initial);

  const updated = { ...initial, name: 'Updated Name', study_minutes: 120 };
  await pgMem.repository.saveProfile(userId, updated);
  assert.deepEqual((await pgMem.repository.getState(userId)).profile, updated);
});

test('PostgreSQL repository persists ordered user learning state and activity', async () => {
  const userId = 'user-persisted-learning-state';
  const document = {
    id: 'document-1',
    filename: 'resume.txt',
    mimeType: 'text/plain',
    text: 'Python experience',
    analysis: {
      technicalSkills: ['Python'],
      softSkills: [],
      projects: [],
      experience: 'Student',
      certifications: [],
      education: 'Computer Science',
    },
    uploadedAt: '2026-02-01T00:00:00.000Z',
  };
  const gaps = [
    {
      skill: 'Python',
      currentLevel: 2,
      requiredLevel: 4,
      status: 'In Progress',
      priority: 'High',
      reason: 'Needs practice',
      action: 'Complete exercises',
    },
    {
      skill: 'MLOps',
      currentLevel: 1,
      requiredLevel: 3,
      status: 'Not Started',
      priority: 'Medium',
      reason: 'New skill',
      action: 'Build a deployment',
    },
  ];
  const tasks = [
    {
      id: 'task-first',
      title: 'First task',
      skill: 'Python',
      minutes: 30,
      status: 'todo' as const,
      difficulty: 'Beginner',
    },
    {
      id: 'task-second',
      title: 'Second task',
      skill: 'MLOps',
      minutes: 45,
      status: 'in_progress' as const,
      difficulty: 'Intermediate',
    },
  ];
  const attempt = {
    id: 'attempt-1',
    questionId: 'question-1',
    skill: 'Python',
    score: 85,
    createdAt: '2026-02-01T00:05:00.000Z',
  };
  await pgMem.repository.saveDocument(userId, document);
  await pgMem.repository.saveGaps(userId, gaps);
  await pgMem.repository.savePath(userId, [
    { phase: 'Foundations', weeks: 2, objectives: ['Review Python'] },
  ]);
  await pgMem.repository.savePlan(userId, [
    { day: 'Monday', title: 'Practice', minutes: 30, type: 'Practice' },
  ]);
  await pgMem.repository.saveTasks(userId, tasks);
  await pgMem.repository.savePractice(userId, [
    {
      id: 'question-1',
      question: 'What is Python?',
      type: 'multiple-choice',
      options: ['A language'],
      answer: 'A language',
      explanation: 'It is a programming language.',
      skill: 'Python',
      difficulty: 'Beginner',
    },
  ]);
  await pgMem.repository.savePracticeResult(userId, attempt, tasks);
  await pgMem.repository.saveProjects(userId, [
    {
      title: 'Learning project',
      problem: 'Practice',
      difficulty: 'Beginner',
      duration: 'One week',
      skills: ['Python'],
      techStack: ['Python'],
      features: ['CLI'],
      outcomes: ['A working tool'],
      stretchGoals: [],
    },
  ]);
  await pgMem.repository.saveReport(userId, {
    generatedAt: '2026-02-01T00:10:00.000Z',
    skillsAcquired: ['Python'],
    inProgress: ['Python'],
    remainingGaps: ['MLOps'],
    strongAreas: [],
    weakAreas: ['MLOps'],
    learningConsistency: '0/2 tasks completed',
    achievements: [],
    nextSteps: ['Complete first task'],
    projects: ['Learning project'],
  });
  await pgMem.repository.appendMessages(userId, [
    {
      id: 'message-1',
      role: 'ai',
      content: 'Keep practicing.',
      actions: ['Review'],
      references: ['Python'],
      source: 'demo',
      model: 'test-model',
      createdAt: '2026-02-01T00:15:00.000Z',
    },
  ]);

  const state = await pgMem.repository.getState(userId);
  assert.deepEqual(state.document, document);
  assert.deepEqual(state.gaps, gaps);
  assert.deepEqual(state.path, [
    { phase: 'Foundations', weeks: 2, objectives: ['Review Python'] },
  ]);
  assert.deepEqual(state.plan, [
    { day: 'Monday', title: 'Practice', minutes: 30, type: 'Practice' },
  ]);
  assert.deepEqual(state.tasks, tasks);
  assert.equal(state.practice[0].id, 'question-1');
  assert.deepEqual(state.attempts, [attempt]);
  assert.equal(state.projects[0].title, 'Learning project');
  assert.deepEqual(state.report?.projects, ['Learning project']);
  assert.equal(state.messages[0].content, 'Keep practicing.');
  assert.deepEqual(state.messages[0].actions, ['Review']);
});

test('PostgreSQL repository scopes reads and deletion to one user', async () => {
  const userA = 'user-isolation-a';
  const userB = 'user-isolation-b';
  await pgMem.repository.saveProfile(userA, profile('Learner A'));
  await pgMem.repository.saveProfile(userB, profile('Learner B'));

  assert.equal((await pgMem.repository.getState(userA)).profile?.name, 'Learner A');
  assert.equal((await pgMem.repository.getState(userB)).profile?.name, 'Learner B');

  await pgMem.repository.deleteUserData(userA);
  assert.equal((await pgMem.repository.getState(userA)).profile, null);
  assert.equal((await pgMem.repository.getState(userB)).profile?.name, 'Learner B');
});

test('a new repository instance reads data written by the previous instance', async () => {
  const userId = 'user-repository-restart';
  await pgMem.repository.saveProfile(userId, profile('Restart Learner'));

  const secondInstance = new PostgresRepository(pgMem.pool as Pool);
  assert.equal(
    (await secondInstance.getState(userId)).profile?.name,
    'Restart Learner'
  );
});

test('memory demo repository isolates user keys and supports deletion', async () => {
  const repository = new MemoryRepository();
  await repository.saveProfile('demo-a', profile('Demo A'));
  await repository.saveProfile('demo-b', profile('Demo B'));
  await repository.deleteUserData('demo-a');

  assert.equal((await repository.getState('demo-a')).profile, null);
  assert.equal((await repository.getState('demo-b')).profile?.name, 'Demo B');
});

test('database failures reject instead of switching to memory storage', async () => {
  const { pool, repository } = createTestRepository();
  await pool.query('drop table profiles');
  await assert.rejects(repository.getState('failure-user'), PersistenceError);
  await pool.end();
});

test('Supabase access-token validation derives the owner ID from verified user data', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousAnonKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://auth.example.test/';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  try {
    const userId = await verifySupabaseAccessToken(
      'test-access-token',
      async (input, init) => {
        assert.equal(input, 'https://auth.example.test/auth/v1/user');
        assert.equal(
          new Headers(init?.headers).get('Authorization'),
          'Bearer test-access-token'
        );
        return new Response(JSON.stringify({ id: 'verified-user-id' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    );
    assert.equal(userId, 'verified-user-id');

    await assert.rejects(
      verifySupabaseAccessToken(
        'expired-token',
        async () => new Response('{}', { status: 401 })
      ),
      AuthenticationError
    );
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previousAnonKey;
  }
});
