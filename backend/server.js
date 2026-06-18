require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Base de données
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
app.set('pool', pool);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || '*',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://web.telegram.org'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/developer', require('./routes/developer'));

// Santé
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM qa_pairs) as qa_pairs,
        (SELECT COUNT(*) FROM documents) as documents,
        (SELECT COUNT(*) FROM knowledge) as knowledge_items
    `);
    
    res.json({
      status: 'ok',
      version: '5.0.0',
      architecture: '20 IA',
      timestamp: dbResult.rows[0].now,
      uptime: process.uptime(),
      database: 'connected',
      telegram: global.telegramBot ? 'connected' : 'disconnected',
      stats: stats.rows[0],
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Documentation
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Mini ChatGPT API V5',
    version: '5.0.0',
    architecture: '20 couches d\'IA avec recherche images',
    baseUrl: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
    endpoints: {
      chat: { method: 'POST', path: '/api/chat', auth: 'API Key', description: 'Envoyer un message (texte + images)' },
      qa: { method: 'GET', path: '/api/qa', description: 'Liste Q/R' },
      search: { method: 'GET', path: '/api/qa/search?q=', description: 'Recherche' },
      images: { method: 'GET', path: '/api/images/search?q=', description: 'Recherche images' },
      documents: { method: 'POST', path: '/api/documents/upload', auth: 'JWT', description: 'Upload PDF' },
      knowledge: { method: 'GET', path: '/api/knowledge/search?q=', description: 'Base connaissances' },
      stats: { method: 'GET', path: '/api/stats', description: 'Statistiques' },
      export: { method: 'GET', path: '/api/export', auth: 'JWT', description: 'Export données' },
      telegram: { method: 'POST', path: '/api/telegram/webhook', description: 'Webhook Telegram' }
    },
    sdks: {
      javascript: `const client = new MiniChatGPT({ apiKey: 'mcp_v5_YOUR_KEY' });\nconst response = await client.chat('Montre-moi des images de Paris');\nconsole.log(response.message);`,
      python: `from minichatgpt import MiniChatGPT\nclient = MiniChatGPT(api_key='mcp_v5_YOUR_KEY')\nresponse = client.chat('Montre-moi des images de Paris')\nprint(response.message)`,
      curl: `curl -X POST https://api.minichatgpt.com/api/chat -H "Content-Type: application/json" -H "X-API-Key: mcp_v5_YOUR_KEY" -d '{"message":"Montre-moi des images de Paris"}'`
    }
  });
});

// 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée', docs: '/api/docs' });
});

// Erreurs
app.use((error, req, res, next) => {
  console.error('Erreur:', error);
  res.status(500).json({
    error: 'Erreur interne',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
  });
});

// Démarrage
async function start() {
  console.log('\n🚀 Mini ChatGPT V5.0 — 20 IA avec Recherche Images\n');
  
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Base de données connectée');
  } catch (e) {
    console.warn('⚠️ Base de données non disponible');
  }

  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      const { initTelegramBot } = require('./services/telegram-service');
      await initTelegramBot(app, pool);
      console.log('✅ Bot Telegram initialisé');
    } catch (e) {
      console.warn('⚠️ Bot Telegram non configuré');
    }
  }

  app.listen(PORT, () => {
    console.log(`\n🌟 Serveur sur le port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
    console.log(`📚 Docs: http://localhost:${PORT}/api/docs`);
    console.log(`🖼️  Images: http://localhost:${PORT}/api/images/search?q=\n`);
  });
}

start().catch(console.error);
module.exports = app;
