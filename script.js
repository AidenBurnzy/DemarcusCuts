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
  // Create a date string in Pacific/Auckland timezone
  const aucklandDateStr = date.toLocaleDateString('en-NZ', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Parse the NZ date string (format: DD/MM/YYYY)
  const [day, month, year] = aucklandDateStr.split('/').map(Number);
  
  // Create a new date object with the Auckland date
  const aucklandDate = new Date(year, month - 1, day);
  
  // Return the day of week (0=Sunday through 6=Saturday)
  return aucklandDate.getDay();
}

// API Configuration
const API_CONFIG = {
  baseURL: "http://localhost:3001",
  clientId: "15",
};

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

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !timeSlotModal.classList.contains("hidden")) {
    closeTimeSlotModal();
  }
});

// Initialize calendar with API data
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

// Fetch availability from Auctus API
async function fetchAvailability() {
  const startDate = formatISODate(calendarState.current);
  const endDate = formatISODate(addDays(calendarState.current, 365));

  try {
    const response = await fetch(
      `${API_CONFIG.baseURL}/api/bookings/availability?clientId=${API_CONFIG.clientId}&startDate=${startDate}&endDate=${endDate}`
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    calendarState.availability = data;
    calendarState.settings = data.settings;
    
    console.log('📥 API Response received:', {
      schedules: data.schedules?.length || 0,
      overrides: data.overrides?.length || 0,
      bookings: data.bookings?.length || 0
    });
    
    // Extract blocked dates from overrides (where isAvailable = false)
    // Convert ISO timestamps to YYYY-MM-DD format
    calendarState.blockedDates = (data.overrides || [])
      .filter(o => !o.isAvailable)
      .map(o => {
        // Handle both ISO timestamp and simple date string formats
        const dateStr = o.date.split('T')[0]; // Extract YYYY-MM-DD from ISO timestamp
        return dateStr;
      });
    
    // Store all appointments/bookings
    calendarState.appointments = data.bookings || [];
    
    console.log('🚫 Blocked dates loaded:', calendarState.blockedDates);
    console.log('📅 Appointments loaded:', calendarState.appointments.length);
    
    if (data.overrides && data.overrides.length > 0) {
      console.log('📋 All overrides:', data.overrides);
    }
  } catch (error) {
    console.error("Failed to fetch availability:", error);
    // Fallback to demo mode
    calendarState.availability = generateDemoAvailability();
    calendarState.settings = calendarState.availability.settings;
  }
}

// Generate demo availability for testing (when API is unavailable)
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
      timezone: "America/New_York",
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

  // Validate that the selected date is not blocked
  if (calendarState.blockedDates.includes(calendarState.selectedDate)) {
    showError("This date is no longer available for booking.");
    console.warn('❌ Attempted to book blocked date:', calendarState.selectedDate);
    return;
  }

  // Double-check that the date still has available slots
  const availableSlots = getAvailableSlots(calendarState.selectedDate);
  if (!availableSlots || availableSlots.length === 0) {
    showError("This date no longer has available time slots.");
    console.warn('❌ Attempted to book date with no available slots:', calendarState.selectedDate);
    return;
  }

  const formData = new FormData(bookingForm);
  const selectedTime = formData.get("appointmentTime");

  if (!selectedTime) {
    showError("Please select a time");
    return;
  }

  const [startTime, endTime] = selectedTime.split(" - ");

  try {
    // Disable button and show loading state
    const submitBtn = bookingForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = "Booking...";

    const bookingData = {
      clientId: API_CONFIG.clientId,
      customerName: formData.get("customerName"),
      customerEmail: formData.get("customerEmail"),
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
      const error = await response.json();
      throw new Error(error.message || "Failed to book appointment");
    }

    const result = await response.json();

    // Close time slot modal if open
    closeTimeSlotModal();

    // Show custom confirmation modal
    showConfirmationModal(bookingData);

    // Reset form and calendar
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
  // Parse the date string correctly (format: YYYY-MM-DD)
  const [year, month, day] = bookingData.date.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  // Format with Pacific/Auckland timezone
  const formattedDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Pacific/Auckland'
  });
  
  // Generate a booking confirmation code
  const confirmCode = generateBookingCode();
  
  // Populate modal with booking details
  document.getElementById('confirm-code').textContent = confirmCode;
  document.getElementById('confirm-date').textContent = formattedDate;
  document.getElementById('confirm-time').textContent = 
    `${formatTime12Hour(bookingData.startTime)} - ${formatTime12Hour(bookingData.endTime)}`;
  document.getElementById('confirm-name').textContent = bookingData.customerName;
  document.getElementById('confirm-email').textContent = bookingData.customerEmail;
  document.getElementById('confirm-phone').textContent = bookingData.customerPhone || '—';
  
  // Show the confirmation modal
  const modal = document.getElementById('confirmation-modal');
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
}

