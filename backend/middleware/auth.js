const jwt = require('jsonwebtoken');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentification requise', message: 'Header: Authorization: Bearer <token>' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const pool = req.app.get('pool');
    const result = await pool.query(
      'SELECT id, username, email, role, plan, api_calls_limit, api_calls_used FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) return res.status(401).json({ error: 'Utilisateur non trouvé' });
    req.user = result.rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return res.status(401).json({ error: 'Token invalide' });
    if (error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expiré' });
    res.status(500).json({ error: error.message });
  }
}

module.exports = { authenticate };
