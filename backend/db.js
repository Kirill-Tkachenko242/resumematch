require('dotenv').config();
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  idleTimeoutMillis: 10000,       // drop idle connections before Neon does
  connectionTimeoutMillis: 10000, // give a sleeping database time to wake up
});

// without this handler, an error on an idle connection can crash the server
pool.on('error', (err) => console.error('Idle DB connection error:', err.message));

// retry once on a fresh connection if the old one was closed under us
const originalQuery = pool.query.bind(pool);
pool.query = async (...args) => {
  try {
    return await originalQuery(...args);
  } catch (err) {
    if (/Connection terminated|ECONNRESET/i.test(err.message)) {
      return originalQuery(...args);
    }
    throw err;
  }
};

module.exports = pool;