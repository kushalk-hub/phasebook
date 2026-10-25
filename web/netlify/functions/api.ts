import serverless from 'serverless-http';
import { app } from '../../src/server/app.ts';
import { initializeDatabase } from '../../src/lib/db.ts';

// Pre-warm database connection if DATABASE_URL is configured
if (process.env.DATABASE_URL) {
  initializeDatabase().catch((err: any) => {
    console.warn('[Netlify Function] Database connection pre-warm note:', err?.message);
  });
}

// Serverless handler for Netlify Functions routing
export const handler = serverless(app);
