import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  emptyUserState,
  type ChatMessage,
  type DocumentRecord,
  type LearningPathPhase,
  type LearningTask,
  type PracticeAttempt,
  type PracticeQuestion,
  type Profile,
  type ProgressReport,
  type ProjectIdea,
  type SkillGap,
  type UserState,
  type WeeklyPlanItem,
} from '../store.js';
import { pool } from '../db.js';

export type PersistenceMode = 'postgres' | 'memory' | 'unconfigured' | 'misconfigured';

export class PersistenceError extends Error {
  readonly status = 503;
  readonly code = 'PERSISTENCE_UNAVAILABLE';

  constructor(message = 'Persistent storage is unavailable') {
    super(message);
    this.name = 'PersistenceError';
  }
}

export interface UserRepository {
  getState(userId: string): Promise<UserState>;
  saveProfile(userId: string, profile: Profile): Promise<void>;
  saveDocument(userId: string, document: DocumentRecord): Promise<void>;
  saveGaps(userId: string, gaps: SkillGap[]): Promise<void>;
  savePath(userId: string, path: LearningPathPhase[]): Promise<void>;
  savePlan(userId: string, plan: WeeklyPlanItem[]): Promise<void>;
  saveTasks(userId: string, tasks: LearningTask[]): Promise<void>;
  savePractice(userId: string, practice: PracticeQuestion[]): Promise<void>;
  saveAttempt(userId: string, attempt: PracticeAttempt): Promise<void>;
  savePracticeResult(
    userId: string,
    attempt: PracticeAttempt,
    tasks: LearningTask[]
  ): Promise<void>;
  saveProjects(userId: string, projects: ProjectIdea[]): Promise<void>;
  saveReport(userId: string, report: ProgressReport): Promise<void>;
  appendMessages(userId: string, messages: ChatMessage[]): Promise<void>;
  deleteUserData(userId: string): Promise<void>;
}

function cloneState(state: UserState): UserState {
  return structuredClone(state);
}

export class MemoryRepository implements UserRepository {
  private readonly users = new Map<string, UserState>();

  async getState(userId: string): Promise<UserState> {
    return cloneState(this.users.get(userId) || emptyUserState());
  }

  private async update(
    userId: string,
    change: (state: UserState) => void
  ): Promise<void> {
    const state = await this.getState(userId);
    change(state);
    this.users.set(userId, state);
  }

  saveProfile(userId: string, profile: Profile): Promise<void> {
    return this.update(userId, (state) => {
      state.profile = profile;
    });
  }

  saveDocument(userId: string, document: DocumentRecord): Promise<void> {
    return this.update(userId, (state) => {
      state.document = document;
    });
  }

  saveGaps(userId: string, gaps: SkillGap[]): Promise<void> {
    return this.update(userId, (state) => {
      state.gaps = gaps;
    });
  }

  savePath(userId: string, path: LearningPathPhase[]): Promise<void> {
    return this.update(userId, (state) => {
      state.path = path;
    });
  }

  savePlan(userId: string, plan: WeeklyPlanItem[]): Promise<void> {
    return this.update(userId, (state) => {
      state.plan = plan;
    });
  }

  saveTasks(userId: string, tasks: LearningTask[]): Promise<void> {
    return this.update(userId, (state) => {
      state.tasks = tasks;
    });
  }

  savePractice(userId: string, practice: PracticeQuestion[]): Promise<void> {
    return this.update(userId, (state) => {
      state.practice = practice;
    });
  }

  saveAttempt(userId: string, attempt: PracticeAttempt): Promise<void> {
    return this.update(userId, (state) => {
      state.attempts.push(attempt);
    });
  }

  savePracticeResult(
    userId: string,
    attempt: PracticeAttempt,
    tasks: LearningTask[]
  ): Promise<void> {
    return this.update(userId, (state) => {
      state.attempts.push(attempt);
      state.tasks = tasks;
    });
  }

  saveProjects(userId: string, projects: ProjectIdea[]): Promise<void> {
    return this.update(userId, (state) => {
      state.projects = projects;
    });
  }

  saveReport(userId: string, report: ProgressReport): Promise<void> {
    return this.update(userId, (state) => {
      state.report = report;
    });
  }

  appendMessages(userId: string, messages: ChatMessage[]): Promise<void> {
    return this.update(userId, (state) => {
      state.messages.push(...messages);
    });
  }

