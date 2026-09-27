-- Migration 001: Initial Schema for SKY-Hooper Backend
-- Compatible with standard PostgreSQL 14+ and PGlite

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    avatar VARCHAR(255) DEFAULT 'default_pilot',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_country ON users(country_code);

-- 2. Player Profiles Table
CREATE TABLE IF NOT EXISTS player_profiles (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    country_name VARCHAR(100) NOT NULL,
    avatar VARCHAR(255) DEFAULT 'default_pilot',
    best_score INTEGER NOT NULL DEFAULT 0,
    total_games INTEGER NOT NULL DEFAULT 0,
    total_score BIGINT NOT NULL DEFAULT 0,
    last_country_change_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON player_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_best_score_desc ON player_profiles(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_country_score ON player_profiles(country_code, best_score DESC);

-- 3. Game Sessions Table
CREATE TABLE IF NOT EXISTS game_sessions (
    id VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    final_score INTEGER,
    duration REAL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'ABANDONED'
    validation_status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VALID', 'SUSPICIOUS', 'REJECTED'
    anti_cheat_flags TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created_at ON game_sessions(created_at DESC);

-- 4. Scores Table
CREATE TABLE IF NOT EXISTS scores (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_session_id VARCHAR(128) UNIQUE REFERENCES game_sessions(id) ON DELETE SET NULL,
    score INTEGER NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);
CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_scores_country_code ON scores(country_code);
CREATE INDEX IF NOT EXISTS idx_scores_created_at ON scores(created_at DESC);

-- 5. Countries Table
CREATE TABLE IF NOT EXISTS countries (
    code VARCHAR(2) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    flag VARCHAR(10) NOT NULL,
    player_count INTEGER NOT NULL DEFAULT 0,
    total_score BIGINT NOT NULL DEFAULT 0,
    average_score REAL NOT NULL DEFAULT 0,
    best_score INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_countries_total_score ON countries(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_countries_avg_score ON countries(average_score DESC);
CREATE INDEX IF NOT EXISTS idx_countries_best_score ON countries(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_countries_player_count ON countries(player_count DESC);
