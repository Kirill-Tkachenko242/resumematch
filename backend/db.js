require('dotenv').config();

const url = process.env.DATABASE_URL || '';
const options = {
  connectionString: url,
  idleTimeoutMillis: 10000,       // drop idle connections before the server does
  connectionTimeoutMillis: 10000, // give a sleeping database time to wake up
};

let pool;
if (/neon\.tech/.test(url)) {
  // Neon: SQL over WebSocket on port 443 (port 5432 is blocked on some networks)
  const { Pool, neonConfig } = require('@neondatabase/serverless');
  neonConfig.webSocketConstructor = require('ws');
  pool = new Pool(options);
} else {
  // Plain PostgreSQL (the database container on my own server)
  const { Pool } = require('pg');
  pool = new Pool(options);
}

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