  async deleteUserData(userId: string): Promise<void> {
    this.users.delete(userId);
  }
}

function jsonValue<T>(value: unknown, label: string): T {
  if (value === null || value === undefined) {
    throw new PersistenceError(`Stored ${label} data is invalid`);
  }
  try {
    return (typeof value === 'string' ? JSON.parse(value) : value) as T;
  } catch {
    throw new PersistenceError(`Stored ${label} data is invalid`);
  }
}

function requiredString(row: QueryResultRow, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') {
    throw new PersistenceError(`Stored ${key} data is invalid`);
  }
  return value;
}

function requiredNumber(row: QueryResultRow, key: string): number {
  const rawValue = row[key];
  if (
    rawValue === null ||
    rawValue === undefined ||
    (typeof rawValue === 'string' && rawValue.trim() === '')
  ) {
    throw new PersistenceError(`Stored ${key} data is invalid`);
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) {
    throw new PersistenceError(`Stored ${key} data is invalid`);
  }
  return value;
}

function asIsoString(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new PersistenceError('Stored timestamp data is invalid');
  }
  return date.toISOString();
}

function databaseErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return 'unknown';
}

export class PostgresRepository implements UserRepository {
  constructor(private readonly database: Pool) {}

  private async query<T extends QueryResultRow>(
    sql: string,
    params: unknown[] = []
  ): Promise<T[]> {
    try {
      const result = await this.database.query<T>(sql, params);
      return result.rows;
    } catch (error) {
      console.error('[EduPath persistence failure]', databaseErrorCode(error));
      throw new PersistenceError();
    }
  }

