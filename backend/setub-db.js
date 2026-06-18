require('dotenv').config();
const { Pool } = require('pg');
const { initDatabase } = require('./database');

async function setup() {
  console.log('🔧 Configuration base de données Mini ChatGPT V5.0...\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL non définie dans .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await initDatabase(pool);
    console.log('\n✅ Base de données V5.0 initialisée avec succès !');
    console.log('🚀 Lance le serveur avec : npm start\n');
  } catch (error) {
    console.error('\n❌ Erreur :', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
