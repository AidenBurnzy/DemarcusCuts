const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { pool, initializeDatabase, mockDatabase, isConnected } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database on startup
initializeDatabase();

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'DemarcusCuts backend is running', mode: isConnected() ? 'database' : 'demo' });
});

// Get availability for booking calendar
app.get('/api/bookings/availability', async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    // Use mock database if not connected
    if (!isConnected()) {
      const settings = mockDatabase.settings.find(s => s.client_id == clientId) || {
        slot_duration: 60,
        buffer_time: 15,
        min_advance_booking: 24,
        max_advance_booking: 2160,
        require_approval: false,
        timezone: 'Pacific/Auckland'
      };

      const schedules = mockDatabase.schedules.filter(s => s.client_id == clientId).map(s => ({
        dayOfWeek: s.day_of_week,
        startTime: s.start_time,
        endTime: s.end_time,
        isEnabled: true
      }));

      const overrides = mockDatabase.overrides.filter(o => o.client_id == clientId && o.date >= startDate && o.date <= endDate).map(o => ({
        date: o.date + 'T00:00:00Z',
        startTime: o.start_time,
        endTime: o.end_time,
        isAvailable: o.is_available
      }));

      const bookings = mockDatabase.bookings.filter(b => b.client_id == clientId && b.date >= startDate && b.date <= endDate).map(b => ({
        date: b.date,
        startTime: b.start_time,
        endTime: b.end_time
      }));

      return res.json({
        settings,
        schedules,
        overrides,
        bookings,
        mode: 'demo'
      });
    }

    const client = await pool.connect();

    // Fetch settings
    const settingsResult = await client.query(
      'SELECT * FROM settings WHERE client_id = $1',
      [clientId]
    );
    const settings = settingsResult.rows[0] || {
      slot_duration: 60,
      buffer_time: 15,
      min_advance_booking: 24,
      max_advance_booking: 2160,
      require_approval: false,
      timezone: 'Pacific/Auckland'
    };

    // Fetch schedules
    const schedulesResult = await client.query(
      'SELECT day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", is_enabled as "isEnabled" FROM schedules WHERE client_id = $1',
      [clientId]
    );
    const schedules = schedulesResult.rows;

    // Fetch overrides
    const overridesResult = await client.query(
      'SELECT date, start_time as "startTime", end_time as "endTime", is_available as "isAvailable" FROM overrides WHERE client_id = $1 AND date BETWEEN $2 AND $3',
      [clientId, startDate, endDate]
    );
    const overrides = overridesResult.rows.map(o => ({
      date: o.date + 'T00:00:00Z',
      startTime: o.startTime,
      endTime: o.endTime,
      isAvailable: o.isAvailable
    }));

    // Fetch bookings
    const bookingsResult = await client.query(
      'SELECT date, start_time as "startTime", end_time as "endTime" FROM bookings WHERE client_id = $1 AND date BETWEEN $2 AND $3 AND status != $4',
      [clientId, startDate, endDate, 'cancelled']
    );
    const bookings = bookingsResult.rows;

    client.release();

    res.json({
      settings,
      schedules,
      overrides,
      bookings
    });
  } catch (err) {
    console.error('Error fetching availability:', err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Submit new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      clientId,
      customerName,
      customerEmail,
      customerPhone,
      date,
      startTime,
      endTime,
      notes
    } = req.body;

    if (!clientId || !customerName || !customerEmail || !date || !startTime || !endTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Use mock database if not connected
    if (!isConnected()) {
      // Check if time slot is already booked
      const existingBooking = mockDatabase.bookings.find(
        b => b.client_id == clientId && b.date === date && b.start_time === startTime
      );

      if (existingBooking) {
        return res.status(409).json({ error: 'This time slot is already booked' });
      }

      // Create new booking
      const newBooking = {
        id: mockDatabase.bookings.length + 1,
        client_id: clientId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone || null,
        date: date,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      mockDatabase.bookings.push(newBooking);

      return res.status(201).json({
        id: newBooking.id,
        message: 'Booking created successfully (demo mode)',
        booking: newBooking
      });
    }

    const client = await pool.connect();

    // Check if time slot is already booked
    const existingBooking = await client.query(
      'SELECT id FROM bookings WHERE client_id = $1 AND date = $2 AND start_time = $3 AND status != $4',
      [clientId, date, startTime, 'cancelled']
    );

    if (existingBooking.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Insert new booking
    const result = await client.query(
      'INSERT INTO bookings (client_id, customer_name, customer_email, customer_phone, date, start_time, end_time, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [clientId, customerName, customerEmail, customerPhone, date, startTime, endTime, notes, 'pending']
    );

    client.release();

    res.status(201).json({
      id: result.rows[0].id,
      message: 'Booking created successfully',
      booking: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Get all bookings for a client
app.get('/api/bookings', async (req, res) => {
  try {
    const { clientId } = req.query;

    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM bookings WHERE client_id = $1 ORDER BY date DESC',
      [clientId]
    );
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get all bookings (admin view)
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT * FROM bookings ORDER BY date DESC LIMIT 100'
    );
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 DemarcusCuts backend running on port ${PORT}`);
  console.log(`📊 Using Neon Postgres database`);
});
