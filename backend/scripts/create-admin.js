require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db');

(async () => {
  const [, , email, name, password] = process.argv;
  if (!email || !name || !password) {
    console.log('Usage: node scripts/create-admin.js <email> <name> <password>');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash`,
    [name, email, hash]
  );
  console.log('Admin ready:', email);
  process.exit(0);
})();