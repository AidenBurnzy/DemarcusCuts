const calendarGrid = document.getElementById("calendar-grid");
const calendarMonth = document.getElementById("calendar-month");
const calendarYear = document.getElementById("calendar-year");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const appointmentDateInput = document.getElementById("appointment-date");
const appointmentTimeSelect = document.getElementById("appointment-time");
const bookingForm = document.getElementById("booking-form");
const currentYearSpan = document.getElementById("current-year");

// Modal elements
const timeSlotModal = document.getElementById("time-slot-modal");
const modalDateTitle = document.getElementById("modal-date-title");
const modalSlotCount = document.getElementById("modal-slot-count");
const timeSlotsGrid = document.getElementById("time-slots-grid");
const modalCloseBtn = document.getElementById("modal-close-btn");

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Convert 24-hour time to 12-hour AM/PM format
function formatTime12Hour(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Get day of week in Pacific/Auckland timezone (0=Sunday, 6=Saturday)
function getDayOfWeekInTimezone(date) {
  const aucklandDateStr = date.toLocaleDateString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [day, month, year] = aucklandDateStr.split('/').map(Number);
  const aucklandDate = new Date(year, month - 1, day);
  return aucklandDate.getDay();
}

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
    console.warn('⚠️ No backend URL configured - using same origin (likely to fail)');
    return window.location.origin;
  })(),
  clientId: "15",
};

console.log('🔧 API Configuration:', API_CONFIG.baseURL);
const hasMetaUrl = (() => {
  const metaTag = document.querySelector('meta[name="api-base-url"]');
  const metaUrl = metaTag?.getAttribute('content');
  return !!(metaUrl && metaUrl.trim() !== '' && !metaUrl.includes('your-backend'));
})();

if (!hasMetaUrl && !API_CONFIG.baseURL) {
  if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('app.github.dev')) {
    console.warn('⚠️ DEPLOYMENT WARNING: Backend API URL not configured!');
  }
}

const calendarState = {
  current: startOfMonth(new Date()),
  selectedDate: null,
  availability: null,
  settings: null,
  blockedDates: [],
  appointments: [],
  isLoading: true,
};

renderFooterYear();
initializeCalendar();

