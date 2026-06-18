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

// ============================================================
// ROUTE RACINE — Page d'accueil
// ============================================================
app.get('/', (req, res) => {
  res.json({
    name: 'Mini ChatGPT API V5.0',
    version: '5.0.0',
    architecture: '20 couches d\'IA avec recherche images',
    status: 'online',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      health: '/api/health',
      docs: '/api/docs',
      chat: '/api/chat',
      images: '/api/images/search?q=',
      qa: '/api/qa',
      knowledge: '/api/knowledge/search?q=',
      stats: '/api/stats',
      export: '/api/export',
      telegram: '/api/telegram/webhook',
      auth: '/api/auth/login'
    },
    frontend: process.env.FRONTEND_URL || 'http://localhost:10000',
    message: '🚀 Bienvenue sur l\'API Mini ChatGPT V5.0 !',
    tip: 'Consultez /api/docs pour la documentation complète.',
    quickStart: {
      curl: 'curl -X POST ' + (process.env.FRONTEND_URL || 'http://localhost:10000') + '/api/chat -H "Content-Type: application/json" -d \'{"message":"Bonjour"}\'',
      javascript: `fetch('${process.env.FRONTEND_URL || 'http://localhost:10000'}/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Bonjour' }) }).then(r => r.json()).then(console.log)`
    }
  });
});

// ============================================================
// ROUTES API
// ============================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));
app.use('/api/telegram', require('./routes/telegram'));
app.use('/api/developer', require('./routes/developer'));

