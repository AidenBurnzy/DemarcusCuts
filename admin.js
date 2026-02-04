// Admin Portal JavaScript

// API Configuration
const API_CONFIG = {
  baseURL: (() => {
    const metaTag = document.querySelector('meta[name="api-base-url"]');
    const metaUrl = metaTag?.getAttribute('content');
    if (metaUrl && metaUrl.trim() !== '' && !metaUrl.includes('your-backend')) {
      return metaUrl;
    }
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return "http://localhost:3001";
    }
    if (window.location.hostname.includes('app.github.dev')) {
      return `${window.location.protocol}//${window.location.hostname.replace('-8000', '-3001')}`;
    }
    return window.location.origin;
  })(),
  clientId: "15",
};

console.log('🔧 Admin API Configuration:', API_CONFIG.baseURL);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// State
let schedules = [];
let overrides = [];
let settings = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await checkConnection();
  await loadData();
});

async function checkConnection() {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/health`);
    if (response.ok) {
      document.getElementById('connectionStatus').textContent = '✅ Connected';
      document.getElementById('connectionStatus').classList.add('connected');
    }
  } catch (error) {
    document.getElementById('connectionStatus').textContent = '❌ Connection Failed';
    document.getElementById('connectionStatus').classList.remove('connected');
    console.error('Connection error:', error);
  }
}

async function loadData() {
  await Promise.all([
    loadSchedules(),
    loadOverrides(),
    loadSettings(),
    loadBookings()
  ]);
}

async function loadSchedules() {
  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}/api/bookings/availability?clientId=${API_CONFIG.clientId}&startDate=2026-01-01&endDate=2026-12-31`
    );
    const data = await response.json();
    schedules = data.schedules || [];
    renderSchedules();
  } catch (error) {
    console.error('Failed to load schedules:', error);
    document.getElementById('schedulesList').innerHTML = '<p class="error">Failed to load schedules</p>';
  }
}

function renderSchedules() {
  const container = document.getElementById('schedulesList');
  
  if (schedules.length === 0) {
    container.innerHTML = '<p style="color: #6c757d;">No schedules configured. Add schedule management to backend.</p>';
    return;
  }

  container.innerHTML = schedules.map(schedule => {
    const dayName = DAYS[schedule.dayOfWeek] || `Day ${schedule.dayOfWeek}`;
    return `
      <div class="schedule-day">
        <label>${dayName}</label>
        <input type="time" value="${schedule.startTime}" data-day="${schedule.dayOfWeek}" data-field="start">
        <input type="time" value="${schedule.endTime}" data-day="${schedule.dayOfWeek}" data-field="end">
        <label>
          <input type="checkbox" ${schedule.isEnabled ? 'checked' : ''} data-day="${schedule.dayOfWeek}" data-field="enabled">
          Enabled
        </label>
      </div>
    `;
  }).join('');
  
  container.innerHTML += '<button onclick="saveSchedules()" style="margin-top: 15px;">Save Schedule Changes</button>';
}

async function saveSchedules() {
  showMessage('schedules', 'Saving schedules...', 'info');
  // Note: You'll need to add a backend endpoint to update schedules
  // For now, this is a placeholder
  showMessage('schedules', 'Schedule update endpoint not yet implemented. Add PUT /api/schedules to backend.', 'error');
}

async function loadOverrides() {
  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}/api/bookings/availability?clientId=${API_CONFIG.clientId}&startDate=2026-01-01&endDate=2026-12-31`
    );
    const data = await response.json();
    overrides = data.overrides || [];
    renderOverrides();
  } catch (error) {
    console.error('Failed to load overrides:', error);
    document.getElementById('overridesList').innerHTML = '<p class="error">Failed to load overrides</p>';
  }
}

function renderOverrides() {
  const container = document.getElementById('overridesList');
  
  if (overrides.length === 0) {
    container.innerHTML = '<p style="color: #6c757d; padding: 20px;">No date overrides set.</p>';
    return;
  }

  container.innerHTML = overrides.map(override => {
    const date = override.date.split('T')[0];
    const status = override.isAvailable 
      ? `Custom hours: ${override.startTime} - ${override.endTime}`
      : 'Blocked (Closed)';
    
    return `
      <div class="override-item">
        <div>
          <strong>${date}</strong>
          <br>
          <span style="color: #6c757d;">${status}</span>
        </div>
        <button class="danger" onclick="deleteOverride('${date}')">Delete</button>
      </div>
    `;
  }).join('');
}

function toggleOverrideHours() {
  const blocked = document.getElementById('blockDate').checked;
  document.getElementById('overrideHours').style.display = blocked ? 'none' : 'block';
}

async function addOverride() {
  const date = document.getElementById('overrideDate').value;
  const blocked = document.getElementById('blockDate').checked;
  const startTime = document.getElementById('overrideStart').value;
  const endTime = document.getElementById('overrideEnd').value;

  if (!date) {
    showMessage('overrides', 'Please select a date', 'error');
    return;
  }

  if (!blocked && (!startTime || !endTime)) {
    showMessage('overrides', 'Please set start and end times', 'error');
    return;
  }

  showMessage('overrides', 'Adding override...', 'info');
  
  // Note: You'll need to add a backend endpoint to create overrides
  showMessage('overrides', 'Override creation endpoint not yet implemented. Add POST /api/overrides to backend.', 'error');
}

async function deleteOverride(date) {
  if (!confirm(`Delete override for ${date}?`)) return;
  
  showMessage('overrides', 'Deleting override...', 'info');
  
  // Note: You'll need to add a backend endpoint to delete overrides
  showMessage('overrides', 'Override deletion endpoint not yet implemented. Add DELETE /api/overrides/:date to backend.', 'error');
}

async function loadSettings() {
  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}/api/bookings/availability?clientId=${API_CONFIG.clientId}&startDate=2026-01-01&endDate=2026-12-31`
    );
    const data = await response.json();
    settings = data.settings || {};
    populateSettings();
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}

