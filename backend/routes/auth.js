const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticate } = require('../middleware/auth');
const { rateLimiter, authLimiter } = require('../middleware/rate-limit');

router.post('/register', authLimiter, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { username, email, password } = req.body;

    if (!username || !password) return res.status(400).json({ error: 'Username et mot de passe requis' });
    if (username.length < 3) return res.status(400).json({ error: 'Username trop court (min 3)' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min 6)' });

    const existing = await pool.query('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Username ou email déjà utilisé' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, role, plan, created_at',
      [username, email, passwordHash]
    );

    const token = jwt.sign(
      { id: result.rows[0].id, username: result.rows[0].username, role: result.rows[0].role, plan: result.rows[0].plan },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({ success: true, data: { user: result.rows[0], token } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Identifiants invalides' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, plan: user.plan },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    res.json({
      success: true,
      data: {
        token,
        user: { id: user.id, username: user.username, email: user.email, role: user.role, plan: user.plan }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  const pool = req.app.get('pool');
  const result = await pool.query(
    'SELECT id, username, email, role, plan, preferences, api_calls_limit, api_calls_used, created_at, last_login FROM users WHERE id = $1',
    [req.user.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Non trouvé' });
  res.json({ success: true, data: result.rows[0] });
});

router.put('/me', authenticate, async (req, res) => {
  try {
    const pool = req.app.get('pool');
    const { email, preferences } = req.body;
    const updates = [];
    const params = [];
    let c = 1;
    if (email) { updates.push(`email = $${c++}`); params.push(email); }
    if (preferences) { updates.push(`preferences = $${c++}`); params.push(JSON.stringify(preferences)); }
    if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée' });
    updates.push('updated_at = NOW()');
    params.push(req.user.id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${c}`, params);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
