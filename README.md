# Demarcus Cuts

Modern barbershop booking system featuring an interactive calendar, real-time availability, and a full-stack backend powered by Neon Postgres.

## Getting Started

### Frontend Only
Open `index.html` in your browser for the static site.

### Full Stack (With Backend)
1. Configure backend environment variables:
```bash
cd backend
cp .env.example .env
```

Update `DATABASE_URL` in `.env` with your Neon connection string.

2. Start the backend server (requires Node.js):
```bash
cd backend
npm install
npm start
```

The backend will run on `http://localhost:3001` and connect to your Neon Postgres database.

3. Open `index.html` in your browser. The booking system will use your backend API instead of the external Auctus service.

## Architecture

- **Frontend**: HTML5, CSS3, JavaScript (vanilla)
- **Backend**: Node.js + Express.js
- **Database**: Neon Postgres
- **API**: RESTful endpoints for bookings and availability

## Database

Your Neon Postgres instance automatically receives:
- Booking records with customer details
- Schedule configurations (business hours per day)
- Blocked dates and overrides
- System settings (slot duration, buffer time, etc.)

## Integrations

- **Neon Postgres**: Booking data storage ✅ ACTIVE
- Netlify: static hosting & form handling
- n8n: automate notifications or CRM syncs

## File Structure

```
/
├── index.html           # Main booking interface
├── styles.css           # Responsive styling
├── script.js            # Frontend logic (now uses backend)
├── backend/
│   ├── server.js        # Express server
│   ├── db.js            # Postgres connection & schema
│   ├── package.json     # Backend dependencies
│   ├── .env             # Database credentials
│   └── README.md        # Backend documentation
└── README.md            # This file
```

## Switching Back to Auctus API

To revert to the original Auctus API integration, edit `script.js`:
```javascript
const API_CONFIG = {
  baseURL: "https://auctus-app.vercel.app",
  clientId: "15",
};
```