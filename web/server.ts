import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { app } from './src/server/app.ts';
import { initializeDatabase } from './src/lib/db.ts';

dotenv.config();

const PORT = 3000;

async function startServer() {
  // Initialize Neon PostgreSQL database service on boot
  await initializeDatabase();

  // ---------------------------------------------------------
  // VITE MIDDLEWARE SETUP (Development HMR & Production Static Hosting)
  // ---------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Phasebook server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
