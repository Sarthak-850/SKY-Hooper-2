/**
 * Anti-Cheat & Score Validation Engine
 * Authoritative server-side verification of all incoming flight scores.
 */

import crypto from 'node:crypto';
import { ScoreSubmissionPayload } from '../src/types/leaderboard.ts';
import { db } from './db.ts';

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export class AntiCheatValidator {
  /**
   * Generates a cryptographically secure session token
   */
  public generateSessionToken(playerId: string, sessionId: string): string {
    const secret = process.env.SESSION_SECRET || 'sky-hooper-secure-salt-2026';
    return crypto
      .createHmac('sha256', secret)
      .update(`${playerId}:${sessionId}:${Date.now()}`)
      .digest('hex');
  }

  /**
   * Validates score submission against strict physical and temporal rules
   */
  public validate(payload: ScoreSubmissionPayload): ValidationResult {
    // 1. Sanity check score values
    if (typeof payload.score !== 'number' || isNaN(payload.score) || !Number.isInteger(payload.score)) {
      return { isValid: false, reason: 'Score must be a valid integer' };
    }
    if (payload.score < 0) {
      return { isValid: false, reason: 'Negative scores are impossible' };
    }
    if (payload.score > 100000) {
      return { isValid: false, reason: 'Score exceeds physical single-run threshold' };
    }

    // 2. Combo & gate metrics sanity
    if (payload.maxCombo < 1 || payload.maxCombo > Math.max(payload.score + 1, 1)) {
      return { isValid: false, reason: 'Max combo is inconsistent with gates passed' };
    }
    if (payload.perfectGates < 0 || payload.perfectGates > payload.score) {
      return { isValid: false, reason: 'Perfect gates count cannot exceed total score' };
    }
    if (payload.nearMisses < 0 || payload.nearMisses > payload.score) {
      return { isValid: false, reason: 'Near misses count cannot exceed total score' };
    }

    // 3. Timestamp check
    const now = Date.now();
    if (payload.timestamp > now + 15000) {
      return { isValid: false, reason: 'Submission timestamp is in the future' };
    }
    if (now - payload.timestamp > 86400000) {
      return { isValid: false, reason: 'Submission timestamp is stale (> 24h old)' };
    }

    // 4. Session Verification
    if (!payload.sessionId || !payload.sessionToken) {
      return { isValid: false, reason: 'Missing session authentication' };
    }

    const session = db.getSession(payload.sessionId);
    if (!session) {
      return { isValid: false, reason: 'Session not found. Score must originate from an authorized game flight.' };
    }

    if (session.used === 1) {
      return { isValid: false, reason: 'Duplicate score submission. This flight session has already been recorded.' };
    }

    if (session.player_id !== payload.playerId) {
      return { isValid: false, reason: 'Session identity mismatch' };
    }

    if (session.token !== payload.sessionToken) {
      return { isValid: false, reason: 'Invalid session token signature' };
    }

    // 5. Temporal duration check
    const elapsedSeconds = (now - session.start_time) / 1000;
    // Allow slight network latency grace period of 5 seconds
    if (payload.durationSeconds > elapsedSeconds + 5) {
      return { isValid: false, reason: 'Reported run duration exceeds actual wall-clock elapsed time' };
    }

    // 6. Flight speed / gate progression rate check
    // In Sky Hopper, gate spacing is >= 320px and max flight speed is 200px/s.
    // The theoretical maximum rate of gates is ~0.62 gates/sec, capped at 3.0 gates/sec with boost/time attack.
    if (payload.score > 2) {
      const minDurationRequired = (payload.score - 1) / 3.0; // At most 3 gates/second
      if (payload.durationSeconds < minDurationRequired) {
        return {
          isValid: false,
          reason: `Impossible score jump: scored ${payload.score} in only ${payload.durationSeconds.toFixed(1)}s`,
        };
      }
    }

    return { isValid: true };
  }
}

export const antiCheat = new AntiCheatValidator();
