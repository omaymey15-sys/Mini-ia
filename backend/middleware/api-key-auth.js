const crypto = require('crypto');

async function authenticateApiKey(req, res, next) {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey) return res.status(401).json({ error: 'Clé API requise', header: 'X-API-Key' });

    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const pool = req.app.get('pool');

    const result = await pool.query(`
      SELECT ak.id, ak.name, ak.permissions, u.id as user_id, u.username, u.role, u.plan, u.api_calls_limit, u.api_calls_used
      FROM api_keys ak JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = $1 AND ak.is_active = TRUE AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    `, [keyHash]);

    if (result.rows.length === 0) return res.status(403).json({ error: 'Clé API invalide' });
    const keyData = result.rows[0];

    if (keyData.api_calls_used >= keyData.api_calls_limit) {
      return res.status(429).json({ error: 'Limite atteinte', limit: keyData.api_calls_limit });
    }

    await pool.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [keyData.id]);
    await pool.query('UPDATE users SET api_calls_used = api_calls_used + 1 WHERE id = $1', [keyData.user_id]);
    await pool.query(
      'INSERT INTO api_usage_logs (api_key_id, user_id, endpoint, method, ip_address) VALUES ($1, $2, $3, $4, $5)',
      [keyData.id, keyData.user_id, req.originalUrl, req.method, req.ip]
    );

    req.apiKey = { id: keyData.id, name: keyData.name, permissions: keyData.permissions, user: { id: keyData.user_id, username: keyData.username, role: keyData.role, plan: keyData.plan } };
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = { authenticateApiKey };
