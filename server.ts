import express from 'express';
import compression from 'compression';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '.sims_data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // Read-only filesystem environments do not use local disk storage
}

async function startServer() {
  const app = express();
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));

  // REST endpoints for encrypted account & data sync across devices
  app.get('/api/storage/accts-check', (req, res) => {
    try {
      const files = fs.readdirSync(DATA_DIR);
      const hasAcct = files.some((f) => f.startsWith('accts_'));
      res.json({ hasAny: hasAcct });
    } catch (e) {
      res.json({ hasAny: false });
    }
  });

  const safePart = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');

  app.get('/api/storage/:collection/:id', (req, res) => {
    try {
      const collection = safePart(req.params.collection);
      const id = safePart(req.params.id);
      const filePath = path.join(DATA_DIR, `${collection}_${id}.json`);
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        res.json({ data: JSON.parse(raw) });
      } else {
        res.status(404).json({ error: 'Not found' });
      }
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.put('/api/storage/:collection/:id', (req, res) => {
    try {
      const collection = safePart(req.params.collection);
      const id = safePart(req.params.id);
      const filePath = path.join(DATA_DIR, `${collection}_${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(req.body.data), 'utf-8');
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/storage/:collection', (req, res) => {
    try {
      const collection = safePart(req.params.collection);
      const prefix = `${collection}_`;
      const files = fs.readdirSync(DATA_DIR);
      const rows: Array<[string, unknown]> = [];
      for (const f of files) {
        if (f.startsWith(prefix) && f.endsWith('.json')) {
          const id = f.slice(prefix.length, -5);
          const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf-8');
          rows.push([id, JSON.parse(raw)]);
        }
      }
      res.json({ rows });
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  });

  const distDir = path.join(__dirname, 'dist');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