prevMonthBtn.addEventListener("click", () => {
  calendarState.current = addMonths(calendarState.current, -1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  calendarState.current = addMonths(calendarState.current, 1);
  renderCalendar();
});

// Modal event listeners
modalCloseBtn.addEventListener("click", () => closeTimeSlotModal());
timeSlotModal.addEventListener("click", (e) => {
  if (e.target === timeSlotModal) closeTimeSlotModal();
});

const confirmationModal = document.getElementById('confirmation-modal');
if (confirmationModal) {
  confirmationModal.addEventListener("click", (e) => {
    if (e.target === confirmationModal) {
      const doneBtn = document.getElementById('done-btn');
      if (!doneBtn || !doneBtn.disabled) closeConfirmationModal();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !timeSlotModal.classList.contains("hidden")) {
    closeTimeSlotModal();
  }
  if (e.key === "Escape" && confirmationModal && !confirmationModal.classList.contains("hidden")) {
    const doneBtn = document.getElementById('done-btn');
    if (!doneBtn || !doneBtn.disabled) closeConfirmationModal();
  }
});

async function initializeCalendar() {
  try {
    console.log('🚀 Initializing DemarcusCuts booking calendar...');
    calendarState.isLoading = true;
    await fetchAvailability();
    renderCalendar();
    console.log('✅ Calendar initialized successfully');
  } catch (error) {
    console.error("Failed to load availability:", error);
    showError("Unable to load availability. Please try again later.");
  } finally {
    calendarState.isLoading = false;
  }
}

async function fetchAvailability() {
  const startDate = formatISODate(calendarState.current);
  const endDate = formatISODate(addDays(calendarState.current, 365));

  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}/api/bookings/availability?clientId=${API_CONFIG.clientId}&startDate=${startDate}&endDate=${endDate}`
    );

    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();
    const normalizedSettings = {
      slotDuration: data.settings?.slotDuration ?? data.settings?.slot_duration,
      bufferTime: data.settings?.bufferTime ?? data.settings?.buffer_time,
      minAdvanceBooking: data.settings?.minAdvanceBooking ?? data.settings?.min_advance_booking,
      maxAdvanceBooking: data.settings?.maxAdvanceBooking ?? data.settings?.max_advance_booking,
      requireApproval: data.settings?.requireApproval ?? data.settings?.require_approval,
      timezone: data.settings?.timezone
    };

    calendarState.availability = { ...data, settings: normalizedSettings };
    calendarState.settings = normalizedSettings;

    console.log('📥 API Response received:', {
      schedules: data.schedules?.length || 0,
      overrides: data.overrides?.length || 0,
      bookings: data.bookings?.length || 0
    });

    calendarState.blockedDates = (data.overrides || [])
      .filter(o => !o.isAvailable)
      .map(o => o.date.split('T')[0]);

    calendarState.appointments = data.bookings || [];

    console.log('🚫 Blocked dates loaded:', calendarState.blockedDates);
    console.log('📅 Appointments loaded:', calendarState.appointments.length);
  } catch (error) {
    console.error("Failed to fetch availability:", error);
    console.log('📋 Falling back to demo mode with sample data');
    calendarState.availability = generateDemoAvailability();
    calendarState.settings = calendarState.availability.settings;
  }
}

function generateDemoAvailability() {
  const schedules = [
    { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", isEnabled: true },
    { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", isEnabled: true },
    { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", isEnabled: true },
    { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", isEnabled: true },
    { dayOfWeek: 5, startTime: "09:00", endTime: "17:00", isEnabled: true },
    { dayOfWeek: 6, startTime: "10:00", endTime: "15:00", isEnabled: true },
  ];
  const bookings = [];
  const baseDate = startOfMonth(new Date());
  for (let i = 0; i < 5; i++) {
    bookings.push({
      date: formatISODate(addDays(baseDate, Math.random() * 30)),
      startTime: "14:00",
      endTime: "15:00",
    });
  }
  return {
    settings: {
      slotDuration: 60,
      bufferTime: 15,
      minAdvanceBooking: 24,
      maxAdvanceBooking: 2160,
      requireApproval: false,
      timezone: "Pacific/Auckland",
    },
    schedules,
    overrides: [],
    bookings,
  };
}

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  submitBooking();
});

async function submitBooking() {
  if (!calendarState.selectedDate) {
    showError("Please select a date");
    return;
  }

  const availableSlots = getAvailableSlots(calendarState.selectedDate);
  if (!availableSlots || availableSlots.length === 0) {
    showError("This date no longer has available time slots.");
    return;
  }

  const formData = new FormData(bookingForm);
  const selectedTime = formData.get("appointmentTime");
  if (!selectedTime) {
    showError("Please select a time");
    return;
  }

  const startTime = appointmentTimeSelect.dataset.startTime24;
  const endTime = appointmentTimeSelect.dataset.endTime24;

  try {
    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Booking...";

    const bookingData = {
      clientId: API_CONFIG.clientId,
      customerName: formData.get("customerName"),
      customerEmail: "",
      customerPhone: formData.get("customerPhone") || "",
      date: calendarState.selectedDate,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      duration: calendarState.settings?.slotDuration || 60,
      notes: formData.get("notes") || "",
    };

    const response = await fetch(`${API_CONFIG.baseURL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookingData),
    });

    if (response.status === 409) {
      showError("This time slot was just booked. Please select another time.");
      await fetchAvailability();
      renderCalendar();
      submitBtn.disabled = false;
      submitBtn.textContent = "Request Booking";
      return;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `Server error: ${response.status}` }));
      if (response.status === 404) throw new Error('Backend API not found. Please check your deployment configuration.');
      throw new Error(error.message || "Failed to book appointment");
    }

    await response.json();
    closeTimeSlotModal();
    showConfirmationModal(bookingData);
    bookingForm.reset();
    calendarState.selectedDate = null;
    await fetchAvailability();
    renderCalendar();
    appointmentDateInput.placeholder = "Choose a date";
    submitBtn.disabled = false;
    submitBtn.textContent = "Request Booking";
  } catch (error) {
    console.error("Booking error:", error);
    showError(error.message || "Failed to submit booking. Please try again.");
    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = "Request Booking";
  }
}

