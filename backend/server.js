const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { pool, initializeDatabase, mockDatabase, isConnected } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost for local development
    if (origin.includes('localhost')) return callback(null, true);
    
    // Allow GitHub Codespaces URLs
    if (origin.includes('.app.github.dev')) return callback(null, true);
    
    // Allow common deployment platforms (add your production domains here)
    const allowedDomains = [
      '.netlify.app',
      '.vercel.app',
      '.onrender.com',
      '.railway.app',
      '.fly.dev',
      'demarcuscuts.netlify.app',  // Explicit Netlify domain
      // Add your custom domains here:
      // 'demarcuscuts.com',
      // 'www.demarcuscuts.com'
    ];
    
    if (allowedDomains.some(domain => origin.includes(domain))) {
      return callback(null, true);
    }
    
    // For development, log rejected origins
    console.log('⚠️ CORS rejected origin:', origin);
    // Still allow it but log it
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Serve static files in production (optional - for unified deployment)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC === 'true') {
  app.use(express.static(path.join(__dirname, '..')));
  console.log('📂 Serving static files from:', path.join(__dirname, '..'));
}

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

    // Use mock database if not connected to real database
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

    // Use real database with DemarcusCuts tables
    const client = await pool.connect();

    // Fetch settings from booking_settings table
    const settingsResult = await client.query(
      'SELECT slot_duration, buffer_time, min_advance_booking, max_advance_booking, require_approval, timezone FROM booking_settings WHERE client_id = $1',
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

    // Fetch schedules from availability_schedules table
    const schedulesResult = await client.query(
      'SELECT day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime", is_active as "isEnabled" FROM availability_schedules WHERE client_id = $1',
      [clientId]
    );
    const schedules = schedulesResult.rows;

    // Fetch overrides from availability_overrides table
    const overridesResult = await client.query(
      'SELECT override_date as date, start_time as "startTime", end_time as "endTime", is_available as "isAvailable" FROM availability_overrides WHERE client_id = $1 AND override_date BETWEEN $2 AND $3',
      [clientId, startDate, endDate]
    );
    const overrides = overridesResult.rows.map(o => ({
      date: o.date + 'T00:00:00Z',
      startTime: o.startTime,
      endTime: o.endTime,
      isAvailable: o.isAvailable
    }));

    // Fetch bookings (only non-cancelled ones)
    const bookingsResult = await client.query(
      'SELECT booking_date as date, start_time as "startTime", end_time as "endTime" FROM bookings WHERE client_id = $1 AND booking_date BETWEEN $2 AND $3 AND status != $4',
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
      'SELECT id FROM bookings WHERE client_id = $1 AND booking_date = $2 AND start_time = $3 AND status != $4',
      [clientId, date, startTime, 'cancelled']
    );

    if (existingBooking.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Insert new booking
    const result = await client.query(
      'INSERT INTO bookings (client_id, customer_name, customer_email, customer_phone, booking_date, start_time, end_time, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
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
      'SELECT * FROM bookings WHERE client_id = $1 ORDER BY booking_date DESC',
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
      'SELECT * FROM bookings ORDER BY booking_date DESC LIMIT 100'
    );
    client.release();

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin bookings:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking status (admin)
app.patch('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    if (!isConnected()) {
      return res.status(503).json({ error: 'Database not available' });
    }

    const client = await pool.connect();
    const result = await client.query(
      'UPDATE bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating booking:', err);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Contact form endpoint
app.post('/api/contact', async (req, res) => {
  try {
    console.log('📨 Contact form request received');
    const { name, email, phone, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      console.log('❌ Missing required fields:', { name: !!name, email: !!email, message: !!message });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('✅ Fields validated');
    const resendApiKey = process.env.RESEND_API_KEY;
    
    // Development mode: log to console instead of sending email
    if (!resendApiKey) {
      console.log('📧 [DEV MODE] Contact form submission received:');
      console.log(`   Name: ${name}`);
      console.log(`   Email: ${email}`);
      console.log(`   Phone: ${phone || 'Not provided'}`);
      console.log(`   Message: ${message.substring(0, 100)}...`);
      
      return res.status(200).json({ 
        success: true, 
        message: 'Email logged in development mode. Configure RESEND_API_KEY to send real emails.'
      });
    }

    // Production mode: send via Resend API
    console.log('🔑 RESEND_API_KEY is set, sending via Resend API');
    const emailBody = {
      from: 'DemarcusCuts <onboarding@resend.dev>',
      to: ['founder.auctusventures@gmail.com'],
      subject: 'New Contact Form Submission from DemarcusCuts',
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p style="color: #666; font-size: 12px;">Sent from DemarcusCuts contact form</p>
      `,
      reply_to: email
    };

    console.log('📤 Sending request to Resend API...');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailBody)
    });

    console.log(`📬 Resend API responded with status: ${response.status}`);
    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Resend API error:', data);
      return res.status(500).json({ error: 'Failed to send email', details: data });
    }

    console.log('✅ Email sent successfully via Resend:', data.id);
    return res.status(200).json({ 
      success: true, 
      message: 'Email sent successfully',
      id: data.id 
    });

  } catch (error) {
    console.error('❌ Contact form error:', error.message);
    console.error('   Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
});

// Serve frontend index.html for all non-API routes (optional - for unified deployment)
if (process.env.NODE_ENV === 'production' && process.env.SERVE_STATIC === 'true') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 DemarcusCuts backend running on port ${PORT}`);
  console.log(`📊 Using Neon Postgres database`);
  if (process.env.SERVE_STATIC === 'true') {
    console.log(`📂 Serving frontend static files`);
  }
});
