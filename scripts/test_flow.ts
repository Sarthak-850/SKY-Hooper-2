/**
 * Automated End-to-End Verification Test for Global Leaderboard & Country Competition System
 */

import { DatabaseSync } from 'node:sqlite';
import { db } from '../server/db.ts';
import { antiCheat } from '../server/antiCheat.ts';
import { seedDatabaseIfNeeded } from '../server/seedData.ts';
import { findCountry } from '../server/countries.ts';

async function runTests() {
  console.log('🧪 Starting Global Leaderboard & Country Competition Test Suite...\n');

  // 1. Database Initialization & Seeding
  console.log('1. Checking database & seed data...');
  seedDatabaseIfNeeded();
  const playerCount = db.getPlayerCount();
  console.log(`✓ Database initialized with ${playerCount} active players across nations.`);
  if (playerCount < 10) {
    throw new Error('Database player count is unexpectedly low');
  }

  // 2. World Leaderboard Query
  console.log('\n2. Testing World Leaderboard...');
  const worldLeaderboard = db.getWorldLeaderboard({ limit: 10, offset: 0 });
  console.log(`✓ World Total Records: ${worldLeaderboard.total}`);
  console.log('Top 3 World Podium:');
  worldLeaderboard.entries.slice(0, 3).forEach((e) => {
    console.log(`  #${e.rank} ${e.countryFlag} ${e.username} (${e.countryName}) — ${e.score.toLocaleString()} pts`);
  });
  if (worldLeaderboard.entries[0].score < worldLeaderboard.entries[1].score) {
    throw new Error('World leaderboard is not ordered by score descending!');
  }

  // 3. India Country Leaderboard Query
  console.log('\n3. Testing India Country Leaderboard...');
  const indiaLeaderboard = db.getCountryLeaderboard('IN', { limit: 5 });
  console.log(`✓ India Total Pilots: ${indiaLeaderboard.total}`);
  indiaLeaderboard.entries.forEach((e) => {
    console.log(`  #${e.rank} ${e.countryFlag} ${e.username} — ${e.score.toLocaleString()} pts`);
    if (e.countryCode !== 'IN') {
      throw new Error(`Non-Indian player ${e.username} found in India leaderboard!`);
    }
  });

  // 4. Country Battle / Competition
  console.log('\n4. Testing Country vs Country Competition...');
  const countryBattle = db.getCountryCompetition('totalScore');
  console.log(`✓ Competing Nations: ${countryBattle.length}`);
  console.log('Top 5 Nations by Combined Total Score:');
  countryBattle.slice(0, 5).forEach((c) => {
    console.log(`  #${c.rank} ${c.countryFlag} ${c.countryName}: Total ${c.totalScore.toLocaleString()} pts | ${c.playerCount} pilots | Avg ${c.averageScore} | Best ${c.bestScore.toLocaleString()} (${c.bestPlayerName})`);
  });

  // Test sorting by average score
  const avgSorted = db.getCountryCompetition('averageScore');
  console.log(`✓ Top Nation by Average Pilot Skill: ${avgSorted[0].countryFlag} ${avgSorted[0].countryName} (Avg: ${avgSorted[0].averageScore})`);

  // 5. Player Registration & Session Anti-Cheat
  console.log('\n5. Testing Player Registration & Anti-Cheat Session Tokens...');
  const testPlayerId = `pilot_test_${Date.now()}`;
  const sarthak = db.upsertPlayer({
    id: testPlayerId,
    username: 'Sarthak',
    countryCode: 'IN',
    countryName: 'India',
    countryFlag: '🇮🇳',
  });
  console.log(`✓ Registered Pilot: ${sarthak.username} (${sarthak.countryFlag} ${sarthak.countryName}) [ID: ${sarthak.id}]`);

  const sessionId = `sess_test_${Date.now()}`;
  const token = antiCheat.generateSessionToken(sarthak.id, sessionId);
  db.createSession(sessionId, sarthak.id, token);
  console.log(`✓ Generated authenticated session: ${sessionId}`);

  // 6. Legitimate Score Submission
  console.log('\n6. Testing Legitimate Flight Score Submission...');
  const scoreResult = db.recordScore({
    id: `score_test_${Date.now()}`,
    playerId: sarthak.id,
    score: 17200,
    maxCombo: 24,
    perfectGates: 31,
    nearMisses: 15,
    stars: 122,
    coins: 45,
    durationSeconds: 220,
    zoneReached: 'AURORA_DIMENSION',
    gameMode: 'CLASSIC',
    sessionId,
  });
  db.markSessionUsed(sessionId);

  console.log(`✓ Score 17,200 recorded successfully!`);
  console.log(`  Is New Personal Best: ${scoreResult.isNewBest}`);
  console.log(`  World Rank: #${scoreResult.newWorldRank}`);
  console.log(`  India Rank: #${scoreResult.newCountryRank}`);

  // 7. Duplicate Submission Prevention
  console.log('\n7. Testing Anti-Cheat: Duplicate Session Rejection...');
  const duplicateValidation = antiCheat.validate({
    playerId: sarthak.id,
    sessionId,
    sessionToken: token,
    score: 17200,
    maxCombo: 24,
    perfectGates: 31,
    nearMisses: 15,
    stars: 122,
    coins: 45,
    durationSeconds: 220,
    zoneReached: 'AURORA_DIMENSION',
    gameMode: 'CLASSIC',
    timestamp: Date.now(),
  });
  if (duplicateValidation.isValid) {
    throw new Error('Anti-cheat failed to reject duplicate session submission!');
  }
  console.log(`✓ Correctly rejected duplicate session: "${duplicateValidation.reason}"`);

  // 8. Impossible Speed / Rate Progression Rejection
  console.log('\n8. Testing Anti-Cheat: Impossible Score Jump Rejection...');
  const sessionImpossible = `sess_impossible_${Date.now()}`;
  const tokenImpossible = antiCheat.generateSessionToken(sarthak.id, sessionImpossible);
  db.createSession(sessionImpossible, sarthak.id, tokenImpossible);

  const speedHackValidation = antiCheat.validate({
    playerId: sarthak.id,
    sessionId: sessionImpossible,
    sessionToken: tokenImpossible,
    score: 5000, // 5000 gates in 5 seconds = 1000 gates/sec (physically impossible!)
    maxCombo: 10,
    perfectGates: 0,
    nearMisses: 0,
    stars: 10,
    coins: 5,
    durationSeconds: 5,
    zoneReached: 'NEON_CLOUDS',
    gameMode: 'CLASSIC',
    timestamp: Date.now(),
  });
  if (speedHackValidation.isValid) {
    throw new Error('Anti-cheat failed to reject physically impossible flight score!');
  }
  console.log(`✓ Correctly rejected impossible flight speed: "${speedHackValidation.reason}"`);

  // 9. Search Functionality
  console.log('\n9. Testing Leaderboard Search...');
  const searchResults = db.searchLeaderboard('Sarthak');
  if (searchResults.length === 0) {
    throw new Error('Search failed to find player "Sarthak"!');
  }
  console.log(`✓ Found: ${searchResults[0].username} (${searchResults[0].countryFlag}) - Score: ${searchResults[0].score.toLocaleString()} | World #${searchResults[0].worldRank} | India #${searchResults[0].countryRank}`);

  // 10. Nearby Competitors Radar
  console.log('\n10. Testing Nearby Competitors Radar...');
  const nearbyWorld = db.getNearbyCompetitors(sarthak.id, 'world');
  console.log(`✓ Nearby Competitors on World Radar: ${nearbyWorld.length} pilots:`);
  nearbyWorld.forEach((n) => {
    console.log(`  #${n.rank} ${n.countryFlag} ${n.username} — ${n.score.toLocaleString()} pts ${n.isCurrentPlayer ? '(YOU)' : ''}`);
  });

  console.log('\n🎉 ALL 10 TESTS PASSED! Global Leaderboard & Country Competition is fully operational!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
