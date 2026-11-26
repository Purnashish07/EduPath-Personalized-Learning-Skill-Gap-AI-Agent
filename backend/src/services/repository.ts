import { query, pool } from '../db.js';
import type {
  ChatMessage,
  DocumentRecord,
  LearningPathPhase,
  LearningTask,
  PracticeAttempt,
  Profile,
  ProgressReport,
  ProjectIdea,
  SkillGap,
  WeeklyPlanItem,
} from '../store.js';

/**
 * Optional PostgreSQL persistence adapter.
 * Uses strictly parameterized queries ($1, $2, ...) whenever DATABASE_URL is configured.
 * Falls back transparently to in-memory store when DATABASE_URL is empty or unavailable.
 */
async function safeDbExec(sql: string, params: unknown[]): Promise<void> {
  if (!pool) return;
  try {
    await query(sql, params);
  } catch (err) {
    console.warn(
      '[EduPath DB Write Warning]',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }
}

export const repository = {
  async saveProfile(userId: string, profile: Profile): Promise<void> {
    await safeDbExec(
      `insert into profiles (user_id, name, education_status, experience_level, target_role, career_goal, study_minutes, learning_style, areas_to_improve, skills, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
       on conflict (user_id) do update set
         name=excluded.name,
         education_status=excluded.education_status,
         experience_level=excluded.experience_level,
         target_role=excluded.target_role,
         career_goal=excluded.career_goal,
         study_minutes=excluded.study_minutes,
         learning_style=excluded.learning_style,
         areas_to_improve=excluded.areas_to_improve,
         skills=excluded.skills,
         updated_at=now()`,
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
  },

  async saveDocument(userId: string, doc: DocumentRecord): Promise<void> {
    await safeDbExec(
      `insert into documents (id, user_id, filename, mime_type, extracted_text, analysis)
       values ($1,$2,$3,$4,$5,$6)`,
      [
        doc.id,
        userId,
        doc.filename,
        doc.mimeType,
        doc.text.slice(0, 50000),
        JSON.stringify(doc.analysis),
      ]
    );
  },

  async saveGaps(userId: string, gaps: SkillGap[]): Promise<void> {
    if (!pool) return;
    await safeDbExec(`delete from skill_gaps where user_id = $1`, [userId]);
    for (const g of gaps) {
      await safeDbExec(
        `insert into skill_gaps (user_id, skill, current_level, required_level, status, priority, reason, action)
         values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          userId,
          g.skill,
          g.currentLevel,
          g.requiredLevel,
          g.status,
          g.priority,
          g.reason,
          g.action,
        ]
      );
    }
  },

  async savePath(userId: string, path: LearningPathPhase[]): Promise<void> {
    await safeDbExec(
      `insert into learning_paths (user_id, path) values ($1, $2)`,
      [userId, JSON.stringify(path)]
    );
  },

  async savePlan(userId: string, plan: WeeklyPlanItem[]): Promise<void> {
    await safeDbExec(
      `insert into weekly_plans (user_id, week_start, plan) values ($1, current_date, $2)`,
      [userId, JSON.stringify(plan)]
    );
  },

  async saveTasks(userId: string, tasks: LearningTask[]): Promise<void> {
    if (!pool) return;
    await safeDbExec(`delete from learning_tasks where user_id = $1`, [userId]);
    for (const t of tasks) {
      await safeDbExec(
        `insert into learning_tasks (id, user_id, title, skill, minutes, status, difficulty, notes, remedial)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          t.id,
          userId,
          t.title,
          t.skill,
          t.minutes,
          t.status,
          t.difficulty,
          t.notes || null,
          Boolean(t.remedial),
        ]
      );
    }
  },

  async saveAttempt(userId: string, attempt: PracticeAttempt): Promise<void> {
    await safeDbExec(
      `insert into practice_attempts (id, user_id, question_id, skill, score)
       values ($1,$2,$3,$4,$5)`,
      [attempt.id, userId, attempt.questionId, attempt.skill, attempt.score]
    );
  },

  async saveProjects(userId: string, projects: ProjectIdea[]): Promise<void> {
    await safeDbExec(`insert into projects (user_id, projects) values ($1, $2)`, [
      userId,
      JSON.stringify(projects),
    ]);
  },

  async saveReport(userId: string, report: ProgressReport): Promise<void> {
    await safeDbExec(`insert into reports (user_id, report) values ($1, $2)`, [
      userId,
      JSON.stringify(report),
    ]);
  },

  async saveChatMessage(userId: string, msg: ChatMessage): Promise<void> {
    await safeDbExec(
      `insert into chat_messages (id, user_id, role, content, metadata)
       values ($1,$2,$3,$4,$5)`,
      [
        msg.id,
        userId,
        msg.role,
        msg.content,
        JSON.stringify({
          actions: msg.actions || [],
          references: msg.references || [],
          source: msg.source || null,
          model: msg.model || null,
        }),
      ]
    );
  },
};
