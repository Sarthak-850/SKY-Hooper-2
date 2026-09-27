# SKY-Hooper Backend API & Architecture Documentation

## 1. Overview & Backend Architecture

The SKY-Hooper backend is an authoritative, high-performance REST and WebSocket API built with **Node.js**, **Express**, **TypeScript**, and **PostgreSQL**.

It is the authoritative source for:
- User accounts & credentials (bcrypt password hashing, JWT authentication)
- Player profiles, avatars, and nation allegiances
- Game sessions and cryptographic anti-cheat validation
- Scores, personal bests, and career statistics
- Real-time global and national leaderboards
- Country-vs-Country competition rankings and automated aggregation

---

## 2. Database Schema (PostgreSQL)

The database schema is managed via reproducible SQL migrations located in `server/src/database/migrations/`.

### Tables

1. **`users`**
   - `id`: VARCHAR(64) PRIMARY KEY
   - `username`: VARCHAR(50) UNIQUE NOT NULL
   - `email`: VARCHAR(255) UNIQUE NOT NULL
   - `password_hash`: VARCHAR(255) NOT NULL
   - `country_code`: VARCHAR(2) NOT NULL
   - `country_name`: VARCHAR(100) NOT NULL
   - `avatar`: VARCHAR(255) DEFAULT 'default_pilot'
   - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
   - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
   - `last_active_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()

2. **`player_profiles`**
   - `id`: VARCHAR(64) PRIMARY KEY
   - `user_id`: VARCHAR(64) UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE
   - `display_name`: VARCHAR(100) NOT NULL
   - `country_code`: VARCHAR(2) NOT NULL
   - `country_name`: VARCHAR(100) NOT NULL
   - `avatar`: VARCHAR(255) DEFAULT 'default_pilot'
   - `best_score`: INTEGER NOT NULL DEFAULT 0
   - `total_games`: INTEGER NOT NULL DEFAULT 0
   - `total_score`: BIGINT NOT NULL DEFAULT 0
   - `last_country_change_at`: TIMESTAMPTZ
   - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
   - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()

3. **`game_sessions`**
   - `id`: VARCHAR(128) PRIMARY KEY
   - `user_id`: VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE
   - `started_at`: TIMESTAMPTZ NOT NULL
   - `ended_at`: TIMESTAMPTZ
   - `final_score`: INTEGER
   - `duration`: REAL
   - `status`: VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' (`ACTIVE`, `COMPLETED`, `ABANDONED`)
   - `validation_status`: VARCHAR(20) NOT NULL DEFAULT 'PENDING' (`PENDING`, `VALID`, `SUSPICIOUS`, `REJECTED`)
   - `anti_cheat_flags`: TEXT
   - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()

4. **`scores`**
   - `id`: VARCHAR(64) PRIMARY KEY
   - `user_id`: VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE
   - `game_session_id`: VARCHAR(128) UNIQUE REFERENCES game_sessions(id) ON DELETE SET NULL
   - `score`: INTEGER NOT NULL
   - `country_code`: VARCHAR(2) NOT NULL
   - `created_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()
   - *Indexes*: `user_id`, `score DESC`, `country_code`, `created_at DESC`

5. **`countries`**
   - `code`: VARCHAR(2) PRIMARY KEY
   - `name`: VARCHAR(100) NOT NULL
   - `flag`: VARCHAR(10) NOT NULL
   - `player_count`: INTEGER NOT NULL DEFAULT 0
   - `total_score`: BIGINT NOT NULL DEFAULT 0
   - `average_score`: REAL NOT NULL DEFAULT 0
   - `best_score`: INTEGER NOT NULL DEFAULT 0
   - `updated_at`: TIMESTAMPTZ NOT NULL DEFAULT NOW()

---

## 3. Environment Variables

Configure via `.env` file (see `.env.example`):