  private async transaction(
    operation: (client: PoolClient) => Promise<void>
  ): Promise<void> {
    let client: PoolClient;
    try {
      client = await this.database.connect();
    } catch (error) {
      console.error(
        '[EduPath persistence connection failure]',
        databaseErrorCode(error)
      );
      throw new PersistenceError();
    }

    try {
      await client.query('BEGIN');
      await operation(client);
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Keep the original operation error; the connection is released below.
      }
      console.error(
        '[EduPath persistence transaction failure]',
        databaseErrorCode(error)
      );
      throw new PersistenceError();
    } finally {
      client.release();
    }
  }

  async getState(userId: string): Promise<UserState> {
    const state = emptyUserState();
    try {
      const [
        profiles,
        documents,
        gaps,
        paths,
        plans,
        tasks,
        practices,
        attempts,
        projects,
        reports,
        messages,
      ] = await Promise.all([
        this.query(
          `select name, education_status, experience_level, target_role,
                  career_goal, study_minutes, learning_style, areas_to_improve, skills
           from profiles where user_id = $1 limit 1`,
          [userId]
        ),
        this.query(
          `select id, filename, mime_type, extracted_text, analysis, created_at
           from documents where user_id = $1
           order by created_at desc nulls last, id desc limit 1`,
          [userId]
        ),
        this.query(
          `select skill, current_level, required_level, status, priority, reason, action
           from skill_gaps where user_id = $1 order by sort_order, id`,
          [userId]
        ),
        this.query(
          `select path from learning_paths where user_id = $1
           order by updated_at desc nulls last, created_at desc nulls last, id desc limit 1`,
          [userId]
        ),
        this.query(
          `select plan from weekly_plans where user_id = $1
           order by created_at desc nulls last, id desc limit 1`,
          [userId]
        ),
        this.query(
          `select id, title, skill, minutes, status, difficulty, notes, remedial
           from learning_tasks where user_id = $1 order by sort_order, created_at, id`,
          [userId]
        ),
        this.query(
          `select questions from practice_questions where user_id = $1 limit 1`,
          [userId]
        ),
        this.query(
          `select id, question_id, skill, score, created_at
           from practice_attempts where user_id = $1 order by created_at, id`,
          [userId]
        ),
        this.query(
          `select projects from projects where user_id = $1
           order by created_at desc nulls last, id desc limit 1`,
          [userId]
        ),
        this.query(
          `select report from reports where user_id = $1
           order by created_at desc nulls last, id desc limit 1`,
          [userId]
        ),
        this.query(
          `select id, role, content, metadata, created_at
           from chat_messages where user_id = $1 order by created_at, id`,
          [userId]
        ),
      ]);

      const profile = profiles[0];
      if (profile) {
        state.profile = {
          name: requiredString(profile, 'name'),
          education_status: String(profile.education_status || ''),
          experience_level: String(profile.experience_level || 'Intermediate'),
          target_role: String(profile.target_role || ''),
          career_goal: String(profile.career_goal || ''),
          study_minutes: requiredNumber(profile, 'study_minutes'),
          learning_style: String(profile.learning_style || 'Project-based'),
          areas_to_improve: jsonValue<string[]>(
            profile.areas_to_improve || [],
            'profile areas'
          ),
          skills: jsonValue<string[]>(profile.skills || [], 'profile skills'),
        };
      }

      const document = documents[0];
      if (document) {
        state.document = {
          id: requiredString(document, 'id'),
          filename: String(document.filename || ''),
          mimeType: String(document.mime_type || ''),
          text: String(document.extracted_text || ''),
          analysis: jsonValue(document.analysis, 'document analysis'),
          uploadedAt: asIsoString(document.created_at),
        };
      }

      state.gaps = gaps.map((gap) => ({
        skill: requiredString(gap, 'skill'),
        currentLevel: requiredNumber(gap, 'current_level'),
        requiredLevel: requiredNumber(gap, 'required_level'),
        status: requiredString(gap, 'status'),
        priority: requiredString(gap, 'priority'),
        reason: requiredString(gap, 'reason'),
        action: requiredString(gap, 'action'),
      }));
      if (paths[0]) {
        state.path = jsonValue(paths[0].path, 'learning path');
      }
      if (plans[0]) {
        state.plan = jsonValue(plans[0].plan, 'weekly plan');
      }
      state.tasks = tasks.map((task) => ({
        id: requiredString(task, 'id'),
        title: String(task.title || ''),
        skill: String(task.skill || ''),
        minutes: requiredNumber(task, 'minutes'),
        status: requiredString(task, 'status') as LearningTask['status'],
        difficulty: String(task.difficulty || ''),
        ...(task.notes === null ? {} : { notes: String(task.notes) }),
        ...(task.remedial ? { remedial: true } : {}),
      }));
      if (practices[0]) {
        state.practice = jsonValue(practices[0].questions, 'practice questions');
      }
      state.attempts = attempts.map((attempt) => ({
        id: requiredString(attempt, 'id'),
        questionId: String(attempt.question_id || ''),
        skill: String(attempt.skill || ''),
        score: requiredNumber(attempt, 'score'),
        createdAt: asIsoString(attempt.created_at),
      }));
      if (projects[0]) {
        state.projects = jsonValue(projects[0].projects, 'projects');
      }
      if (reports[0]) {
        state.report = jsonValue(reports[0].report, 'progress report');
      }
      state.messages = messages.map((message) => {
        const metadata = jsonValue<Record<string, unknown>>(
          message.metadata || {},
          'chat metadata'
        );
        return {
          id: requiredString(message, 'id'),
          role: requiredString(message, 'role') as ChatMessage['role'],
          content: String(message.content || ''),
          actions: Array.isArray(metadata.actions)
            ? metadata.actions.map(String)
            : [],
          references: Array.isArray(metadata.references)
            ? metadata.references.map(String)
            : [],
          source:
            metadata.source === 'llm' ||
            metadata.source === 'demo' ||
            metadata.source === 'fallback'
              ? metadata.source
              : undefined,
          model: typeof metadata.model === 'string' ? metadata.model : null,
          createdAt: asIsoString(message.created_at),
        };
      });
      return state;
    } catch (error) {
      if (error instanceof PersistenceError) throw error;
      console.error(
        '[EduPath persistence read failure]',
        error instanceof PersistenceError ? 'invalid_data' : databaseErrorCode(error)
      );
      throw new PersistenceError();
    }
  }

  async saveProfile(userId: string, profile: Profile): Promise<void> {
    await this.query(
      `insert into profiles
         (user_id, name, education_status, experience_level, target_role,
          career_goal, study_minutes, learning_style, areas_to_improve, skills, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       on conflict (user_id) do update set
         name=excluded.name, education_status=excluded.education_status,
         experience_level=excluded.experience_level, target_role=excluded.target_role,
         career_goal=excluded.career_goal, study_minutes=excluded.study_minutes,
         learning_style=excluded.learning_style, areas_to_improve=excluded.areas_to_improve,
         skills=excluded.skills, updated_at=now()`,
      [
        userId,
        profile.name,
        profile.education_status,
        profile.experience_level,
        profile.target_role,
        profile.career_goal,
        profile.study_minutes,
        profile.learning_style,
        profile.areas_to_improve,
        profile.skills,
      ]
    );
  }

  async saveDocument(userId: string, document: DocumentRecord): Promise<void> {
    await this.query(
      `insert into documents
         (id, user_id, filename, mime_type, extracted_text, analysis, created_at)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        document.id,
        userId,
        document.filename,
        document.mimeType,
        document.text.slice(0, 50000),
        JSON.stringify(document.analysis),
        document.uploadedAt,
      ]
    );
  }

  async saveGaps(userId: string, gaps: SkillGap[]): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`delete from skill_gaps where user_id = $1`, [userId]);
      for (const [sortOrder, gap] of gaps.entries()) {
        await client.query(
          `insert into skill_gaps
             (user_id, sort_order, skill, current_level, required_level, status, priority, reason, action)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            userId,
            sortOrder,
            gap.skill,
            gap.currentLevel,
            gap.requiredLevel,
            gap.status,
            gap.priority,
            gap.reason,
            gap.action,
          ]
        );
      }
    });
  }

  async savePath(userId: string, path: LearningPathPhase[]): Promise<void> {
    await this.query(
      `insert into learning_paths (user_id, path) values ($1, $2)`,
      [userId, JSON.stringify(path)]
    );
  }

  async savePlan(userId: string, plan: WeeklyPlanItem[]): Promise<void> {
    await this.query(
      `insert into weekly_plans (user_id, week_start, plan)
       values ($1, current_date, $2)`,
      [userId, JSON.stringify(plan)]
    );
  }

  async saveTasks(userId: string, tasks: LearningTask[]): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(`delete from learning_tasks where user_id = $1`, [userId]);
      await this.insertTasks(client, userId, tasks);
    });
  }

  private async insertTasks(
    client: PoolClient,
    userId: string,
    tasks: LearningTask[]
  ): Promise<void> {
    for (const [sortOrder, task] of tasks.entries()) {
      await client.query(
        `insert into learning_tasks
           (id, user_id, sort_order, title, skill, minutes, status, difficulty, notes, remedial)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          task.id,
          userId,
          sortOrder,
          task.title,
          task.skill,
          task.minutes,
          task.status,
          task.difficulty,
          task.notes ?? null,
          Boolean(task.remedial),
        ]
      );
    }
  }

  async savePractice(userId: string, practice: PracticeQuestion[]): Promise<void> {
    await this.query(
      `insert into practice_questions (user_id, questions, updated_at)
       values ($1,$2,now())
       on conflict (user_id) do update
         set questions=excluded.questions, updated_at=now()`,
      [userId, JSON.stringify(practice)]
    );
  }

  async saveAttempt(userId: string, attempt: PracticeAttempt): Promise<void> {
    await this.query(
      `insert into practice_attempts (id, user_id, question_id, skill, score, created_at)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        attempt.id,
        userId,
        attempt.questionId,
        attempt.skill,
        attempt.score,
        attempt.createdAt,
      ]
    );
  }

  async savePracticeResult(
    userId: string,
    attempt: PracticeAttempt,
    tasks: LearningTask[]
  ): Promise<void> {
    await this.transaction(async (client) => {
      await client.query(
        `insert into practice_attempts (id, user_id, question_id, skill, score, created_at)
         values ($1,$2,$3,$4,$5,$6)`,
        [
          attempt.id,
          userId,
          attempt.questionId,
          attempt.skill,
          attempt.score,
          attempt.createdAt,
        ]
      );
      await client.query(`delete from learning_tasks where user_id = $1`, [
        userId,
      ]);
      await this.insertTasks(client, userId, tasks);
    });
  }

  async saveProjects(userId: string, projects: ProjectIdea[]): Promise<void> {
    await this.query(
      `insert into projects (user_id, projects) values ($1,$2)`,
      [userId, JSON.stringify(projects)]
    );
  }

  async saveReport(userId: string, report: ProgressReport): Promise<void> {
    await this.query(
      `insert into reports (user_id, report) values ($1,$2)`,
      [userId, JSON.stringify(report)]
    );
  }

  async appendMessages(userId: string, messages: ChatMessage[]): Promise<void> {
    await this.transaction(async (client) => {
      for (const message of messages) {
        await client.query(
          `insert into chat_messages (id, user_id, role, content, metadata, created_at)
           values ($1,$2,$3,$4,$5,$6)`,
          [
            message.id,
            userId,
            message.role,
            message.content,
            JSON.stringify({
              actions: message.actions || [],
              references: message.references || [],
              source: message.source || null,
              model: message.model || null,
            }),
            message.createdAt,
          ]
        );
      }
    });
  }

  async deleteUserData(userId: string): Promise<void> {
    await this.transaction(async (client) => {
      for (const table of [
        'profiles',
        'documents',
        'skill_gaps',
        'learning_paths',
        'weekly_plans',
        'learning_tasks',
        'progress_records',
        'practice_attempts',
        'practice_questions',
        'projects',
        'reports',
        'chat_messages',
      ]) {
        await client.query(`delete from ${table} where user_id = $1`, [userId]);
      }
    });
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const supabaseAuthConfigured = Boolean(
  process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim()
);
const requestedMode = process.env.PERSISTENCE_MODE?.trim().toLowerCase();
const demoExplicitlyEnabled =
  process.env.DEMO_MODE?.trim().toLowerCase() === 'true';

export const persistenceMode: PersistenceMode =
  requestedMode === 'memory'
    ? demoExplicitlyEnabled
      ? 'memory'
      : 'misconfigured'
    : requestedMode === 'postgres'
      ? databaseUrl && supabaseAuthConfigured
        ? 'postgres'
        : 'misconfigured'
      : requestedMode
        ? 'misconfigured'
        : databaseUrl
          ? supabaseAuthConfigured
            ? 'postgres'
            : 'misconfigured'
          : 'unconfigured';

export const persistenceModeError =
  persistenceMode === 'memory' || persistenceMode === 'postgres'
    ? null
    : persistenceMode === 'misconfigured'
      ? 'PostgreSQL mode requires DATABASE_URL, SUPABASE_URL, and SUPABASE_ANON_KEY; memory mode requires DEMO_MODE=true'
      : 'Configure DATABASE_URL or explicitly enable PERSISTENCE_MODE=memory for demo mode';

class UnavailableRepository implements UserRepository {
  private fail(): never {
    throw new PersistenceError(persistenceModeError || undefined);
  }

  async getState(_userId: string): Promise<UserState> {
    return this.fail();
  }
  async saveProfile(_userId: string, _profile: Profile): Promise<void> {
    this.fail();
  }
  async saveDocument(_userId: string, _document: DocumentRecord): Promise<void> {
    this.fail();
  }
  async saveGaps(_userId: string, _gaps: SkillGap[]): Promise<void> {
    this.fail();
  }
  async savePath(_userId: string, _path: LearningPathPhase[]): Promise<void> {
    this.fail();
  }
  async savePlan(_userId: string, _plan: WeeklyPlanItem[]): Promise<void> {
    this.fail();
  }
  async saveTasks(_userId: string, _tasks: LearningTask[]): Promise<void> {
    this.fail();
  }
  async savePractice(
    _userId: string,
    _practice: PracticeQuestion[]
  ): Promise<void> {
    this.fail();
  }
  async saveAttempt(_userId: string, _attempt: PracticeAttempt): Promise<void> {
    this.fail();
  }
  async savePracticeResult(
    _userId: string,
    _attempt: PracticeAttempt,
    _tasks: LearningTask[]
  ): Promise<void> {
    this.fail();
  }
  async saveProjects(_userId: string, _projects: ProjectIdea[]): Promise<void> {
    this.fail();
  }
  async saveReport(_userId: string, _report: ProgressReport): Promise<void> {
    this.fail();
  }
  async appendMessages(
    _userId: string,
    _messages: ChatMessage[]
  ): Promise<void> {
    this.fail();
  }
  async deleteUserData(_userId: string): Promise<void> {
    this.fail();
  }
}

export const repository: UserRepository =
  persistenceMode === 'memory'
    ? new MemoryRepository()
    : persistenceMode === 'postgres' && pool
      ? new PostgresRepository(pool)
      : new UnavailableRepository();
