const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

async function initializeDatabase() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to Neon Postgres database');
    
    // Create tables if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(20),
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(date, start_time)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        day_of_week INTEGER NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_enabled BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS overrides (
        id SERIAL PRIMARY KEY,
        client_id INTEGER,
        date DATE NOT NULL,
        start_time TIME,
        end_time TIME,
        is_available BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(client_id, date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        client_id INTEGER UNIQUE,
        slot_duration INTEGER DEFAULT 60,
        buffer_time INTEGER DEFAULT 15,
        min_advance_booking INTEGER DEFAULT 24,
        max_advance_booking INTEGER DEFAULT 2160,
        require_approval BOOLEAN DEFAULT false,
        timezone VARCHAR(50) DEFAULT 'America/New_York',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Initialize default settings for client 15 if not exists
    await client.query(`
      INSERT INTO settings (client_id, slot_duration, buffer_time, min_advance_booking, max_advance_booking, timezone)
      VALUES (15, 60, 15, 24, 2160, 'Pacific/Auckland')
      ON CONFLICT (client_id) DO NOTHING;
    `);

    // Initialize default schedules for client 15 if not exists
    const scheduleCheck = await client.query('SELECT COUNT(*) FROM schedules WHERE client_id = 15');
    if (scheduleCheck.rows[0].count === 0) {
      const schedules = [
        { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
        { dayOfWeek: 5, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 6, startTime: '10:00', endTime: '15:00' },
      ];
      
      for (const schedule of schedules) {
        await client.query(
          'INSERT INTO schedules (client_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
          [15, schedule.dayOfWeek, schedule.startTime, schedule.endTime]
        );
      }
    }

    console.log('✅ Database tables initialized');
    client.release();
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

module.exports = { pool, initializeDatabase };