```bash
# Server port (default: 3000)
PORT=3000

# Environment mode ('development' or 'production')
NODE_ENV=development

# Database connection:
# Leave blank for embedded PostgreSQL (PGlite) for zero-dependency local dev/tests,
# or provide standard PostgreSQL connection string for production.
DATABASE_URL=postgresql://user:password@localhost:5432/skyhooper

# JWT Authentication secret (min 32 characters in production)
JWT_SECRET=sky-hooper-secure-development-jwt-secret-key-32chars
JWT_EXPIRES_IN=7d

# CORS allowed origins (comma-separated or '*' for any)
CORS_ORIGIN=*

# Anti-cheat thresholds
MAX_SCORE_RATE_PER_SEC=220
MIN_GAME_DURATION_SEC=3
MAX_ABSOLUTE_SCORE=1000000
COUNTRY_CHANGE_COOLDOWN_HOURS=24
```

---

## 4. API Endpoints

### 4.1 Health Check

#### `GET /api/health`
- **Auth**: None
- **Response**:
```json
{
  "status": "ok",
  "database": "connected",
  "engine": "PostgreSQL (Pool)",
  "uptime": 1284,
  "environment": "production",
  "timestamp": "2026-09-28T02:00:00.000Z"
}
```

---

### 4.2 Authentication

#### `POST /api/auth/register`
- **Auth**: None
- **Request Body**:
```json
{
  "username": "Maverick",
  "email": "pilot@example.com",
  "password": "Password123!",
  "countryCode": "IN",
  "countryName": "India"
}
```
- **Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_xxx",
      "username": "Maverick",
      "email": "pilot@example.com",
      "countryCode": "IN",
      "countryName": "India",
      "avatar": "default_pilot"
    },
    "profile": {
      "id": "prf_xxx",
      "bestScore": 0,
      "totalGames": 0,
      "totalScore": 0
    },
    "token": "eyJhbGciOi..."
  }
}
```

#### `POST /api/auth/login`
- **Auth**: None
- **Request Body**:
```json
{
  "loginIdentifier": "Maverick",
  "password": "Password123!"
}
```
- **Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "profile": { ... },
    "token": "eyJhbGciOi..."
  }
}
```

#### `POST /api/auth/logout`
- **Auth**: None
- **Response** `200 OK`: Clears cookie session.

#### `GET /api/auth/me`
- **Auth**: Bearer Token or Cookie
- **Response** `200 OK`: Authenticated profile and ranks.

---

### 4.3 Users & Profile

#### `GET /api/users/me`
- **Auth**: Bearer Token or Cookie
- **Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "id": "prf_xxx",
    "userId": "usr_xxx",
    "username": "Maverick",
    "displayName": "Maverick",
    "countryCode": "IN",
    "countryName": "India",
    "countryFlag": "🇮🇳",
    "bestScore": 18450,
    "totalGames": 24,
    "totalScore": 248900,
    "worldRank": 4,
    "countryRank": 2
  }
}
```

#### `PATCH /api/users/me`
- **Auth**: Bearer Token or Cookie
- **Request Body**:
```json
{
  "displayName": "Apex Commander",
  "avatar": "pilot_gold",
  "countryCode": "IN"
}
```
- Safeguards: Country changes enforce a 24-hour cooldown to prevent rating manipulation.

#### `GET /api/users/me/games?page=1&limit=20`
- **Auth**: Bearer Token or Cookie
- **Response** `200 OK`: Paginated previous flight history with scores, durations, and validation statuses.

#### `GET /api/users/me/stats`
- **Auth**: Bearer Token or Cookie
- **Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "bestScore": 18450,
    "totalGames": 24,
    "averageScore": 10370,
    "totalScore": 248900,
    "worldRank": 4,
    "countryRank": 2,
    "gamesThisWeek": 8,
    "gamesThisMonth": 24
  }
}
```

---

### 4.4 Game Sessions & Authoritative Scoring

#### `POST /api/games/start`
- **Auth**: Bearer Token or Cookie
- **Request Body**:
```json
{
  "gameMode": "CLASSIC"
}
```
- **Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_89f1...",
    "serverTimestamp": 1720000000000,
    "sessionConfig": {
      "gameMode": "CLASSIC",
      "maxScoreRate": 220,
      "minDuration": 3
    }
  }
}
```

#### `POST /api/games/finish`
- **Auth**: Bearer Token or Cookie
- **Request Body**:
```json
{
  "sessionId": "sess_89f1...",
  "score": 14200,
  "duration": 94.5,
  "metrics": {
    "maxCombo": 8,
    "perfectGates": 45,
    "nearMisses": 12,
    "stars": 38
  }
}
```
- **Server Validations**:
  1. Session exists and belongs to authenticated player.
  2. Session has not already been completed (prevents replay/duplicate attacks).
  3. Score is non-negative finite integer within absolute boundaries.
  4. Duration is reasonable (duration >= 3s).
  5. Score progression rate does not exceed physical game limit (max ~220 pts/sec).
- **Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "success": true,
    "score": 14200,
    "isNewBest": true,
    "previousBest": 12500,
    "worldRank": 6,
    "countryRank": 3,
    "message": "🎉 New Personal Best achieved!"
  }
}
```

