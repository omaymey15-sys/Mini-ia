const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authenticateApiKey } = require('../middleware/api-key-auth');
const { rateLimiter } = require('../middleware/rate-limit');
const IAService = require('../services/ia-service');
const SearchService = require('../services/search-service');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Seuls les fichiers PDF sont acceptés'));
  }
});

// ============================================================
// CHAT
// ============================================================
router.post('/chat', rateLimiter, authenticateApiKey, async (req, res) => {
  try {
    const { message, session_id, style, image_search, language } = req.body;
    const pool = req.app.get('pool');

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message requis' });
    }

    const sessionId = session_id || uuidv4();
    const iaService = new IAService(pool);
    const result = await iaService.processMessage(message, sessionId, 'api', {
      style: style || 'professional',
      imageSearch: image_search || 'auto',
      language: language || 'fr'
    });

    await pool.query(
      `INSERT INTO conversations (user_id, session_id, platform, messages, message_count, style, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.apiKey?.user?.id || null,
        sessionId,
        'api',
        JSON.stringify([
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: result.finalResponse, timestamp: new Date().toISOString() }
        ]),
        2,
        style || 'professional',
        JSON.stringify({ version: '5.0.0', imagesFound: result.imagesFound || 0 })
      ]
    );

    res.json({
      success: true,
      data: {
        message: result.finalResponse,
        analysis: result.analysis,
        searchPerformed: result.searchPerformed,
        imagesFound: result.imagesFound || 0,
        processingTime: result.processingTime,
        session_id: sessionId
      }
    });
  } catch (error) {
    console.error('Erreur chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// HISTORIQUE CONVERSATIONS
// ============================================================
router.get('/chat/history', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT id, session_id, title, platform, message_count, style, created_at, updated_at
       FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT $2`,
      [req.user.id, limit]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// RECHERCHE IMAGES
// ============================================================
router.get('/images/search', rateLimiter, async (req, res) => {
  try {
    const { q, limit = 6, source } = req.query;
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Requête de recherche requise (min 2 caractères)' });
    }

    const pool = req.app.get('pool');
    const queryHash = crypto.createHash('sha256').update(q.toLowerCase().trim()).digest('hex');

    // Vérifier le cache
    const cached = await pool.query(
      'SELECT images, image_count FROM image_cache WHERE query_hash = $1 AND expires_at > NOW()',
      [queryHash]
    );

    if (cached.rows.length > 0) {
      return res.json({
        success: true,
        query: q,
        source: 'cache',
        count: cached.rows[0].image_count,
        data: cached.rows[0].images
      });
    }

    // Rechercher sur les sources
    const images = [];
    const sources = [];

    // Unsplash
    if (!source || source === 'unsplash') {
      try {
        const unsplashUrl = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(q)}&per_page=${Math.ceil(limit / 2)}&orientation=landscape`;
        const unsplashRes = await fetch(unsplashUrl);
        const unsplashData = await unsplashRes.json();
        if (unsplashData.results) {
          sources.push('Unsplash');
          unsplashData.results.forEach(img => {
            images.push({
              url: img.urls?.regular || img.urls?.small || '',
              thumbnail: img.urls?.thumb || '',
              title: img.alt_description || img.description || q,
              width: img.width || 800,
              height: img.height || 600,
              color: img.color || '#6366f1',
              author: img.user?.name || 'Unsplash',
              authorUrl: img.user?.links?.html || '',
              source: 'Unsplash',
              license: 'Unsplash License'
            });
          });
        }
      } catch (e) {
        console.log('Unsplash indisponible');
      }
    }

    // Wikipedia
    if (!source || source === 'wikipedia') {
      try {
        const wikiUrl = `https://fr.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(q)}&prop=pageimages&format=json&pithumbsize=500&origin=*`;
        const wikiRes = await fetch(wikiUrl);
        const wikiData = await wikiRes.json();
        if (wikiData.query?.pages) {
          sources.push('Wikipedia');
          for (let page of Object.values(wikiData.query.pages)) {
            if (page.thumbnail && images.length < limit) {
              images.push({
                url: page.thumbnail.source,
                thumbnail: page.thumbnail.source,
                title: page.title || q,
                width: page.thumbnail.width || 500,
                height: page.thumbnail.height || 300,
                source: 'Wikipedia',
                license: 'CC BY-SA'
              });
            }
          }
        }
      } catch (e) {
        console.log('Wikipedia indisponible');
      }
    }

    // Mettre en cache
    if (images.length > 0) {
      await pool.query(
        `INSERT INTO image_cache (query_hash, query_text, images, image_count, sources)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (query_hash) DO UPDATE 
         SET images = $3, image_count = $4, sources = $5, expires_at = NOW() + INTERVAL '24 hours'`,
        [queryHash, q, JSON.stringify(images), images.length, sources]
      );
    }

    res.json({
      success: true,
      query: q,
      source: sources.length > 0 ? sources.join(', ') : 'none',
      count: images.length,
      data: images.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error('Erreur recherche images:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// QUESTIONS / RÉPONSES
// ============================================================
router.post('/qa', rateLimiter, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { question, answer, intent, entities, sentiment, language, source, confidence, images_found } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ error: 'Question et réponse requises' });
    }

    const existing = await pool.query('SELECT id, count FROM qa_pairs WHERE question = $1', [question]);

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE qa_pairs SET answer = $1, count = count + 1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [answer, existing.rows[0].id]
      );
    } else {
      result = await pool.query(
        `INSERT INTO qa_pairs (question, answer, intent, entities, sentiment, language, source, confidence, images_found)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [question, answer, intent || 'unknown', JSON.stringify(entities || {}),
         sentiment || 'neutre', language || 'fr', source || 'web', confidence || 0.5, images_found || 0]
      );
    }

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/qa', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const intent = req.query.intent;

    let query = 'SELECT * FROM qa_pairs WHERE 1=1';
    const params = [];
    let c = 1;

    if (intent) { query += ` AND intent = $${c++}`; params.push(intent); }

    query += ` ORDER BY created_at DESC LIMIT $${c++} OFFSET $${c++}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    const countRes = await pool.query(
      'SELECT COUNT(*) FROM qa_pairs' + (intent ? ' WHERE intent = $1' : ''),
      intent ? [intent] : []
    );

    res.json({
      success: true,
      count: result.rows.length,
      total: parseInt(countRes.rows[0].count),
      data: result.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/qa/search', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Recherche trop courte (min 2 caractères)' });
    }

    const result = await pool.query(
      `SELECT *, ts_rank(to_tsvector('french', question), plainto_tsquery('french', $1)) as rank
       FROM qa_pairs 
       WHERE to_tsvector('french', question) @@ plainto_tsquery('french', $1)
          OR to_tsvector('french', answer) @@ plainto_tsquery('french', $1)
          OR question ILIKE $2 OR answer ILIKE $2
       ORDER BY rank DESC, count DESC LIMIT $3`,
      [q, '%' + q + '%', limit]
    );

    res.json({ success: true, query: q, count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DOCUMENTS
// ============================================================
router.post('/documents/upload', authenticate, upload.single('pdf'), async (req, res) => {
  try {
    const pool = req.app.get('pool');
    if (!req.file) return res.status(400).json({ error: 'Fichier PDF requis' });

    const pdfBuffer = req.file.buffer;
    let extractedText = '';
    let pageCount = 0;

    try {
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text;
      pageCount = pdfData.numpages;
    } catch (e) {
      extractedText = '[Extraction impossible]';
    }

    const result = await pool.query(
      `INSERT INTO documents (user_id, filename, original_name, content, file_data, category, file_size, pages)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, filename, original_name, category, file_size, pages, created_at`,
      [req.user.id, req.file.originalname, req.file.originalname, extractedText, pdfBuffer,
       req.body.category || 'general', req.file.size, pageCount]
    );

    res.status(201).json({
      success: true,
      data: { ...result.rows[0], textLength: extractedText.length }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/documents', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const result = await pool.query(
      'SELECT id, filename, original_name, category, file_size, pages, created_at FROM documents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CONNAISSANCES
// ============================================================
router.get('/knowledge/search', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Recherche trop courte' });
    }

    const keywords = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (keywords.length === 0) return res.json({ success: true, data: [] });

    const result = await pool.query(
      `SELECT DISTINCT ON (sentence) * FROM knowledge 
       WHERE keyword = ANY($1) ORDER BY sentence, reliability DESC LIMIT $2`,
      [keywords, limit]
    );

    res.json({ success: true, query: q, count: result.rows.length, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// FEEDBACK
// ============================================================
router.post('/feedback', rateLimiter, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { qa_id, rating, comment, platform } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Note entre 1 et 5 requise' });
    }

    const result = await pool.query(
      'INSERT INTO feedback (qa_id, rating, comment, platform) VALUES ($1, $2, $3, $4) RETURNING *',
      [qa_id, rating, comment, platform || 'web']
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// STATISTIQUES
// ============================================================
router.get('/stats', async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM qa_pairs) as qa_pairs,
        (SELECT COUNT(*) FROM documents) as documents,
        (SELECT COUNT(*) FROM knowledge) as knowledge_items,
        (SELECT COUNT(*) FROM image_cache) as cached_images,
        (SELECT COUNT(*) FROM conversations) as conversations,
        (SELECT COUNT(*) FROM telegram_users) as telegram_users,
        (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM feedback) as avg_rating,
        (SELECT COUNT(*) FROM api_usage_logs WHERE created_at > NOW() - INTERVAL '24 hours') as api_calls_24h
    `);

    const topIntents = await pool.query(
      'SELECT intent, COUNT(*) as count FROM qa_pairs GROUP BY intent ORDER BY count DESC LIMIT 10'
    );

    res.json({
      success: true,
      data: { ...stats.rows[0], top_intents: topIntents.rows }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// EXPORT
// ============================================================
router.get('/export', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const userId = req.user.id;

    const [qa, docs, conversations] = await Promise.all([
      pool.query('SELECT * FROM qa_pairs WHERE user_id = $1 ORDER BY id', [userId]),
      pool.query('SELECT id, filename, content, category, pages FROM documents WHERE user_id = $1', [userId]),
      pool.query('SELECT * FROM conversations WHERE user_id = $1 ORDER BY id', [userId])
    ]);

    res.json({
      success: true,
      data: {
        exportDate: new Date().toISOString(),
        version: '5.0.0',
        qa_pairs: qa.rows,
        documents: docs.rows,
        conversations: conversations.rows
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// APPRENTISSAGE
// ============================================================
router.post('/learn', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const iaService = new IAService(pool);
    const results = await iaService.globalLearning();

    await pool.query(
      'INSERT INTO learning_metrics (metric_name, metric_value, details) VALUES ($1, $2, $3)',
      ['global_learning', results.total_qa || 0, JSON.stringify(results)]
    );

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/metrics', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const result = await pool.query(
      'SELECT * FROM learning_metrics ORDER BY created_at DESC LIMIT 30'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// SANTÉ
// ============================================================
router.get('/ping', (req, res) => {
  res.json({ status: 'pong', version: '5.0.0', timestamp: new Date().toISOString() });
});

module.exports = router;