function generateBookingCode() {
  // Generate a 6-character alphanumeric code
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function closeConfirmationModal() {
  const modal = document.getElementById('confirmation-modal');
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

function renderFooterYear() {
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }
}

function renderCalendar() {
  if (!calendarState.availability) {
    calendarGrid.innerHTML = "<p>Loading availability...</p>";
    return;
  }

  const monthStart = calendarState.current;
  const monthDisplay = monthStart.toLocaleDateString(undefined, {
    month: "long",
  });
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

    if (calendarState.selectedDate && calendarState.selectedDate === dateStr) {
      cell.classList.add("selected");
    }

    // Check if date is blocked
    const isBlocked = calendarState.blockedDates.includes(dateStr);
    
    if (isBlocked) {
      cell.classList.add("blocked-date");
      cell.disabled = true;
      cell.title = "This date is closed";
      console.log('🚫 Rendering blocked date:', dateStr);
    } else {
      const availableSlots = getAvailableSlots(dateStr);
      if (availableSlots && availableSlots.length > 0) {
        cell.classList.add("available");
        cell.setAttribute("data-slot-count", availableSlots.length);
        cell.title = `${availableSlots.length} ${availableSlots.length === 1 ? 'slot' : 'slots'} available`;
        cell.addEventListener("click", () => handleDateSelection(date, dateStr, availableSlots));
      } else {
        cell.classList.add("booked");
        cell.disabled = true;
        cell.title = "Fully booked";
      }
    }

    calendarGrid.appendChild(cell);
  }
  
  console.log(`📅 Calendar rendered: ${monthDisplay} ${yearDisplay}, Blocked dates in view: ${calendarState.blockedDates.length}`);
}

function handleDateSelection(date, dateStr, availableSlots) {
  calendarState.selectedDate = dateStr;
  openTimeSlotModal(dateStr, availableSlots);
}

function openTimeSlotModal(dateStr, availableSlots) {
  // Safety check: prevent opening modal for blocked dates
  const isBlocked = calendarState.blockedDates.includes(dateStr);
  if (isBlocked) {
    console.warn('⚠️ Attempted to open blocked date:', dateStr);
    showError('This date is not available for booking.');
    return;
  }
  
  // Parse the date string correctly (format: YYYY-MM-DD)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day); // Creates date in local timezone
  
  // Format with Pacific/Auckland timezone to match server
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Pacific/Auckland"
  });

  modalDateTitle.textContent = formattedDate;

  // Display total slot count
  const totalSlots = availableSlots.length;
  if (totalSlots > 0) {
    modalSlotCount.textContent = `${totalSlots} ${totalSlots === 1 ? 'time slot' : 'time slots'} available`;
  } else {
    modalSlotCount.textContent = 'No available slots';
  }

  // Generate all possible time slots
  const allSlots = generateAllTimeSlots(dateStr);

  // Group slots by time of day
  const morningSlots = [];
  const afternoonSlots = [];
  const eveningSlots = [];

  allSlots.forEach((slot) => {
    const hour = parseInt(slot.startTime.split(':')[0]);
    const isAvailable = availableSlots.some(
      (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
    );
    
    const slotData = { ...slot, isAvailable };
    
    if (hour < 12) {
      morningSlots.push(slotData);
    } else if (hour < 17) {
      afternoonSlots.push(slotData);
    } else {
      eveningSlots.push(slotData);
    }
  });

  // Build the modal content with period sections
  timeSlotsGrid.innerHTML = "";

  const morningAvailCount = morningSlots.filter(s => s.isAvailable).length;
  const afternoonAvailCount = afternoonSlots.filter(s => s.isAvailable).length;
  const eveningAvailCount = eveningSlots.filter(s => s.isAvailable).length;

  if (morningSlots.length > 0) {
    const section = createPeriodSection("Morning", morningSlots, morningAvailCount, dateStr);
    timeSlotsGrid.appendChild(section);
  }

  if (afternoonSlots.length > 0) {
    const section = createPeriodSection("Afternoon", afternoonSlots, afternoonAvailCount, dateStr);
    timeSlotsGrid.appendChild(section);
  }

  if (eveningSlots.length > 0) {
    const section = createPeriodSection("Evening", eveningSlots, eveningAvailCount, dateStr);
    timeSlotsGrid.appendChild(section);
  }

  if (allSlots.length === 0) {
    timeSlotsGrid.innerHTML = '<p class="no-slots-message">No available time slots for this day.</p>';
  }

  timeSlotModal.classList.remove("hidden");
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
    button.title = slot.isAvailable ? `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}` : 'Booked';

    if (slot.isAvailable) {
      button.addEventListener("click", () => {
        selectTimeSlot(dateStr, slot);
      });
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

  // Check for override (handle ISO timestamp format)
  const override = overrides?.find((o) => {
    const overrideDate = o.date.split('T')[0]; // Extract YYYY-MM-DD from ISO timestamp
    return overrideDate === dateStr;
  });
  if (override && !override.isAvailable) return [];

  // Get schedule for this day
  const timeRange = override || schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isEnabled);
  if (!timeRange) return [];

  const slots = [];
  const startMinutes = timeToMinutes(timeRange.startTime);
  const endMinutes = timeToMinutes(timeRange.endTime);

  let current = startMinutes;
  while (current + settings.slotDuration <= endMinutes) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + settings.slotDuration);
    slots.push({ startTime: slotStart, endTime: slotEnd });
    current += settings.slotDuration + settings.bufferTime;
  }

  return slots;
}

