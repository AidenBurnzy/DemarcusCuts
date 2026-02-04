# Demarcus Cuts

Modern barbershop booking system featuring an interactive calendar, real-time availability, and a full-stack backend powered by Neon Postgres.

## 🚀 Quick Start

### One-Command Startup (Recommended)
```bash
./start-dev.sh
```

This starts both frontend (port 8000) and backend (port 3001).

### Manual Setup

#### 1. Backend Setup
```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:3001` and connects to Neon Postgres.

#### 2. Frontend Setup
```bash
# From project root
python3 -m http.server 8000
```

Frontend available at `http://localhost:8000`

## 📦 What's Included

- ✅ **Database**: Connected to Neon Postgres (Pacific/Auckland timezone)
- ✅ **Schedules**: Monday-Saturday configured (9am-6pm/5pm)
- ✅ **Booking System**: Real-time availability and conflict prevention
- ✅ **Admin Portal**: Manage schedules, overrides, settings, and bookings
- ✅ **Error Handling**: Graceful fallback to demo mode if backend unavailable

## 🔐 Admin Portal

Access the admin portal at `admin.html` to:
- View and manage bookings
- Configure weekly schedules
- Block specific dates or set custom hours
- Adjust booking settings (duration, buffer time, timezone)

**Local Access**: http://localhost:8000/admin.html

**Note**: Some admin features (schedule/override editing) require additional backend endpoints. The portal currently supports:
- ✅ View all bookings
- ✅ Confirm/cancel bookings
- ✅ View current configuration
- 🚧 Edit schedules (coming soon)
- 🚧 Add/remove overrides (coming soon)

Alternatively, use the Auctus portal: https://auctus-app.vercel.app/portal/availability

## 🌍 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions for:
- Separate frontend/backend (Netlify + Render)
- Unified deployment (single server)
- Environment configuration

### Quick Deployment Checklist
1. Deploy backend to Render/Railway/Fly.io
2. Note backend URL (e.g., `https://your-app.onrender.com`)
3. Update `index.html` line 6:
   ```html
   <meta name="api-base-url" content="https://your-app.onrender.com" />
   ```
4. Deploy frontend to Netlify/Vercel

## 🏗️ Architecture

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