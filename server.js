import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './api/index.js';
import { isDatabaseConfigured, checkDatabaseHealth } from './services/db.js';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/api/health', async (req, res) => {
  const dbConfigured = isDatabaseConfigured();
  const dbHealth = dbConfigured ? await checkDatabaseHealth() : { healthy: false, error: "DATABASE_URL not set" };
  
  res.json({
    status: dbHealth.healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    database: {
      configured: dbConfigured,
      healthy: dbHealth.healthy,
      error: dbHealth.error || null
    },
    environment: process.env.NODE_ENV || 'production'
  });
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from root directory
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(__dirname));

// API routes - handle /api/* with query.route parameter
app.all('/api/*', (req, res) => {
  const routePath = req.path.replace(/^\/api/, '').replace(/^\/+/, '');
  req.query = {
    ...req.query,
    route: routePath
  };
  return apiRouter(req, res);
});

// Serve index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve app.html for authenticated routes
app.get('/app.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'app.html'));
});

// Serve static HTML files
app.get('/:file.html', (req, res) => {
  const filePath = path.join(__dirname, `${req.params.file}.html`);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).sendFile(path.join(__dirname, 'index.html'));
    }
  });
});

// 404 handler - serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Only start server in non-Vercel environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
