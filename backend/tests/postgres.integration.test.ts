import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import pg from 'pg';
import { PostgresRepository } from '../src/services/repository.js';
import type { Profile } from '../src/store.js';

const databaseUrl = process.env.TEST_DATABASE_URL;

const integrationTest = test(
  'PostgreSQL persists user data across pool restart and isolates users',
  { skip: !databaseUrl && 'Set TEST_DATABASE_URL to an isolated migrated test database' },
  async () => {
    if (!databaseUrl) return;
    const databaseName = decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
    if (!/(^|[_-])(test|testing|qa)([_-]|$)/i.test(databaseName)) {
      throw new Error(
        'TEST_DATABASE_URL must target a database whose name contains test, testing, or qa'
      );
    }

    const userA = `qa-${randomUUID()}`;
    const userB = `qa-${randomUUID()}`;
    const profile: Profile = {
      name: 'Persistent QA Learner',
      education_status: 'Test fixture',
      experience_level: 'Intermediate',
      target_role: 'AI Engineer',
      career_goal: 'Verify database persistence',
      study_minutes: 60,
      learning_style: 'Project-based',
      areas_to_improve: [],
      skills: ['Python'],
    };

    const firstPool = new pg.Pool({
      connectionString: databaseUrl,
      max: 1,
      connectionTimeoutMillis: 5000,
    });
    let firstPoolClosed = false;
    try {
      const firstRepository = new PostgresRepository(firstPool);
      await firstRepository.saveProfile(userA, profile);
      await firstRepository.saveProfile(userB, { ...profile, name: 'Other User' });
      assert.equal(
        (await firstRepository.getState(userA)).profile?.name,
        'Persistent QA Learner'
      );
      await firstPool.end();
      firstPoolClosed = true;

      const secondPool = new pg.Pool({
        connectionString: databaseUrl,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      try {
        const secondRepository = new PostgresRepository(secondPool);
        assert.equal(
          (await secondRepository.getState(userA)).profile?.name,
          'Persistent QA Learner'
        );
        assert.equal(
          (await secondRepository.getState(userB)).profile?.name,
          'Other User'
        );
        await secondRepository.deleteUserData(userA);
        assert.equal((await secondRepository.getState(userA)).profile, null);
        assert.equal(
          (await secondRepository.getState(userB)).profile?.name,
          'Other User'
        );
        await secondRepository.deleteUserData(userB);
      } finally {
        await secondPool.end();
      }
    } finally {
      if (!firstPoolClosed) {
        await firstPool.end();
      }
    }
  }
);

void integrationTest;
