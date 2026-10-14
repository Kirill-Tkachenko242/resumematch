require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.query('SELECT COUNT(*) FROM users')
    .then(res => {
       console.log('Connected! Users in table:', res.rows[0].count);
       pool.end();
    })
    .catch(err => {
       console.error('Error:', err.message);
       pool.end();
    });