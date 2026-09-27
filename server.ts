/**
 * Sky Hopper - Production & Standalone Express Server
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { apiRouter } from './server/api.ts';

const app = express();
const PORT = process.env.PORT || 3000;

// Mount API routes
app.use('/api', apiRouter);

// Serve static assets from Vite build output if present
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.send('Sky Hopper API Server is running. Start the Vite dev server with `npm run dev` to view the game.');
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Sky Hopper Server running at http://localhost:${PORT}`);
});
