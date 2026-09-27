/**
 * Sky Hopper - Production Backend Server Entrypoint
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import { app } from './app.ts';
import { config } from './config/env.ts';
import { wsServer } from './websocket/wsServer.ts';
import { runMigrations } from './database/migrate.ts';
import { db } from './database/index.ts';

const server = http.createServer(app);

// Attach WebSocket server at /ws
wsServer.init(server);

// If client build exists in /dist, serve it statically for standalone production deployment
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function startServer() {
  try {
    // 1. Initialize database and ensure migrations are applied
    await runMigrations();

    // 2. Start HTTP & WebSocket server
    server.listen(config.port, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Sky Hopper Backend Server running on port ${config.port}`);
      console.log(`🌐 API Base URL:       http://localhost:${config.port}/api`);
      console.log(`📡 WebSocket Stream:   ws://localhost:${config.port}/ws`);
      console.log(`🩺 Health Endpoint:    http://localhost:${config.port}/api/health`);
      console.log(`🌍 Environment:        ${config.nodeEnv}`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server gracefully...');
  wsServer.close();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down...');
  wsServer.close();
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
});

startServer();
