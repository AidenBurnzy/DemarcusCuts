# Deployment Guide

## Backend URL Configuration

The application supports multiple deployment scenarios:

### Option 1: Set Backend URL via Meta Tag (Recommended for Static Hosting)

Edit `index.html` and set the backend URL in the meta tag:

```html
<meta name="api-base-url" content="https://your-backend-url.com" />
```

### Option 2: Deploy Frontend and Backend Together

If you deploy both frontend and backend on the same server (e.g., Express serving static files), the app will automatically use relative URLs.

Example Express setup in `backend/server.js`:

```javascript
// Serve static files from the parent directory
app.use(express.static(path.join(__dirname, '..')));

// API routes should be defined BEFORE the catch-all
app.get('/api/bookings/availability', ...);
app.post('/api/bookings', ...);

// Catch-all route to serve index.html for client-side routing (optional)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});
```

### Option 3: GitHub Codespaces

For GitHub Codespaces, the app automatically detects the environment and uses port forwarding URLs.

## Deployment Checklist

### Frontend Deployment (Static Hosting - Netlify, Vercel, etc.)

1. ✅ Set the backend URL in `index.html`:
   ```html
   <meta name="api-base-url" content="https://your-backend-url.onrender.com" />
   ```

2. ✅ Build/upload frontend files:
   - `index.html`
   - `script.js`
   - `styles.css`

### Backend Deployment (Render, Railway, Fly.io, etc.)

1. ✅ Set environment variables:
   ```
   DATABASE_URL=postgresql://neondb_owner:npg_V26JqtgAwWaj@ep-lucky-wave-ahvajv2i-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   PORT=3001
   NODE_ENV=production
   ```

2. ✅ Deploy the `backend` folder

3. ✅ Ensure CORS is properly configured in `backend/server.js` to allow your frontend domain

4. ✅ Update the CORS configuration to include your production frontend URL:
   ```javascript
   app.use(cors({
     origin: function (origin, callback) {
       const allowedOrigins = [
         'https://your-frontend-domain.com',
         'https://your-frontend-domain.netlify.app',
       ];
       if (!origin || allowedOrigins.includes(origin)) {
         return callback(null, true);
       }
       callback(new Error('Not allowed by CORS'));
     },
     credentials: true
   }));
   ```

## Example Production Setup

### Backend on Render
1. Connect your GitHub repo
2. Select `backend` as the root directory
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables (DATABASE_URL, etc.)
6. Note your backend URL (e.g., `https://demarcuscuts-api.onrender.com`)

### Frontend on Netlify
1. Connect your GitHub repo
2. Build command: (leave empty for static site)
3. Publish directory: `/` (root)
4. Before deploying, update `index.html`:
   ```html
   <meta name="api-base-url" content="https://demarcuscuts-api.onrender.com" />
   ```
5. Deploy!

## Troubleshooting 404 Errors

If you see 404 errors like `/api/bookings/availability:1 Failed to load resource: the server responded with a status of 404`:

1. **Check browser console** for the API URL being used:
   ```
   🔧 API Configuration: https://your-backend-url.com
   ```

2. **Verify backend is accessible**:
   ```bash
   curl https://your-backend-url.com/health
   # Should return: {"status":"OK","message":"DemarcusCuts backend is running","mode":"database"}
   ```

3. **Check CORS configuration** - ensure your frontend domain is allowed

4. **Verify the meta tag** in `index.html` has the correct backend URL

## Testing Locally

1. Start backend: `cd backend && npm start`
2. Start frontend: `python3 -m http.server 8000` (from root directory)
3. Open: `http://localhost:8000`
4. Check console for: `🔧 API Configuration: http://localhost:3001`
