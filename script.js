const calendarGrid = document.getElementById("calendar-grid");
const calendarMonth = document.getElementById("calendar-month");
const calendarYear = document.getElementById("calendar-year");
const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const appointmentDateInput = document.getElementById("appointment-date");
const appointmentTimeSelect = document.getElementById("appointment-time");
const bookingForm = document.getElementById("booking-form");
const popularSlotsList = document.getElementById("popular-slots");
const currentYearSpan = document.getElementById("current-year");

const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const availability = generateMockAvailability();
const popularSlots = derivePopularSlots(availability);

const calendarState = {
  current: startOfMonth(new Date()),
  selectedDate: null,
};

renderFooterYear();
renderPopularSlots(popularSlots);
renderCalendar();

prevMonthBtn.addEventListener("click", () => {
  calendarState.current = addMonths(calendarState.current, -1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  calendarState.current = addMonths(calendarState.current, 1);
  renderCalendar();
});

bookingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const payload = new FormData(bookingForm);
  const submittedData = Object.fromEntries(payload.entries());
  /* eslint-disable no-console */
  console.log("Booking request submitted", submittedData);
  /* eslint-enable no-console */
  bookingForm.reset();
  appointmentTimeSelect.innerHTML = `<option value="" disabled selected>Select a time</option>`;
  calendarState.selectedDate = null;
  renderCalendar();
  appointmentDateInput.placeholder = "Choose a date";
  alert("Thanks! We received your booking request and will confirm soon.");
});

function renderFooterYear() {
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }
}

function renderPopularSlots(slots) {
  if (!popularSlotsList) return;
  popularSlotsList.innerHTML = "";
  slots.forEach(({ date, time }) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `<span>${formatReadableDate(date)}</span><span>${time}</span>`;
    popularSlotsList.appendChild(listItem);
  });
}

function renderCalendar() {
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
    const dateKey = makeDateKey(date);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.textContent = day;
    cell.className = "calendar-cell";

    if (calendarState.selectedDate && isSameDate(date, calendarState.selectedDate)) {
      cell.classList.add("selected");
    }

    if (availability[dateKey] && availability[dateKey].length > 0) {
      cell.classList.add("available");
      cell.addEventListener("click", () => handleDateSelection(date, dateKey));
    } else {
      cell.classList.add("booked");
      cell.disabled = true;
    }

    calendarGrid.appendChild(cell);
  }
}

function handleDateSelection(date, dateKey) {
  calendarState.selectedDate = date;
  appointmentDateInput.value = formatISODate(date);
  appointmentDateInput.placeholder = "";
  populateTimeOptions(availability[dateKey]);
  renderCalendar();
}

function populateTimeOptions(times = []) {
  appointmentTimeSelect.innerHTML = `<option value="" disabled selected>Select a time</option>`;
  times.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot;
    option.textContent = slot;
    appointmentTimeSelect.appendChild(option);
  });
}

function generateMockAvailability() {
  const data = {};
  const baseDate = startOfMonth(new Date());
  for (let i = 0; i < 60; i += 1) {
    const current = addDays(baseDate, i);
    const weekday = current.getDay();
    if ([0].includes(weekday)) continue;
    const dateKey = makeDateKey(current);
    const slots = ["9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:00 PM"];
    if (weekday === 6) slots.splice(4, 1);
    if (weekday === 3) slots.splice(2, 1);
    data[dateKey] = slots.slice();
  }
  return data;
}

function derivePopularSlots(data) {
  return Object.entries(data)
    .slice(0, 5)
    .map(([date, times]) => ({ date, time: times[0] }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
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

function makeDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
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

function formatReadableDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