---

### 4.5 Leaderboards & Competition

#### `GET /api/leaderboards/world?page=1&limit=50&search=...`
- **Auth**: None
- **Response**:
```json
{
  "success": true,
  "data": {
    "entries": [
      {
        "rank": 1,
        "playerId": "usr_kenji",
        "username": "kenji_blade",
        "displayName": "Kenji Takahashi",
        "countryCode": "JP",
        "countryName": "Japan",
        "countryFlag": "🇯🇵",
        "avatar": "default_pilot",
        "score": 21500,
        "updatedAt": "2026-09-28T01:50:00.000Z"
      }
    ],
    "total": 1284,
    "page": 1,
    "totalPages": 26
  }
}
```

#### `GET /api/leaderboards/country/:countryCode?page=1&limit=50`
- **Auth**: None
- **Example**: `GET /api/leaderboards/country/IN`
- **Response**: Filtered by nation, includes both `countryRank` and `worldRank`.

#### `GET /api/leaderboards/countries?sortBy=totalScore`
- **Auth**: None
- **Supported `sortBy`**: `totalScore`, `averageScore`, `bestScore`, `playerCount`
- **Response**:
```json
{
  "success": true,
  "data": {
    "metricUsed": "totalScore",
    "rankings": [
      {
        "rank": 1,
        "code": "IN",
        "name": "India",
        "flag": "🇮🇳",
        "playerCount": 5,
        "totalScore": 312000,
        "averageScore": 15534.0,
        "bestScore": 19850
      }
    ]
  }
}
```

#### `GET /api/leaderboards/me`
- **Auth**: Bearer Token or Cookie
- **Response**: World rank, country rank, and nearby bracket (`#85`, `#86`, `#87 YOU`, `#88`, `#89`).

#### `GET /api/leaderboards/search?q=...`
- **Auth**: None (Rate limited)
- **Response**: Matching players with current dynamic rankings.

---

### 4.6 Real-Time WebSocket Updates

- **URL**: `ws://<host>:<port>/ws` (or `wss://` in production)
- **Event**: `leaderboard:update`
- **Payload**:
```json
{
  "event": "leaderboard:update",
  "data": {
    "type": "NEW_HIGH_SCORE",
    "player": "Aarav Sharma",
    "country": "IN",
    "flag": "🇮🇳",
    "score": 19850,
    "worldRank": 2,
    "timestamp": 1720000000000
  }
}
```
- Includes fallback to Server-Sent Events (SSE) at `GET /api/leaderboard/live` for HTTP streaming clients.

---

## 5. Development & Production Operations

### Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run database migrations**:
   ```bash
   npm run db:migrate
   ```

3. **Seed development database**:
   ```bash
   npm run db:seed
   ```

4. **Run backend automated tests**:
   ```bash
   npm run test:backend
   ```

5. **Start full-stack dev server**:
   ```bash
   npm run dev
   ```

### Production Deployment

1. **Build frontend bundle**:
   ```bash
   npm run build
   ```

2. **Configure production environment variables in `.env` or cloud dashboard**:
   - `PORT=3000`
   - `NODE_ENV=production`
   - `DATABASE_URL=postgresql://user:password@host:5432/skyhooper?sslmode=require`
   - `JWT_SECRET=<strong-random-secret>`
   - `CORS_ORIGIN=https://your-domain.com`

3. **Start production server**:
   ```bash
   npm start
   ```
   (Runs `tsx server.ts`, automatically executes database migrations, serves static `/dist` frontend assets, mounts `/api` routes, and starts WebSocket `/ws` server).