// ============================================================
// SANTÉ
// ============================================================
app.get('/api/health', async (req, res) => {
  try {
    const dbResult = await pool.query('SELECT NOW()');
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM qa_pairs) as qa_pairs,
        (SELECT COUNT(*) FROM documents) as documents,
        (SELECT COUNT(*) FROM knowledge) as knowledge_items,
        (SELECT COUNT(*) FROM image_cache) as cached_images
    `);
    
    res.json({
      status: 'ok',
      version: '5.0.0',
      architecture: '20 IA',
      timestamp: dbResult.rows[0].now,
      uptime: Math.floor(process.uptime()),
      database: 'connected',
      telegram: global.telegramBot ? 'connected' : 'disconnected',
      stats: stats.rows[0],
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
      }
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message,
      database: 'disconnected'
    });
  }
});

// ============================================================
// DOCUMENTATION
// ============================================================
app.get('/api/docs', (req, res) => {
  res.json({
    name: 'Mini ChatGPT API V5',
    version: '5.0.0',
    architecture: '20 couches d\'IA avec recherche images',
    baseUrl: process.env.FRONTEND_URL || `http://localhost:${PORT}`,
    authentication: {
      type: 'API Key',
      header: 'X-API-Key',
      example: 'X-API-Key: mcp_v5_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      getKey: '/api/developer/keys (après connexion)'
    },
    endpoints: {
      chat: {
        method: 'POST',
        path: '/api/chat',
        auth: 'API Key',
        description: 'Envoyer un message au chatbot (texte + images)',
        body: {
          message: 'string (required)',
          session_id: 'string (optional)',
          style: 'professional | academic | casual | technical',
          image_search: 'auto | always | never',
          language: 'fr | en'
        },
        example: `curl -X POST ${process.env.FRONTEND_URL || 'http://localhost:10000'}/api/chat \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: mcp_v5_YOUR_KEY" \\
  -d '{"message":"Montre-moi des images de Paris","style":"professional"}'`
      },
      images: {
        method: 'GET',
        path: '/api/images/search?q=tour+eiffel&limit=6',
        description: 'Rechercher des images',
        params: {
          q: 'string (required) - Requête de recherche',
          limit: 'integer (optional) - Nombre max d\'images (défaut: 6)',
          source: 'unsplash | wikipedia (optional)'
        }
      },
      qa: {
        method: 'GET',
        path: '/api/qa',
        description: 'Lister les questions/réponses'
      },
      qa_search: {
        method: 'GET',
        path: '/api/qa/search?q=recherche&limit=20',
        description: 'Rechercher dans les Q/R'
      },
      knowledge: {
        method: 'GET',
        path: '/api/knowledge/search?q=motclé',
        description: 'Rechercher dans la base de connaissances'
      },
      documents: {
        method: 'POST',
        path: '/api/documents/upload',
        auth: 'JWT',
        description: 'Uploader un PDF'
      },
      stats: {
        method: 'GET',
        path: '/api/stats',
        description: 'Statistiques globales'
      },
      export: {
        method: 'GET',
        path: '/api/export',
        auth: 'JWT',
        description: 'Exporter toutes les données'
      },
      telegram: {
        method: 'POST',
        path: '/api/telegram/webhook',
        description: 'Webhook Telegram'
      },
      auth: {
        register: { method: 'POST', path: '/api/auth/register' },
        login: { method: 'POST', path: '/api/auth/login' },
        me: { method: 'GET', path: '/api/auth/me', auth: 'JWT' }
      },
      developer: {
        dashboard: { method: 'GET', path: '/api/developer/dashboard', auth: 'JWT' },
        keys: { method: 'POST', path: '/api/developer/keys', auth: 'JWT' },
        plans: { method: 'GET', path: '/api/developer/plans' }
      }
    },
    sdks: {
      javascript: `
const API_KEY = 'mcp_v5_YOUR_KEY';
const API_URL = '${process.env.FRONTEND_URL || 'http://localhost:10000'}';

async function chat(message, options = {}) {
  const response = await fetch(API_URL + '/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      message,
      style: options.style || 'professional',
      image_search: options.images || 'auto'
    })
  });
  return await response.json();
}

// Utilisation
const result = await chat('Montre-moi des images de Paris');
console.log(result.data.message);`,
      python: `
import requests

API_KEY = 'mcp_v5_YOUR_KEY'
API_URL = '${process.env.FRONTEND_URL || 'http://localhost:10000'}'

def chat(message, style='professional', image_search='auto'):
    response = requests.post(
        f'{API_URL}/api/chat',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        },
        json={
            'message': message,
            'style': style,
            'image_search': image_search
        }
    )
    return response.json()

# Utilisation
result = chat('Montre-moi des images de Paris')
print(result['data']['message'])`,
      curl: `curl -X POST ${process.env.FRONTEND_URL || 'http://localhost:10000'}/api/chat \\\\
  -H "Content-Type: application/json" \\\\
  -H "X-API-Key: mcp_v5_YOUR_KEY" \\\\
  -d '{"message":"Bonjour !","style":"professional","image_search":"auto"}'`
    },
    plans: {
      free: { calls: '1 000/mois', price: 'Gratuit', keys: 1, images: '50/mois' },
      pro: { calls: '50 000/mois', price: '9.99€/mois', keys: 10, images: '500/mois' },
      enterprise: { calls: '500 000/mois', price: '49.99€/mois', keys: 'Illimité', images: 'Illimité' }
    }
  });
});

// ============================================================
// 404
// ============================================================
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route non trouvée',
    message: `La route ${req.originalUrl} n'existe pas.`,
    docs: '/api/docs',
    tip: 'Consultez /api/docs pour voir tous les endpoints disponibles.'
  });
});

// ============================================================
// GESTION DES ERREURS
// ============================================================
app.use((error, req, res, next) => {
  console.error('❌ Erreur serveur:', error);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue',
    timestamp: new Date().toISOString()
  });
});

// ============================================================
// DÉMARRAGE
// ============================================================
async function start() {
  console.log('\n🚀 Mini ChatGPT V5.0 — 20 IA avec Recherche Images\n');
  console.log('📦 Initialisation...\n');
  
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Base de données connectée');
  } catch (e) {
    console.warn('⚠️ Base de données non disponible - mode dégradé');
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
    console.log(`\n🌟 Serveur démarré sur le port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}`);
    console.log(`🏠 Accueil: http://localhost:${PORT}/`);
    console.log(`📚 Docs: http://localhost:${PORT}/api/docs`);
    console.log(`💚 Santé: http://localhost:${PORT}/api/health`);
    console.log(`🖼️  Images: http://localhost:${PORT}/api/images/search?q=`);
    console.log(`\n✨ Prêt à recevoir des requêtes !\n`);
  });
}

start().catch(console.error);

module.exports = app;