function showConfirmationModal(bookingData) {
  const [year, month, day] = bookingData.date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Pacific/Auckland'
  });
  document.getElementById('confirm-date').textContent = formattedDate;
  document.getElementById('confirm-time').textContent =
    `${formatTime12Hour(bookingData.startTime)} - ${formatTime12Hour(bookingData.endTime)}`;
  document.getElementById('confirm-name').textContent = bookingData.customerName;
  document.getElementById('confirm-phone').textContent = bookingData.customerPhone || '—';
  window.currentBookingData = bookingData;
  startDoneButtonCooldown();
  const modal = document.getElementById('confirmation-modal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function startDoneButtonCooldown() {
  const doneBtn = document.getElementById('done-btn');
  const countdownSpan = document.getElementById('countdown');
  const closeButtons = document.querySelectorAll('.confirmation-header .modal-close');
  let timeLeft = 3;
  doneBtn.disabled = true;
  closeButtons.forEach(btn => {
    btn.disabled = true;
    btn.style.opacity = '0.3';
    btn.style.cursor = 'not-allowed';
  });
  const interval = setInterval(() => {
    timeLeft--;
    countdownSpan.textContent = timeLeft;
    if (timeLeft <= 0) {
      clearInterval(interval);
      doneBtn.textContent = 'Done';
      doneBtn.disabled = false;
      closeButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.style.cursor = '';
      });
    }
  }, 1000);
}

