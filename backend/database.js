const bcrypt = require('bcryptjs');

async function initDatabase(pool) {
  const client = await pool.connect();
  
  try {
    console.log('📦 Initialisation base de données V5.0...\n');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        plan VARCHAR(20) DEFAULT 'free',
        api_calls_limit INTEGER DEFAULT 1000,
        api_calls_used INTEGER DEFAULT 0,
        preferences JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMP NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS qa_pairs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        intent VARCHAR(100),
        entities JSONB DEFAULT '{}',
        sentiment VARCHAR(20) DEFAULT 'neutre',
        language VARCHAR(10) DEFAULT 'fr',
        source VARCHAR(20) DEFAULT 'web',
        confidence FLOAT DEFAULT 0.5,
        search_performed BOOLEAN DEFAULT FALSE,
        images_found INTEGER DEFAULT 0,
        images_data JSONB DEFAULT '[]',
        processing_time INTEGER,
        pipeline_data JSONB DEFAULT '[]',
        count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_qa_question ON qa_pairs USING gin(to_tsvector('french', question));
      CREATE INDEX IF NOT EXISTS idx_qa_intent ON qa_pairs(intent);
      CREATE INDEX IF NOT EXISTS idx_qa_user ON qa_pairs(user_id);
      CREATE INDEX IF NOT EXISTS idx_qa_created ON qa_pairs(created_at);

      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        content TEXT,
        file_data BYTEA,
        file_size INTEGER,
        pages INTEGER,
        category VARCHAR(100) DEFAULT 'general',
        tags TEXT[],
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS knowledge (
        id SERIAL PRIMARY KEY,
        keyword VARCHAR(100) NOT NULL,
        sentence TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'general',
        document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
        source VARCHAR(100),
        reliability FLOAT DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_knowledge_keyword ON knowledge(keyword);
      CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category);

      CREATE TABLE IF NOT EXISTS image_cache (
        id SERIAL PRIMARY KEY,
        query_hash VARCHAR(64) UNIQUE NOT NULL,
        query_text TEXT NOT NULL,
        images JSONB NOT NULL,
        image_count INTEGER DEFAULT 0,
        sources TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
      );

      CREATE INDEX IF NOT EXISTS idx_image_cache_hash ON image_cache(query_hash);
      CREATE INDEX IF NOT EXISTS idx_image_cache_expires ON image_cache(expires_at);

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        session_id VARCHAR(100),
        title VARCHAR(255) DEFAULT 'Nouvelle conversation',
        platform VARCHAR(20) DEFAULT 'web',
        messages JSONB DEFAULT '[]',
        message_count INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        style VARCHAR(20) DEFAULT 'professional',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS telegram_users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        username VARCHAR(100),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        language_code VARCHAR(10) DEFAULT 'fr',
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_keys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        key_hash VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(20),
        name VARCHAR(100),
        permissions JSONB DEFAULT '["read", "chat"]',
        last_used TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS api_usage_logs (
        id SERIAL PRIMARY KEY,
        api_key_id INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        endpoint VARCHAR(255),
        method VARCHAR(10),
        ip_address VARCHAR(45),
        user_agent TEXT,
        status_code INTEGER DEFAULT 200,
        response_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        qa_id INTEGER REFERENCES qa_pairs(id) ON DELETE SET NULL,
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        category VARCHAR(50),
        platform VARCHAR(20) DEFAULT 'web',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS learning_metrics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100),
        metric_value FLOAT,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS search_cache (
        id SERIAL PRIMARY KEY,
        query_hash VARCHAR(64) UNIQUE NOT NULL,
        query_text TEXT NOT NULL,
        results JSONB NOT NULL,
        result_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
      );
    `);

    console.log('✅ Tables créées avec succès');

    const adminPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 12);
    await client.query(`
      INSERT INTO users (username, email, password_hash, role, plan, api_calls_limit)
      VALUES ($1, $2, $3, 'admin', 'enterprise', 999999)
      ON CONFLICT (username) DO UPDATE SET role = 'admin', plan = 'enterprise'
    `, [process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_EMAIL || 'admin@minichatgpt.com', adminPassword]);

    console.log('✅ Admin créé (admin / admin123)\n');

  } catch (error) {
    console.error('❌ Erreur DB:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { initDatabase };
