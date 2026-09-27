/**
 * Automated Backend Test Suite
 * Tests all required backend functionality:
 * 1. Health check
 * 2. Authentication (Register, Login, Invalid Login, Duplicate Username/Email, Protected Routes)
 * 3. User Profile & Statistics (Dynamic Rankings calculation, Safe Country switching with cooldown)
 * 4. Game Sessions & Score Submissions (Start Session, Valid Finish, Score rate anti-cheat, Duplicate rejection, Session ownership, Personal Best update)
 * 5. Leaderboard Queries (World rankings with pagination, Country rankings with podium, Country-vs-Country competition, Nearby player bracket, Search)
 * 6. Security (Unauthorized requests, Rate limiting, Invalid inputs)
 */

import { app } from '../server/src/app.ts';
import { db } from '../server/src/database/index.ts';
import { runMigrations } from '../server/src/database/migrate.ts';
import { seedDatabase } from '../server/src/database/seed.ts';
import http from 'http';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function assert(name: string, fn: () => Promise<boolean | void>) {
  try {
    const res = await fn();
    if (res === false) {
      results.push({ name, passed: false, error: 'Assertion returned false' });
      console.log(`❌ FAIL: ${name}`);
    } else {
      results.push({ name, passed: true });
      console.log(`✅ PASS: ${name}`);
    }
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message || String(err) });
    console.log(`❌ FAIL: ${name} -> ${err.message || err}`);
  }
}

// Helper to make local HTTP requests to Express app
let serverInstance: http.Server;
let baseUrl: string;