function addToCalendar() {
  if (!window.currentBookingData) return;
  const booking = window.currentBookingData;
  const startDateTime = `${booking.date}T${booking.startTime}:00`;
  const endDateTime = `${booking.date}T${booking.endTime}:00`;
  const formatICS = (dt) => dt.replace(/[-:]/g, '');
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DemarcusCuts//Booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `DTSTART:${formatICS(startDateTime)}`,
    `DTEND:${formatICS(endDateTime)}`,
    'SUMMARY:Haircut Appointment - DemarcusCuts',
    `DESCRIPTION:Appointment with DemarcusCuts\nName: ${booking.customerName}${booking.customerPhone ? `\nPhone: ${booking.customerPhone}` : ''}${booking.notes ? `\nNotes: ${booking.notes}` : ''}`,
    'LOCATION:DemarcusCuts',
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Haircut appointment in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = 'demarcuscuts-appointment.ics';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function closeConfirmationModal() {
  const doneBtn = document.getElementById('done-btn');
  if (doneBtn && doneBtn.disabled) return;
  const modal = document.getElementById('confirmation-modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

function renderFooterYear() {
  if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
}

function renderCalendar() {
  if (!calendarState.availability) {
    calendarGrid.innerHTML = "<p>Loading availability...</p>";
    return;
  }

  const monthStart = calendarState.current;
  const monthDisplay = monthStart.toLocaleDateString(undefined, { month: "long" });
  const yearDisplay = monthStart.getFullYear();

  calendarMonth.textContent = monthDisplay;
  calendarYear.textContent = yearDisplay;

  calendarGrid.innerHTML = "";
  dayLabels.forEach((label) => {
    const cell = document.createElement("div");
    cell.className = "calendar-cell day-label";
    cell.textContent = label;
    calendarGrid.appendChild(cell);
  });

  const firstDayIndex = monthStart.getDay();
  const daysInMonth = new Date(yearDisplay, monthStart.getMonth() + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-cell";
    calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(yearDisplay, monthStart.getMonth(), day);
    const dateStr = formatISODate(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.textContent = day;
    cell.className = "calendar-cell";

    const status = getDayStatus(dateStr);

    if (status === "available") {
      const availableSlots = getAvailableSlots(dateStr);
      cell.classList.add("available");
      cell.setAttribute("data-slot-count", availableSlots.length);
      cell.title = `${availableSlots.length} ${availableSlots.length === 1 ? 'slot' : 'slots'} available`;
      cell.addEventListener("click", () => handleDateSelection(date, dateStr, availableSlots));
    } else if (status === "fully-booked") {
      cell.classList.add("booked");
      cell.disabled = true;
      cell.title = "Fully booked";
    } else {
      cell.classList.add("unavailable-date");
      cell.disabled = true;
      cell.title = "Not available";
    }

    calendarGrid.appendChild(cell);
  }

  console.log(`📅 Calendar rendered: ${monthDisplay} ${yearDisplay}`);
}

// Returns "available", "fully-booked", or "unavailable" for a given date string
function getDayStatus(dateStr) {
  if (!calendarState.availability) return "unavailable";

  const { settings, schedules, overrides } = calendarState.availability;

  // Explicitly blocked via override
  if (calendarState.blockedDates.includes(dateStr)) return "unavailable";
  const override = overrides?.find(o => o.date.split('T')[0] === dateStr);
  if (override && !override.isAvailable) return "unavailable";

  // Outside advance booking window
  const date = new Date(dateStr);
  const now = new Date();
  const hoursUntilDate = (date - now) / (1000 * 60 * 60);
  if (hoursUntilDate < settings.minAdvanceBooking) return "unavailable";
  if (hoursUntilDate > settings.maxAdvanceBooking) return "unavailable";

  // No schedule for this day of week
  const dayOfWeek = getDayOfWeekInTimezone(date);
  const timeRange = override || schedules.find(s => s.dayOfWeek === dayOfWeek && s.isEnabled);
  if (!timeRange) return "unavailable";

  // Has a schedule — check whether any slots remain
  const availableSlots = getAvailableSlots(dateStr);
  if (availableSlots && availableSlots.length > 0) return "available";
  return "fully-booked";
}

function handleDateSelection(date, dateStr, availableSlots) {
  calendarState.selectedDate = dateStr;
  openTimeSlotModal(dateStr, availableSlots);
}

function openTimeSlotModal(dateStr, availableSlots) {
  if (getDayStatus(dateStr) !== "available") {
    showError('This date is not available for booking.');
    return;
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Pacific/Auckland"
  });

  modalDateTitle.textContent = formattedDate;

  const totalSlots = availableSlots.length;
  modalSlotCount.textContent = totalSlots > 0
    ? `${totalSlots} ${totalSlots === 1 ? 'time slot' : 'time slots'} available`
    : 'No available slots';

  const allSlots = generateAllTimeSlots(dateStr);
  const morningSlots = [];
  const afternoonSlots = [];
  const eveningSlots = [];

  allSlots.forEach((slot) => {
    const hour = parseInt(slot.startTime.split(':')[0]);
    const isAvailable = availableSlots.some(
      (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
    );
    const slotData = { ...slot, isAvailable };
    if (hour < 12) morningSlots.push(slotData);
    else if (hour < 17) afternoonSlots.push(slotData);
    else eveningSlots.push(slotData);
  });

  timeSlotsGrid.innerHTML = "";

  if (morningSlots.length > 0) timeSlotsGrid.appendChild(createPeriodSection("Morning", morningSlots, morningSlots.filter(s => s.isAvailable).length, dateStr));
  if (afternoonSlots.length > 0) timeSlotsGrid.appendChild(createPeriodSection("Afternoon", afternoonSlots, afternoonSlots.filter(s => s.isAvailable).length, dateStr));
  if (eveningSlots.length > 0) timeSlotsGrid.appendChild(createPeriodSection("Evening", eveningSlots, eveningSlots.filter(s => s.isAvailable).length, dateStr));

  if (allSlots.length === 0) {
    timeSlotsGrid.innerHTML = '<p class="no-slots-message">No available time slots for this day.</p>';
  }

  timeSlotModal.classList.remove("hidden");
  if (window.innerWidth <= 900) {
    document.body.style.overflow = 'hidden';
    setTimeout(() => timeSlotModal.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  }
}

function createPeriodSection(periodName, slots, availCount, dateStr) {
  const section = document.createElement("div");
  section.className = "time-period-section";
  const label = document.createElement("div");
  label.className = "time-period-label";
  label.textContent = `${periodName} (${availCount} available)`;
  section.appendChild(label);
  const grid = document.createElement("div");
  grid.className = "period-slots-grid";
  slots.forEach((slot) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `time-slot-btn ${slot.isAvailable ? "available" : "booked"}`;
    button.textContent = formatTime12Hour(slot.startTime);
    button.disabled = !slot.isAvailable;
    button.title = slot.isAvailable
      ? `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}`
      : 'Booked';
    if (slot.isAvailable) {
      button.addEventListener("click", () => selectTimeSlot(dateStr, slot));
    }
    grid.appendChild(button);
  });
  section.appendChild(grid);
  return section;
}

function generateAllTimeSlots(dateStr) {
  if (!calendarState.availability) return [];
  const { settings, schedules, overrides } = calendarState.availability;
  const date = new Date(dateStr);
  const dayOfWeek = getDayOfWeekInTimezone(date);
  const override = overrides?.find((o) => o.date.split('T')[0] === dateStr);
  if (override && !override.isAvailable) return [];
  const timeRange = override || schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isEnabled);
  if (!timeRange) return [];
  const slots = [];
  const startMinutes = timeToMinutes(timeRange.startTime);
  const endMinutes = timeToMinutes(timeRange.endTime);
  let current = startMinutes;
  while (current + settings.slotDuration <= endMinutes) {
    slots.push({ startTime: minutesToTime(current), endTime: minutesToTime(current + settings.slotDuration) });
    current += settings.slotDuration + settings.bufferTime;
  }
  return slots;
}

function selectTimeSlot(dateStr, slot) {
  appointmentDateInput.value = dateStr;
  appointmentTimeSelect.value = `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}`;
  appointmentTimeSelect.dataset.startTime24 = slot.startTime;
  appointmentTimeSelect.dataset.endTime24 = slot.endTime;
  closeTimeSlotModal();
  renderCalendar();
  if (window.innerWidth <= 900) {
    showMobileNotification('✓ Time selected! Complete your booking below');
    setTimeout(() => {
      const bookingForm = document.getElementById('booking-form');
      if (bookingForm) {
        bookingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        bookingForm.classList.add('form-highlight');
        setTimeout(() => bookingForm.classList.remove('form-highlight'), 2000);
      }
    }, 300);
  }
}

function closeTimeSlotModal() {
  timeSlotModal.classList.add("hidden");
  if (window.innerWidth <= 900) document.body.style.overflow = '';
}

function showMobileNotification(message) {
  const existingNotif = document.querySelector('.mobile-notification');
  if (existingNotif) existingNotif.remove();
  const notification = document.createElement('div');
  notification.className = 'mobile-notification';
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function getAvailableSlots(dateStr) {
  if (!calendarState.availability) return [];
  const { settings, schedules, overrides, bookings } = calendarState.availability;
  if (calendarState.blockedDates.includes(dateStr)) return [];
  const override = overrides?.find((o) => o.date.split('T')[0] === dateStr);
  if (override && !override.isAvailable) return [];
  const date = new Date(dateStr);
  const dayOfWeek = getDayOfWeekInTimezone(date);
  const now = new Date();
  const hoursUntilDate = (date - now) / (1000 * 60 * 60);
  if (hoursUntilDate < settings.minAdvanceBooking) return [];
  if (hoursUntilDate > settings.maxAdvanceBooking) return [];
  const timeRange = override || schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isEnabled);
  if (!timeRange) return [];
  const startMinutes = timeToMinutes(timeRange.startTime);
  const endMinutes = timeToMinutes(timeRange.endTime);
  const dayBookings = (bookings || []).filter(b => {
    const bookingDate = typeof b.date === 'string' ? b.date.split('T')[0] : b.date;
    return bookingDate === dateStr;
  });
  const dayAppointments = calendarState.appointments.filter(apt => {
    const aptDate = typeof apt.date === 'string' ? apt.date.split('T')[0] : apt.date;
    return aptDate === dateStr;
  });
  const slots = [];
  let current = startMinutes;
  while (current + settings.slotDuration <= endMinutes) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + settings.slotDuration);
    const isBooked =
      dayBookings.some((b) => timeOverlaps(slotStart, slotEnd, b.startTime, b.endTime)) ||
      dayAppointments.some((apt) => timeOverlaps(slotStart, slotEnd, apt.startTime || apt.start_time, apt.endTime || apt.end_time));
    if (!isBooked) slots.push({ startTime: slotStart, endTime: slotEnd });
    current += settings.slotDuration + settings.bufferTime;
  }
  return slots;
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeOverlaps(start1, end1, start2, end2) {
  return timeToMinutes(start1) < timeToMinutes(end2) && timeToMinutes(end1) > timeToMinutes(start2);
}

function showError(message) {
  alert(message);
  console.error(message);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const contactForm = document.getElementById('contact-form');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(contactForm);
    const submitBtn = contactForm.querySelector('button[type="submit"]');
    const statusMsg = document.getElementById('contact-form-status');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    statusMsg.textContent = '';
    statusMsg.className = 'form-status';
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone'),
          message: formData.get('message')
        })
      });
      const data = await response.json();
      if (response.ok) {
        statusMsg.textContent = "✓ Message sent successfully! We'll get back to you soon.";
        statusMsg.className = 'form-status success';
        contactForm.reset();
      } else {
        throw new Error(data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Contact form error:', error);
      statusMsg.textContent = '✗ Failed to send message. Please try emailing us directly.';
      statusMsg.className = 'form-status error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Message';
    }
  });
}
