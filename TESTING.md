# Testing Checklist

## Local Development Testing

### ✅ Backend Health Check
```bash
curl http://localhost:3001/health
# Expected: {"status":"OK","message":"DemarcusCuts backend is running","mode":"database"}
```

### ✅ Database Connection
```bash
curl -s "http://localhost:3001/api/bookings/availability?clientId=15&startDate=2026-02-01&endDate=2026-03-01" | python3 -m json.tool | head -20
# Expected: Settings, schedules (6 days), and booking data
```

### ✅ Frontend Loading
1. Open http://localhost:8000
2. Check browser console for:
   - `🔧 API Configuration: http://localhost:3001`
   - `📥 API Response received:`
   - `✅ Schedules loaded:`
3. Calendar should show available dates

### ✅ Booking Flow
1. Click on an available date (green)
2. Time slots should appear
3. Fill out booking form
4. Submit booking
5. Check database:
   ```bash
   cd backend && node -e "
   const {pool}=require('./db');
   (async()=>{
     const c=await pool.connect();
     const r=await c.query('SELECT * FROM bookings ORDER BY created_at DESC LIMIT 5');
     console.log(r.rows);
     c.release();
     process.exit(0);
   })();
   "
   ```

## Production Deployment Testing

### ✅ Backend Deployment
1. Deploy backend to hosting service
2. Test health endpoint:
   ```bash
   curl https://your-backend-url.com/health
   ```
3. Test availability endpoint:
   ```bash
   curl "https://your-backend-url.com/api/bookings/availability?clientId=15&startDate=2026-02-01&endDate=2026-03-01"
   ```

### ✅ Frontend Configuration
1. Update `index.html` meta tag:
   ```html
   <meta name="api-base-url" content="https://your-backend-url.com" />
   ```
2. Deploy frontend
3. Open deployed frontend URL
4. Check browser console for:
   - `🔧 API Configuration: https://your-backend-url.com`
   - NO 404 errors
   - Data loading successfully

### ✅ CORS Verification
If you see CORS errors:
1. Add your frontend domain to `backend/server.js`:
   ```javascript
   const allowedDomains = [
     '.netlify.app',
     'yourdomain.com',  // Add your domain
   ];
   ```
2. Redeploy backend

## Common Issues

### Issue: 404 Errors on Deployed Version
**Symptoms**: `Failed to load resource: 404` in console

**Solutions**:
1. Check API URL in browser console: `🔧 API Configuration: ...`
2. Verify backend is accessible: `curl https://your-backend-url.com/health`
3. Ensure meta tag is set correctly in `index.html`
4. Check CORS configuration allows your frontend domain

### Issue: No Available Dates Showing
**Symptoms**: Calendar shows no green dates

**Solutions**:
1. Check console for schedule data: `✅ Schedules loaded:`
2. Verify timezone: Should be `Pacific/Auckland`
3. Check date range is within max advance booking (8760 hours = 1 year)
4. Ensure schedules exist in database

### Issue: Bookings Not Saving
**Symptoms**: Booking appears successful but not in database

**Solutions**:
1. Check database connection in backend logs
2. Verify DATABASE_URL in backend `.env`
3. Check for database errors in backend logs: `tail -f /tmp/backend.log`

## Debug Commands

### View Backend Logs
```bash
tail -f /tmp/backend.log
```

### View Frontend Logs  
```bash
tail -f /tmp/frontend.log
```

### Check Running Processes
```bash
ps aux | grep -E "npm start|http.server"
```

### Stop All Servers
```bash
pkill -f "npm start"
pkill -f "python3 -m http.server"
```

### Restart Everything
```bash
pkill -f "npm start" && pkill -f "python3 -m http.server"
./start-dev.sh
```