function populateSettings() {
  document.getElementById('slotDuration').value = settings.slot_duration || 60;
  document.getElementById('bufferTime').value = settings.buffer_time || 15;
  document.getElementById('minAdvance').value = settings.min_advance_booking || 24;
  document.getElementById('maxAdvance').value = settings.max_advance_booking || 8760;
  document.getElementById('timezone').value = settings.timezone || 'Pacific/Auckland';
}

async function saveSettings() {
  const newSettings = {
    clientId: API_CONFIG.clientId,
    slotDuration: parseInt(document.getElementById('slotDuration').value),
    bufferTime: parseInt(document.getElementById('bufferTime').value),
    minAdvanceBooking: parseInt(document.getElementById('minAdvance').value),
    maxAdvanceBooking: parseInt(document.getElementById('maxAdvance').value),
    timezone: document.getElementById('timezone').value
  };

  showMessage('settings', 'Saving settings...', 'info');
  
  // Note: You'll need to add a backend endpoint to update settings
  showMessage('settings', 'Settings update endpoint not yet implemented. Add PUT /api/settings to backend.', 'error');
}

async function loadBookings() {
  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}/api/bookings/availability?clientId=${API_CONFIG.clientId}`
    );
    const data = await response.json();
    const bookings = data.bookings || [];
    renderBookings(bookings);
  } catch (error) {
    console.error('Failed to load bookings:', error);
    document.getElementById('bookingsList').innerHTML = '<p class="error">Failed to load bookings</p>';
  }
}

function renderBookings(bookings) {
  const container = document.getElementById('bookingsList');
  
  if (bookings.length === 0) {
    container.innerHTML = '<p style="color: #6c757d; padding: 20px;">No bookings yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="bookings-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Time</th>
          <th>Customer</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${bookings.map(booking => `
          <tr>
            <td>${booking.date}</td>
            <td>${booking.start_time} - ${booking.end_time}</td>
            <td>${booking.customer_name}</td>
            <td>${booking.customer_email}</td>
            <td>${booking.customer_phone || 'N/A'}</td>
            <td><span class="status-badge ${booking.status}">${booking.status}</span></td>
            <td>
              ${booking.status === 'pending' ? 
                `<button class="secondary" onclick="updateBookingStatus(${booking.id}, 'confirmed')">Confirm</button>` : ''}
              <button class="danger" onclick="updateBookingStatus(${booking.id}, 'cancelled')">Cancel</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function updateBookingStatus(bookingId, status) {
  if (!confirm(`Are you sure you want to ${status} this booking?`)) return;
  
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (response.ok) {
      showMessage('bookings', `Booking ${status} successfully`, 'success');
      await loadBookings();
    } else {
      throw new Error('Failed to update booking');
    }
  } catch (error) {
    console.error('Error updating booking:', error);
    showMessage('bookings', 'Failed to update booking status', 'error');
  }
}

function switchTab(tabName) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(`${tabName}-tab`).classList.add('active');
  event.target.classList.add('active');
}

function showMessage(section, message, type) {
  const messageDiv = document.getElementById(`${section}Message`);
  if (!messageDiv) return;
  
  messageDiv.innerHTML = `<div class="message ${type}">${message}</div>`;
  
  if (type === 'success') {
    setTimeout(() => {
      messageDiv.innerHTML = '';
    }, 3000);
  }
}