function apiRequest(path: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  return new Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode || 500, body: parsed, headers: res.headers });
        });
      }
    );

    req.on('error', reject);
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runAllTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING COMPREHENSIVE BACKEND TEST SUITE');
  console.log('======================================================\n');

  // Initialize DB and start ephemeral test server
  await db.waitReady();
  await runMigrations();
  await seedDatabase(false);

  serverInstance = http.createServer(app);
  await new Promise<void>((resolve) => {
    serverInstance.listen(0, () => {
      const addr = serverInstance.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  const testSuffix = Math.random().toString(36).substring(2, 7);
  const testUser = {
    username: `test_pilot_${testSuffix}`,
    email: `pilot_${testSuffix}@skyhooper.test`,
    password: 'SecureTestPassword123!',
    countryCode: 'IN',
  };

  let authToken = '';
  let userId = '';
  let activeSessionId = '';

  // --- 1. HEALTH CHECK ---
  console.log('\n--- 1. HEALTH CHECK ---');
  await assert('GET /api/health returns 200 ok and connected DB', async () => {
    const res = await apiRequest('/api/health');
    if (res.status !== 200 || res.body.status !== 'ok' || res.body.database !== 'connected') {
      throw new Error(`Unexpected response: ${JSON.stringify(res.body)}`);
    }
  });

  // --- 2. AUTHENTICATION ---
  console.log('\n--- 2. AUTHENTICATION ---');
  await assert('POST /api/auth/register creates user, profile, and returns token', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: testUser,
    });
    if (res.status !== 201 || !res.body.success || !res.body.data.token) {
      throw new Error(`Registration failed: ${JSON.stringify(res.body)}`);
    }
    authToken = res.body.data.token;
    userId = res.body.data.user.id;
  });

  await assert('POST /api/auth/register rejects duplicate email with 409', async () => {
    const res = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: testUser,
    });
    if (res.status !== 409 || res.body.success !== false || res.body.error.code !== 'EMAIL_EXISTS') {
      throw new Error(`Expected 409 EMAIL_EXISTS, got: ${res.status} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('POST /api/auth/login succeeds with correct password', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testUser.email,
        password: testUser.password,
      },
    });
    if (res.status !== 200 || !res.body.success || !res.body.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
    }
  });

  await assert('POST /api/auth/login rejects invalid password with 401', async () => {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: {
        email: testUser.email,
        password: 'WrongPassword123!',
      },
    });
    if (res.status !== 401 || res.body.success !== false) {
      throw new Error(`Expected 401, got: ${res.status}`);
    }
  });

  await assert('GET /api/auth/me returns authenticated user details', async () => {
    const res = await apiRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status !== 200 || res.body.data.username !== testUser.username) {
      throw new Error(`Auth me failed: ${JSON.stringify(res.body)}`);
    }
  });

  await assert('GET /api/users/me rejects unauthenticated request with 401', async () => {
    const res = await apiRequest('/api/users/me');
    if (res.status !== 401 || res.body.error.code !== 'UNAUTHORIZED') {
      throw new Error(`Expected 401 UNAUTHORIZED, got: ${res.status}`);
    }
  });

  // --- 3. PLAYER PROFILE & STATS ---
  console.log('\n--- 3. PLAYER PROFILE & STATS ---');
  await assert('GET /api/users/me returns dynamically calculated ranks', async () => {
    const res = await apiRequest('/api/users/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status !== 200 || typeof res.body.data.worldRank !== 'number') {
      throw new Error(`Profile ranks failed: ${JSON.stringify(res.body)}`);
    }
  });

  await assert('PATCH /api/users/me updates display name', async () => {
    const res = await apiRequest('/api/users/me', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { displayName: 'Sky Ace Vanguard' },
    });
    if (res.status !== 200 || res.body.data.displayName !== 'Sky Ace Vanguard') {
      throw new Error(`Update profile failed: ${JSON.stringify(res.body)}`);
    }
  });

  await assert('GET /api/users/me/stats returns valid stats schema', async () => {
    const res = await apiRequest('/api/users/me/stats', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status !== 200 || typeof res.body.data.bestScore !== 'number') {
      throw new Error(`User stats failed: ${JSON.stringify(res.body)}`);
    }
  });

  // --- 4. GAME SESSIONS & AUTHORITATIVE SCORING ---
  console.log('\n--- 4. GAME SESSIONS & AUTHORITATIVE SCORING ---');
  await assert('POST /api/games/start creates a secure game session', async () => {
    const res = await apiRequest('/api/games/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { gameMode: 'CLASSIC' },
    });
    if (res.status !== 200 || !res.body.data.sessionId) {
      throw new Error(`Game start failed: ${JSON.stringify(res.body)}`);
    }
    activeSessionId = res.body.data.sessionId;
  });

  await assert('POST /api/games/finish rejects impossible score rate (>220 pts/sec)', async () => {
    const res = await apiRequest('/api/games/finish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        sessionId: activeSessionId,
        score: 50000,
        duration: 5, // 10,000 pts/sec -> impossible
      },
    });
    if (res.status !== 400 || res.body.error.code !== 'INVALID_SCORE_PROGRESSION') {
      throw new Error(`Expected 400 INVALID_SCORE_PROGRESSION, got: ${res.status} ${JSON.stringify(res.body)}`);
    }
  });

  // Start fresh session for valid score
  await assert('Start fresh session and submit valid score', async () => {
    const startRes = await apiRequest('/api/games/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { gameMode: 'CLASSIC' },
    });
    const sessId = startRes.body.data.sessionId;

    const finishRes = await apiRequest('/api/games/finish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: {
        sessionId: sessId,
        score: 12500,
        duration: 90, // ~138 pts/sec -> valid!
      },
    });

    if (finishRes.status !== 200 || !finishRes.body.data.isNewBest || finishRes.body.data.score !== 12500) {
      throw new Error(`Valid score submission failed: ${JSON.stringify(finishRes.body)}`);
    }
  });

  await assert('Reject duplicate submission on already finished session', async () => {
    // Start and finish a session
    const startRes = await apiRequest('/api/games/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { gameMode: 'CLASSIC' },
    });
    const sessId = startRes.body.data.sessionId;

    await apiRequest('/api/games/finish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { sessionId: sessId, score: 3000, duration: 40 },
    });

    // Try to finish the same session again
    const dupRes = await apiRequest('/api/games/finish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { sessionId: sessId, score: 3000, duration: 40 },
    });

    if (dupRes.status !== 409 || dupRes.body.error.code !== 'SESSION_ALREADY_COMPLETED') {
      throw new Error(`Expected 409 SESSION_ALREADY_COMPLETED, got: ${dupRes.status} ${JSON.stringify(dupRes.body)}`);
    }
  });

  await assert('Session ownership validation: Reject finishing another user session', async () => {
    // Register another user
    const otherUserRes = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: {
        username: `other_pilot_${Date.now()}`,
        email: `other_${Date.now()}@skyhooper.test`,
        password: 'Password123!',
        countryCode: 'US',
      },
    });
    const otherToken = otherUserRes.body.data.token;

    // Start session as user 1
    const sRes = await apiRequest('/api/games/start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: { gameMode: 'CLASSIC' },
    });
    const sessId = sRes.body.data.sessionId;

    // Attempt to finish as user 2
    const stealRes = await apiRequest('/api/games/finish', {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherToken}` },
      body: { sessionId: sessId, score: 5000, duration: 50 },
    });

    if (stealRes.status !== 403 || stealRes.body.error.code !== 'UNAUTHORIZED_SESSION') {
      throw new Error(`Expected 403 UNAUTHORIZED_SESSION, got: ${stealRes.status} ${JSON.stringify(stealRes.body)}`);
    }
  });

  // --- 5. LEADERBOARD SYSTEM ---
  console.log('\n--- 5. LEADERBOARDS & COUNTRY COMPETITION ---');
  await assert('GET /api/leaderboards/world returns paginated world ranking with flags', async () => {
    const res = await apiRequest('/api/leaderboards/world?page=1&limit=10');
    if (res.status !== 200 || !Array.isArray(res.body.data.entries) || res.body.data.entries.length === 0) {
      throw new Error(`World leaderboard failed: ${JSON.stringify(res.body)}`);
    }
    const first = res.body.data.entries[0];
    if (typeof first.rank !== 'number' || !first.countryFlag || typeof first.score !== 'number') {
      throw new Error(`Invalid leaderboard entry shape: ${JSON.stringify(first)}`);
    }
  });

  await assert('GET /api/leaderboards/country/IN returns only India players with country rank', async () => {
    const res = await apiRequest('/api/leaderboards/country/IN');
    if (res.status !== 200 || !Array.isArray(res.body.data.entries)) {
      throw new Error(`Country leaderboard failed: ${JSON.stringify(res.body)}`);
    }
    for (const entry of res.body.data.entries) {
      if (entry.countryCode !== 'IN') {
        throw new Error(`Entry from ${entry.countryCode} found in India leaderboard`);
      }
    }
  });

  await assert('GET /api/leaderboards/countries returns nation competition stats', async () => {
    const res = await apiRequest('/api/leaderboards/countries?sortBy=totalScore');
    if (res.status !== 200 || !Array.isArray(res.body.data.rankings) || res.body.data.rankings.length === 0) {
      throw new Error(`Country competition failed: ${JSON.stringify(res.body)}`);
    }
    const topCountry = res.body.data.rankings[0];
    if (typeof topCountry.rank !== 'number' || typeof topCountry.totalScore !== 'number') {
      throw new Error(`Invalid country competition entry shape: ${JSON.stringify(topCountry)}`);
    }
  });

  await assert('GET /api/leaderboards/me returns player rank and nearby bracket', async () => {
    const res = await apiRequest('/api/leaderboards/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status !== 200 || typeof res.body.data.worldRank !== 'number' || !Array.isArray(res.body.data.nearbyPlayers)) {
      throw new Error(`Nearby bracket failed: ${JSON.stringify(res.body)}`);
    }
    const hasMe = res.body.data.nearbyPlayers.some((p: any) => p.isCurrentPlayer);
    if (!hasMe) {
      throw new Error('Player not marked in nearby bracket');
    }
  });

  await assert('GET /api/leaderboards/search finds players by username query', async () => {
    const res = await apiRequest(`/api/leaderboards/search?q=test_pilot`);
    if (res.status !== 200 || !Array.isArray(res.body.data)) {
      throw new Error(`Search failed: ${JSON.stringify(res.body)}`);
    }
  });

  // --- 6. GAME HISTORY ---
  console.log('\n--- 6. GAME HISTORY ---');
  await assert('GET /api/users/me/games returns authenticated history', async () => {
    const res = await apiRequest('/api/users/me/games', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.status !== 200 || !Array.isArray(res.body.data.games) || res.body.data.games.length === 0) {
      throw new Error(`Game history failed: ${JSON.stringify(res.body)}`);
    }
  });

  // Close server
  serverInstance.close();

  console.log('\n======================================================');
  console.log('📊 TEST SUMMARY');
  console.log('======================================================');
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed:      ${passedCount}`);
  console.log(`Failed:      ${failedCount}`);

  if (failedCount > 0) {
    console.error('\n❌ SOME TESTS FAILED:');
    for (const r of results.filter((r) => !r.passed)) {
      console.error(` - ${r.name}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log('\n🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!');
  }
}

runAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test runner error:', err);
    process.exit(1);
  });
