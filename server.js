// server.js — JARVIS 5.0 Express Server for Railway
// Wraps the Vercel-style handler into a standard Express app
// © Ctrl Labs (Hussein & Claude)

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import handler from './api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── Parse JSON bodies ──
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ── CORS ──
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── API Routes — map all /api/* to the unified handler ──
// Converts Express req/res to Vercel-compatible format
function toVercelReq(req) {
  return {
    method: req.method,
    body: req.body,
    query: { ...req.query, ...req.params },
    headers: req.headers,
  };
}

function toVercelRes(res) {
  const vres = {
    statusCode: 200,
    _headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this._headers[k] = v; res.setHeader(k, v); return this; },
    json(data) { res.status(this.statusCode).json(data); },
    end() { res.status(this.statusCode).end(); },
    send(data) { res.status(this.statusCode).send(data); },
  };
  return vres;
}

// All /api/* routes → handler with ?route= param
const apiRoutes = {
  '/api/chat':          'chat',
  '/api/generate-image':'image',
  '/api/music':         'music',
  '/api/weather':       'weather',
  '/api/news':          'news',
  '/api/websearch':     'search',
  '/api/analyze-doc':   'analyze',
  '/api/cv':            'cv',
  '/api/website':       'website',
  '/api/document':      'document',
  '/api/agent':         'agent',
};

Object.entries(apiRoutes).forEach(([path, route]) => {
  app.all(path, async (req, res) => {
    const vreq = toVercelReq(req);
    vreq.query.route = route;
    const vres = toVercelRes(res);
    try {
      await handler(vreq, vres);
    } catch(e) {
      console.error(`Error on ${path}:`, e.message);
      res.status(500).json({ error: 'Internal error', details: e.message });
    }
  });
});

// Intelligence endpoint
app.all('/api/intelligence', async (req, res) => {
  try {
    const { default: intelligenceHandler } = await import('./api/intelligence.js');
    const vreq = toVercelReq(req);
    const vres = toVercelRes(res);
    await intelligenceHandler(vreq, vres);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Static files — serve the frontend ──
app.use(express.static(__dirname, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ── SPA fallback — serve index.html for all non-API routes ──
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`\n🤖 JARVIS 5.0 running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   API keys loaded: ${[
    process.env.GROQ_KEY_1 ? 'Groq' : '',
    process.env.CEREBRAS_KEY ? 'Cerebras' : '',
    process.env.OPENAI_KEY ? 'OpenAI' : '',
    process.env.GEMINI_KEY_1 ? 'Gemini' : '',
    process.env.MISTRAL_KEY ? 'Mistral' : '',
  ].filter(Boolean).join(', ') || 'none (add to Railway Variables)'}\n`);
});
