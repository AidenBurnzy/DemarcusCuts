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

// Get day of week in Pacific/Auckland timezone
function getDayOfWeekInTimezone(date) {
  const dateStr = date.toLocaleDateString('en-US', {
    timeZone: 'Pacific/Auckland',
    weekday: 'short'
  });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.indexOf(dateStr.slice(0, 3));
}

// API Configuration
const API_CONFIG = {
  baseURL: "https://auctus-app.vercel.app",
  clientId: "15",
};

const calendarState = {
  current: startOfMonth(new Date()),
  selectedDate: null,
  availability: null,
  settings: null,
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
    calendarState.isLoading = true;
    await fetchAvailability();
    renderCalendar();
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
  const endDate = formatISODate(addDays(calendarState.current, 90));

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

    const response = await fetch(`${API_CONFIG.baseURL}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: API_CONFIG.clientId,
        customerName: formData.get("name") || formData.get("customerName"),
        customerEmail: formData.get("email") || formData.get("customerEmail"),
        customerPhone: formData.get("phone") || formData.get("customerPhone"),
        date: calendarState.selectedDate,
        startTime: startTime.trim(),
        endTime: endTime.trim(),
        duration: calendarState.settings?.slotDuration || 60,
        notes: formData.get("notes") || "",
      }),
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

    if (result.booking.requiresApproval || calendarState.settings?.requireApproval) {
      alert(
        "Booking request submitted! Demarcus will review and confirm via email within 24 hours."
      );
    } else {
      alert(
        `Booking confirmed for ${calendarState.selectedDate} at ${formatTime12Hour(startTime)}! Check your email for details.`
      );
    }

    bookingForm.reset();
    appointmentTimeSelect.innerHTML = `<option value="" disabled selected>Select a time</option>`;
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

    if (calendarState.selectedDate && isSameDate(date, calendarState.selectedDate)) {
      cell.classList.add("selected");
    }

    const availableSlots = getAvailableSlots(dateStr);
    if (availableSlots && availableSlots.length > 0) {
      cell.classList.add("available");
      cell.addEventListener("click", () => handleDateSelection(date, dateStr, availableSlots));
    } else {
      cell.classList.add("booked");
      cell.disabled = true;
    }

    calendarGrid.appendChild(cell);
  }
}

function handleDateSelection(date, dateStr, availableSlots) {
  calendarState.selectedDate = date;
  openTimeSlotModal(dateStr, availableSlots);
}

function openTimeSlotModal(dateStr, availableSlots) {
  const date = new Date(dateStr);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  modalDateTitle.textContent = formattedDate;

  // Generate all possible time slots
  const allSlots = generateAllTimeSlots(dateStr);

  timeSlotsGrid.innerHTML = "";

  allSlots.forEach((slot) => {
    const isAvailable = availableSlots.some(
      (s) => s.startTime === slot.startTime && s.endTime === slot.endTime
    );

    const button = document.createElement("button");
    button.type = "button";
    button.className = `time-slot ${isAvailable ? "available" : "booked"}`;
    button.textContent = `${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}`;
    button.disabled = !isAvailable;

    if (isAvailable) {
      button.addEventListener("click", () => {
        selectTimeSlot(dateStr, slot);
      });
    }

    timeSlotsGrid.appendChild(button);
  });

  timeSlotModal.classList.remove("hidden");
}

function generateAllTimeSlots(dateStr) {
  if (!calendarState.availability) return [];

  const { settings, schedules, overrides } = calendarState.availability;

  const date = new Date(dateStr);
  const dayOfWeek = getDayOfWeekInTimezone(date);

  // Check for override
  const override = overrides?.find((o) => o.date === dateStr);
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
  appointmentTimeSelect.value = `${slot.startTime} - ${slot.endTime}`;
  appointmentTimeSelect.innerHTML = `<option value="" disabled>Select a time</option><option value="${slot.startTime} - ${slot.endTime}" selected>${formatTime12Hour(slot.startTime)} - ${formatTime12Hour(slot.endTime)}</option>`;
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

  // Check for date-specific override
  const override = overrides?.find((o) => o.date === dateStr);
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

  let current = startMinutes;
  while (current + settings.slotDuration <= endMinutes) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + settings.slotDuration);

    // Check if slot conflicts with existing bookings
    const isBooked = bookings?.some(
      (b) =>
        b.date === dateStr &&
        timeOverlaps(slotStart, slotEnd, b.startTime, b.endTime)
    );

    if (!isBooked) {
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
