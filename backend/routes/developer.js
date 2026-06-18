const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ApiKeyService = require('../services/api-key-service');

router.get('/dashboard', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const apiKeyService = new ApiKeyService(pool);
    const [keys, usage] = await Promise.all([
      apiKeyService.listApiKeys(req.user.id),
      apiKeyService.getUsageStats(req.user.id)
    ]);

    res.json({
      success: true,
      data: {
        user: req.user,
        api_keys: keys,
        usage
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/keys', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { name, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'Nom requis' });

    const maxKeys = { free: 1, pro: 10, enterprise: 999 }[req.user.plan] || 1;
    const count = await pool.query('SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = TRUE', [req.user.id]);
    if (parseInt(count.rows[0].count) >= maxKeys) {
      return res.status(403).json({ error: 'Limite de clés atteinte', max: maxKeys });
    }

    const apiKeyService = new ApiKeyService(pool);
    const result = await apiKeyService.generateApiKey(req.user.id, name, permissions || ['read', 'chat']);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/keys', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const apiKeyService = new ApiKeyService(pool);
    const keys = await apiKeyService.listApiKeys(req.user.id);
    res.json({ success: true, count: keys.length, data: keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/keys/:id', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const apiKeyService = new ApiKeyService(pool);
    await apiKeyService.revokeApiKey(req.user.id, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/usage', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const apiKeyService = new ApiKeyService(pool);
    const stats = await apiKeyService.getUsageStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/plans', (req, res) => {
  const pool = req.app.get('pool');
  const apiKeyService = new ApiKeyService(pool);
  res.json({ success: true, data: apiKeyService.getPlans() });
});

router.get('/docs', (req, res) => {
  res.json({
    name: 'Mini ChatGPT API V5',
    version: '5.0.0',
    architecture: '20 IA avec recherche images',
    authentication: { type: 'API Key', header: 'X-API-Key', example: 'X-API-Key: mcp_v5_xxx' },
    endpoints: {
      chat: { method: 'POST', path: '/api/chat', body: { message: 'string', style: 'professional|academic|casual|technical', image_search: 'auto|always|never' } },
      images: { method: 'GET', path: '/api/images/search?q=paris&limit=6' },
      qa_search: { method: 'GET', path: '/api/qa/search?q=recherche' },
      knowledge: { method: 'GET', path: '/api/knowledge/search?q=motclé' },
      stats: { method: 'GET', path: '/api/stats' }
    },
    plans: {
      free: { calls: '1 000/mois', price: 'Gratuit', keys: 1 },
      pro: { calls: '50 000/mois', price: '9.99€', keys: 10 },
      enterprise: { calls: '500 000/mois', price: '49.99€', keys: 'Illimité' }
    }
  });
});

module.exports = router;
