const crypto = require('crypto');

class ApiKeyService {
  constructor(pool) {
    this.pool = pool;
  }

  async generateApiKey(userId, name, permissions = ['read', 'chat']) {
    const prefix = 'mcp_v5_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    const apiKey = prefix + randomPart;
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 15) + '...';

    const result = await this.pool.query(
      `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, permissions)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, key_prefix, permissions, created_at`,
      [userId, keyHash, keyPrefix, name, JSON.stringify(permissions)]
    );

    return {
      api_key: apiKey,
      id: result.rows[0].id,
      name: result.rows[0].name,
      key_prefix: result.rows[0].key_prefix,
      permissions: result.rows[0].permissions,
      created_at: result.rows[0].created_at,
      warning: '⚠️ Stockez cette clé en sécurité. Elle ne sera plus affichée.'
    };
  }

  async listApiKeys(userId) {
    const result = await this.pool.query(
      'SELECT id, name, key_prefix, permissions, last_used, expires_at, is_active, created_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  async revokeApiKey(userId, keyId) {
    const result = await this.pool.query(
      'UPDATE api_keys SET is_active = FALSE WHERE id = $1 AND user_id = $2 RETURNING id, name',
      [keyId, userId]
    );
    if (result.rows.length === 0) throw new Error('Clé non trouvée');
    return { success: true, revoked: result.rows[0] };
  }

  async getUsageStats(userId) {
    const result = await this.pool.query(`
      SELECT 
        u.api_calls_limit, u.api_calls_used, u.plan,
        ROUND((u.api_calls_used::float / NULLIF(u.api_calls_limit, 0) * 100)::numeric, 1) as usage_percent,
        (SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND is_active = TRUE) as active_keys,
        (SELECT COUNT(*) FROM api_usage_logs WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days') as calls_30d,
        (SELECT COUNT(*) FROM api_usage_logs WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours') as calls_24h
      FROM users u WHERE u.id = $1
    `, [userId]);
    return result.rows[0];
  }

  getPlans() {
    return {
      free: { name: 'Gratuit', price: 0, api_calls: 1000, rate_limit: '10/min', features: ['Chat API', 'Recherche web', '1 clé API', 'Support communautaire'] },
      pro: { name: 'Pro', price: 9.99, api_calls: 50000, rate_limit: '100/min', features: ['Tout Gratuit', 'Recherche images', '10 clés API', 'Support prioritaire'] },
      enterprise: { name: 'Enterprise', price: 49.99, api_calls: 500000, rate_limit: '1000/min', features: ['Tout Pro', 'Clés illimitées', 'Images illimitées', 'Support 24/7'] }
    };
  }
}

module.exports = ApiKeyService;