function selectTimeSlot(dateStr, slot) {
  appointmentDateInput.value = dateStr;
  appointmentTimeSelect.value = `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}`;
  closeTimeSlotModal();
  renderCalendar();
}

function closeTimeSlotModal() {
  timeSlotModal.classList.add("hidden");
}

// Calculate available time slots for a specific date
function getAvailableSlots(dateStr) {
  if (!calendarState.availability) return [];

  const { settings, schedules, overrides, bookings } = calendarState.availability;

  // Check if date is explicitly blocked
  if (calendarState.blockedDates.includes(dateStr)) {
    return []; // Day is blocked
  }

  // Check for date-specific override (handle ISO timestamp format)
  const override = overrides?.find((o) => {
    const overrideDate = o.date.split('T')[0]; // Extract YYYY-MM-DD from ISO timestamp
    return overrideDate === dateStr;
  });
  if (override && !override.isAvailable) return []; // Day is blocked

  // Get day of week (0=Sunday, 6=Saturday)
  const date = new Date(dateStr);
  const dayOfWeek = getDayOfWeekInTimezone(date);

  // Check if within advance booking window
  const now = new Date();
  const hoursUntilDate = (date - now) / (1000 * 60 * 60);

  if (hoursUntilDate < settings.minAdvanceBooking) return []; // Too soon to book
  if (hoursUntilDate > settings.maxAdvanceBooking) return []; // Too far in advance

  // Get schedule for this day
  const timeRange = override || schedules.find((s) => s.dayOfWeek === dayOfWeek && s.isEnabled);
  if (!timeRange) return []; // Not available this day

  const slots = [];
  const startMinutes = timeToMinutes(timeRange.startTime);
  const endMinutes = timeToMinutes(timeRange.endTime);

  // Get bookings for this specific date
  const dayBookings = (bookings || []).filter(b => b.date === dateStr);
  const dayAppointments = calendarState.appointments.filter(apt => apt.date === dateStr || apt.appointment_date === dateStr);
  
  let current = startMinutes;
  while (current + settings.slotDuration <= endMinutes) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + settings.slotDuration);

    // Check if slot conflicts with existing bookings from API
    const isBookedInAPI = dayBookings.some(
      (b) => timeOverlaps(slotStart, slotEnd, b.startTime, b.endTime)
    );
    
    // Check if slot conflicts with appointments
    const isBookedAppointment = dayAppointments.some(
      (apt) => timeOverlaps(slotStart, slotEnd, apt.startTime || apt.start_time, apt.endTime || apt.end_time)
    );

    if (!isBookedInAPI && !isBookedAppointment) {
      slots.push({ startTime: slotStart, endTime: slotEnd });
    }

    current += settings.slotDuration + settings.bufferTime;
  }

  return slots;
}

// Helper: Convert time string "HH:MM" to minutes
function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper: Convert minutes back to "HH:MM"
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// Helper: Check if two time ranges overlap
function timeOverlaps(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

// Show error message to user
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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatISODate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}
