# DemarcusCuts Backend

Backend server for the DemarcusCuts barbershop booking system, powered by Express.js and Neon Postgres.

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy the example env file and set your Neon Postgres connection string:
```bash
cp .env.example .env
```

Then edit `.env` and set `DATABASE_URL`.

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will run on `http://localhost:3001`

## Database

- **Provider**: Neon Postgres
- **Tables**: bookings, schedules, overrides, settings
- **Auto-initialized**: Tables are created automatically on first run

## API Endpoints

### Get Availability
```
GET /api/bookings/availability?clientId=15&startDate=2025-12-01&endDate=2026-03-01
```

### Create Booking
```
POST /api/bookings
Content-Type: application/json

{
  "clientId": 15,
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "(555) 123-4567",
  "date": "2025-12-15",
  "startTime": "14:00",
  "endTime": "15:00",
  "notes": ""
}
```

### Get All Bookings
```
GET /api/bookings?clientId=15
```

### Health Check
```
GET /health
```

## Frontend Integration

The frontend (`index.html`, `script.js`) is configured to use this backend by default.
Change `API_CONFIG.baseURL` in `script.js` if needed.
