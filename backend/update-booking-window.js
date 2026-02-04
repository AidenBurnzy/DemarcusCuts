const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function updateBookingWindow() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');
    
    const result = await client.query(
      'UPDATE settings SET max_advance_booking = $1 WHERE client_id = $2 RETURNING *',
      [8760, 15]
    );
    
    console.log('✅ Updated max_advance_booking to 8760 hours (365 days)');
    console.log('Updated settings:', result.rows[0]);
    
    client.release();
    process.exit(0);
  } catch (err) {
    console.error('Error updating database:', err);
    process.exit(1);
  }
}

updateBookingWindow();
