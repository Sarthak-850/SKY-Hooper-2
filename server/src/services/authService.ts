/**
 * Authentication Service
 * Secure user registration, password hashing (bcrypt), login, and JWT generation.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../database/index.ts';
import { config } from '../config/env.ts';
import { AuthTokenPayload, UserPublic, PlayerProfile } from '../types/index.ts';
import { findCountry } from '../utils/countries.ts';
import { recalculateCountryStats } from '../database/seed.ts';

export class AuthService {
  /**
   * Register a new player account
   */
  public async register(params: {
    username: string;
    email: string;
    password: string;
    countryCode: string;
    countryName?: string;
  }): Promise<{ user: UserPublic; profile: PlayerProfile; token: string }> {
    const cleanUsername = params.username.trim();
    const cleanEmail = params.email.trim().toLowerCase();
    const country = findCountry(params.countryCode);
    const countryName = params.countryName || country.name;

    // Validate inputs
    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      throw { status: 400, code: 'INVALID_USERNAME', message: 'Username must be between 3 and 30 characters.' };
    }
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length > 255) {
      throw { status: 400, code: 'INVALID_EMAIL', message: 'Please provide a valid email address.' };
    }
    if (!params.password || params.password.length < 6) {
      throw { status: 400, code: 'WEAK_PASSWORD', message: 'Password must be at least 6 characters.' };
    }

    // Check existing email
    const emailCheck = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [cleanEmail]
    );
    if (emailCheck.rows.length > 0) {
      throw { status: 409, code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' };
    }

    // Check existing username
    const usernameCheck = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [cleanUsername]
    );
    if (usernameCheck.rows.length > 0) {
      throw { status: 409, code: 'USERNAME_EXISTS', message: 'This username is already taken. Please choose another.' };
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(params.password, 10);
    const userId = `usr_${crypto.randomUUID()}`;
    const profileId = `prf_${crypto.randomUUID()}`;

    // Execute atomic user & profile creation in transaction
    await db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, username, email, password_hash, country_code, country_name, avatar, created_at, updated_at, last_active_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW(), NOW())`,
        [userId, cleanUsername, cleanEmail, passwordHash, country.code, countryName, 'default_pilot']
      );

      await tx.query(
        `INSERT INTO player_profiles (id, user_id, display_name, country_code, country_name, avatar, best_score, total_games, total_score, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 0, 0, NOW(), NOW())`,
        [profileId, userId, cleanUsername, country.code, countryName, 'default_pilot']
      );
    });

    // Update country aggregates
    recalculateCountryStats().catch((err) => console.warn('Recalculate country stats error:', err));

    const user: UserPublic = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      countryCode: country.code,
      countryName,
      avatar: 'default_pilot',
      createdAt: new Date(),
      lastActiveAt: new Date(),
    };

    const profile: PlayerProfile = {
      id: profileId,
      userId,
      displayName: cleanUsername,
      countryCode: country.code,
      countryName,
      avatar: 'default_pilot',
      bestScore: 0,
      totalGames: 0,
      totalScore: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const token = this.generateToken({
      userId,
      username: cleanUsername,
      countryCode: country.code,
    });

    return { user, profile, token };
  }

  /**
   * Log in with email or username and password
   */
  public async login(loginIdentifier: string, password: string): Promise<{ user: UserPublic; profile: PlayerProfile; token: string }> {
    const cleanId = loginIdentifier.trim();
    if (!cleanId || !password) {
      throw { status: 400, code: 'INVALID_CREDENTIALS', message: 'Please provide both username/email and password.' };
    }

    const res = await db.query(
      `SELECT id, username, email, password_hash, country_code, country_name, avatar, created_at, last_active_at
       FROM users
       WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)`,
      [cleanId]
    );

    if (res.rows.length === 0) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username, email, or password.' };
    }

    const row = res.rows[0];
    const passwordMatch = await bcrypt.compare(password, row.password_hash);
    if (!passwordMatch) {
      throw { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username, email, or password.' };
    }

    // Update last_active_at
    await db.query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [row.id]);

    // Fetch player profile
    const profileRes = await db.query(
      `SELECT id, user_id AS "userId", display_name AS "displayName", country_code AS "countryCode",
              country_name AS "countryName", avatar, best_score AS "bestScore", total_games AS "totalGames",
              total_score AS "totalScore", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM player_profiles
       WHERE user_id = $1`,
      [row.id]
    );

    const profile: PlayerProfile = profileRes.rows[0];
    const user: UserPublic = {
      id: row.id,
      username: row.username,
      email: row.email,
      countryCode: row.country_code,
      countryName: row.country_name,
      avatar: row.avatar,
      createdAt: row.created_at,
      lastActiveAt: new Date(),
    };

    const token = this.generateToken({
      userId: user.id,
      username: user.username,
      countryCode: user.countryCode,
    });

    return { user, profile, token };
  }

  /**
   * Generate signed JWT
   */
  public generateToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: config.jwtExpiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify signed JWT
   */
  public verifyToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
    } catch {
      throw { status: 401, code: 'UNAUTHORIZED', message: 'Session expired or token is invalid. Please log in again.' };
    }
  }
}

export const authService = new AuthService();
