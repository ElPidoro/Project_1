const STORAGE_KEY = "nextlab_habit_balance_mvp_v1";

const SPHERES = [
  { key: "Навчання", label: "Навчання" },
  { key: "Спорт", label: "Спорт" },
  { key: "Сон", label: "Сон" },
  { key: "Відпочинок", label: "Відпочинок" },
  { key: "Здоров'я", label: "Здоров'я" },
  { key: "Особисте", label: "Особисті проєкти" }
];

function getTodayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function createDefaultState() {
  const today = getTodayISO(0);
  const history = {};

  // Генеруємо реалістичну історію за останні 21 день для старту
  for (let i = 21; i >= 1; i--) {
    const dateKey = getTodayISO(-i);
    const doneIds = [];
    if (i % 2 === 0 || i % 3 === 0) doneIds.push("h1");
    if (i % 2 !== 0) doneIds.push("h2");
    if (i % 4 !== 0) doneIds.push("h3");
    if (i % 3 === 0) doneIds.push("h4");
    history[dateKey] = doneIds;
  }
  history[today] = ["h1"];

  return {
    activeDate: today,
    selectedCategory: "Усі",
    heatmapDays: 90,
    selectedInspectDate: today,
    habits: [
      { id: "h1", title: "Ранкова розминка та турнік (20 хв)", category: "Спорт", weeklyGoal: 5, archived: false },
      { id: "h2", title: "Підготовка до предметів / код без відволікань", category: "Навчання", weeklyGoal: 6, archived: false },
      { id: "h3", title: "Лягти спати до 23:30 без телефону", category: "Сон", weeklyGoal: 7, archived: false },
      { id: "h4", title: "Прогулянка або відпочинок для очей 30 хв", category: "Відпочинок", weeklyGoal: 5, archived: false }
    ],
    history,
    balance: {
      "Навчання": 8,
      "Спорт": 7,
      "Сон": 6,
      "Відпочинок": 4,
      "Здоров'я": 7,
      "Особисте": 8
    },
    prevBalance: {
      "Навчання": 7,
      "Спорт": 6,
      "Сон": 5,
      "Відпочинок": 5,
      "Здоров'я": 6,
      "Особисте": 7
    }
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.habits) || typeof parsed.history !== "object") {
      return createDefaultState();
    }
    return parsed;
  } catch (e) {
    console.warn("Пошкоджені дані в localStorage, відновлено стартовий стан:", e);
    return createDefaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Помилка запису в localStorage:", e);
  }
}

let state = loadState();

// Автоматична перевірка переходу на новий календарний день
function syncRealCalendarDate() {
  const realToday = getTodayISO(0);
  if (state.activeDate !== realToday) {
    state.activeDate = realToday;
    if (!Array.isArray(state.history[realToday])) {
      state.history[realToday] = [];
    }
    state.selectedInspectDate = realToday;
    saveState();
  }
}

function calculateStreak(habitId) {
  let streak = 0;
  let offset = 0;
  const todayList = state.history[state.activeDate] || [];
  if (!todayList.includes(habitId)) {
    offset = -1;
  }

  while (offset > -365) {
    const d = new Date(state.activeDate);
    d.setDate(d.getDate() + offset);
    const key = d.toISOString().slice(0, 10);
    const list = state.history[key] || [];
    if (list.includes(habitId)) {
      streak++;
      offset--;
    } else {
      break;
    }
  }
  return streak;
}

function getWeakestSphere() {
  let minSphere = SPHERES[0];
  let minVal = state.balance[minSphere.key] ?? 10;
  for (const s of SPHERES) {
    const val = state.balance[s.key] ?? 5;
    if (val < minVal) {
      minVal = val;
      minSphere = s;
    }
  }
  return { sphere: minSphere, value: minVal };
}

// --- RENDER TODAY ---
function renderToday() {
  const activeHabits = state.habits.filter(h => !h.archived);
  const doneToday = state.history[state.activeDate] || [];
  const completedCount = activeHabits.filter(h => doneToday.includes(h.id)).length;
  const percent = activeHabits.length ? Math.round((completedCount / activeHabits.length) * 100) : 0;

  document.getElementById("current-date-label").textContent = `Активна дата: ${state.activeDate}`;
  document.getElementById("today-percent-badge").textContent = `${percent}%`;
  document.getElementById("today-progress-bar").style.width = `${percent}%`;
  document.getElementById("today-summary-text").textContent =
    `Виконано ${completedCount} із ${activeHabits.length} активних звичок`;

  const values = SPHERES.map(s => state.balance[s.key] || 0);
  const avg = (values.reduce((a, b) => a + b, 0) / SPHERES.length).toFixed(1);
  const weakest = getWeakestSphere();
  document.getElementById("balance-avg-badge").textContent = `${avg} / 10`;
  document.getElementById("weakest-sphere-hint").textContent =
    `Найбільше просідає: ${weakest.sphere.label} (${weakest.value}/10)`;

  const listEl = document.getElementById("today-habit-list");
  listEl.innerHTML = "";

  const filtered = activeHabits.filter(
    h => state.selectedCategory === "Усі" || h.category === state.selectedCategory
  );

  if (!filtered.length) {
    listEl.innerHTML = `<li class="muted-text">У цій категорії поки немає активних звичок.</li>`;
    return;
  }

  filtered.forEach(habit => {
    const isDone = doneToday.includes(habit.id);
    const streak = calculateStreak(habit.id);

    const li = document.createElement("li");
    li.className = `habit-item ${isDone ? "done" : ""}`;
    li.innerHTML = `
      <label class="habit-left">
        <input type="checkbox" class="habit-checkbox" ${isDone ? "checked" : ""} />
        <span class="habit-title">${escapeHtml(habit.title)}</span>
      </label>
      <div class="habit-meta">
        <span class="cat-tag">${escapeHtml(habit.category)}</span>
        <span class="streak-badge" title="Поточна серія днів">🔥 ${streak} дн.</span>
      </div>
    `;

    li.querySelector("input").addEventListener("change", () => {
      toggleHabitToday(habit.id);
    });

    listEl.appendChild(li);
  });
}

function toggleHabitToday(habitId) {
  const list = state.history[state.activeDate] || [];
  const idx = list.indexOf(habitId);
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    list.push(habitId);
  }
  state.history[state.activeDate] = list;
  saveState();
  renderAll();
}

// --- RENDER HEATMAP ---
function renderHeatmap() {
  const grid = document.getElementById("heatmap-grid");
  grid.innerHTML = "";

  const activeHabits = state.habits.filter(h => !h.archived);
  const totalHabits = Math.max(activeHabits.length, 1);
  const days = state.heatmapDays;

  let bestStreak = 0;
  let tempStreak = 0;
  let totalRatioSum = 0;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(state.activeDate);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    const doneIds = state.history[dateKey] || [];
    const ratio = Math.min(doneIds.length / totalHabits, 1);
    totalRatioSum += ratio;

    if (doneIds.length > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }

    let level = 0;
    if (ratio > 0 && ratio <= 0.25) level = 1;
    else if (ratio > 0.25 && ratio <= 0.5) level = 2;
    else if (ratio > 0.5 && ratio < 1) level = 3;
    else if (ratio >= 1 && doneIds.length > 0) level = 4;

    const cell = document.createElement("div");
    cell.className = `cell lv-${level} ${state.selectedInspectDate === dateKey ? "selected" : ""}`;
    cell.title = `${dateKey}: виконано ${doneIds.length} звичок (${Math.round(ratio * 100)}%)`;
    cell.addEventListener("click", () => {
      state.selectedInspectDate = dateKey;
      renderHeatmap();
    });
    grid.appendChild(cell);
  }

  document.getElementById("stat-best-streak").textContent = `${bestStreak} дн.`;
  document.getElementById("stat-current-streak").textContent = `${tempStreak} дн.`;
  document.getElementById("stat-avg-rate").textContent = `${Math.round((totalRatioSum / days) * 100)}%`;

  renderDayInspector();
}

function renderDayInspector() {
  const dateKey = state.selectedInspectDate;
  const doneIds = state.history[dateKey] || [];
  const titleEl = document.getElementById("inspector-date-title");
  const bodyEl = document.getElementById("inspector-date-body");

  titleEl.textContent = `Звіт за ${dateKey}`;
  if (!doneIds.length) {
    bodyEl.textContent = "У цей день виконаних звичок не зафіксовано.";
    return;
  }

  const names = doneIds.map(id => {
    const found = state.habits.find(h => h.id === id);
    return found ? `• ${found.title} (${found.category})` : `• Звичка #${id}`;
  });
  bodyEl.innerHTML = names.map(n => `<div>${escapeHtml(n)}</div>`).join("");
}

// --- RENDER BALANCE WHEEL ---
function renderBalance() {
  const container = document.getElementById("sliders-container");
  container.innerHTML = "";

  SPHERES.forEach(s => {
    const val = state.balance[s.key] ?? 5;
    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `
      <div class="slider-label">
        <span>${s.label}</span>
        <strong>${val} / 10</strong>
      </div>
      <input type="range" min="1" max="10" value="${val}" />
    `;
    row.querySelector("input").addEventListener("input", e => {
      state.balance[s.key] = Number(e.target.value);
      saveState();
      drawBalanceCanvas();
      updateBalanceAdvice();
      row.querySelector("strong").textContent = `${e.target.value} / 10`;
    });
    container.appendChild(row);
  });

  drawBalanceCanvas();
  updateBalanceAdvice();
}

function updateBalanceAdvice() {
  const weakest = getWeakestSphere();
  document.getElementById("balance-advice-text").textContent =
    `Зараз найбільше просідає сфера «${weakest.sphere.label}» (${weakest.value}/10). Додай просту щоденну дію, щоб вирівняти колесо.`;
}

function drawBalanceCanvas() {
  const canvas = document.getElementById("balance-canvas");
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = 145;
  const count = SPHERES.length;

  ctx.clearRect(0, 0, w, h);

  // Сітка кіл (2, 4, 6, 8, 10)
  for (let step = 2; step <= 10; step += 2) {
    ctx.beginPath();
    ctx.arc(cx, cy, (maxR * step) / 10, 0, Math.PI * 2);
    ctx.strokeStyle = "#30363d";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Осі та підписи
  SPHERES.forEach((s, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = cx + Math.cos(angle) * maxR;
    const y = cy + Math.sin(angle) * maxR;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#30363d";
    ctx.stroke();

    const lx = cx + Math.cos(angle) * (maxR + 28);
    const ly = cy + Math.sin(angle) * (maxR + 28);
    ctx.fillStyle = "#e6edf3";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.label, lx, ly);
  });

  // Попередній зріз (пунктир)
  drawPolygon(ctx, cx, cy, maxR, state.prevBalance, "rgba(88, 166, 255, 0.1)", "#58a6ff", true);

  // Поточний тиждень
  drawPolygon(ctx, cx, cy, maxR, state.balance, "rgba(57, 211, 83, 0.28)", "#39d353", false);
}

function drawPolygon(ctx, cx, cy, maxR, dataMap, fillStyle, strokeStyle, dashed) {
  const count = SPHERES.length;
  ctx.save();
  ctx.beginPath();
  SPHERES.forEach((s, i) => {
    const val = dataMap[s.key] ?? 5;
    const r = (maxR * val) / 10;
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  if (dashed) ctx.setLineDash([5, 5]);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = strokeStyle;
  ctx.stroke();
  ctx.restore();
}

// --- RENDER MANAGE ---
function renderManage() {
  const listEl = document.getElementById("manage-habits-list");
  listEl.innerHTML = "";

  state.habits.forEach(habit => {
    const row = document.createElement("div");
    row.className = `manage-row ${habit.archived ? "archived" : ""}`;
    row.innerHTML = `
      <input type="text" value="${escapeHtml(habit.title)}" aria-label="Назва звички" />
      <select aria-label="Категорія">
        ${["Спорт", "Навчання", "Сон", "Відпочинок", "Здоров'я"]
          .map(c => `<option value="${c}" ${habit.category === c ? "selected" : ""}>${c}</option>`)
          .join("")}
      </select>
      <div class="btn-row" style="margin-top:0">
        <button class="btn btn-secondary toggle-arch-btn">${habit.archived ? "Відновити" : "В архів"}</button>
        <button class="btn btn-danger del-btn">Видалити</button>
      </div>
    `;

    const titleInput = row.querySelector("input");
    const catSelect = row.querySelector("select");

    titleInput.addEventListener("change", () => {
      if (titleInput.value.trim()) {
        habit.title = titleInput.value.trim();
        saveState();
        renderAll();
      }
    });

    catSelect.addEventListener("change", () => {
      habit.category = catSelect.value;
      saveState();
      renderAll();
    });

    row.querySelector(".toggle-arch-btn").addEventListener("click", () => {
      habit.archived = !habit.archived;
      saveState();
      renderAll();
    });

    row.querySelector(".del-btn").addEventListener("click", () => {
      state.habits = state.habits.filter(h => h.id !== habit.id);
      saveState();
      renderAll();
    });

    listEl.appendChild(row);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderAll() {
  renderToday();
  renderHeatmap();
  renderBalance();
  renderManage();
}

// --- EVENTS ---
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.goto;
    document.querySelector(`.nav-btn[data-tab="${target}"]`).click();
  });
});

document.querySelectorAll("#category-filters .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll("#category-filters .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    state.selectedCategory = pill.dataset.cat;
    saveState();
    renderToday();
  });
});

document.querySelectorAll(".period-switch .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".period-switch .pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    state.heatmapDays = Number(pill.dataset.days);
    saveState();
    renderHeatmap();
  });
});

document.getElementById("quick-add-form").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("habit-title-input");
  const select = document.getElementById("habit-cat-select");
  const title = input.value.trim();
  if (!title) return;

  state.habits.push({
    id: "h_" + Date.now(),
    title,
    category: select.value,
    weeklyGoal: 5,
    archived: false
  });
  input.value = "";
  saveState();
  renderAll();
});

document.getElementById("save-week-snapshot-btn").addEventListener("click", () => {
  state.prevBalance = { ...state.balance };
  saveState();
  drawBalanceCanvas();
});

document.getElementById("add-weak-habit-btn").addEventListener("click", () => {
  const weakest = getWeakestSphere().sphere.key;
  const mappedCat = ["Спорт", "Навчання", "Сон", "Відпочинок", "Здоров'я"].includes(weakest)
    ? weakest
    : "Відпочинок";

  document.querySelector('.nav-btn[data-tab="today"]').click();
  const select = document.getElementById("habit-cat-select");
  const input = document.getElementById("habit-title-input");
  select.value = mappedCat;
  input.focus();
});

document.getElementById("simulate-next-day-btn").addEventListener("click", () => {
  const next = new Date(state.activeDate);
  next.setDate(next.getDate() + 1);
  const nextKey = next.toISOString().slice(0, 10);
  state.activeDate = nextKey;
  if (!Array.isArray(state.history[nextKey])) {
    state.history[nextKey] = [];
  }
  state.selectedInspectDate = nextKey;
  saveState();
  renderAll();
});

document.getElementById("reset-demo-btn").addEventListener("click", () => {
  state = createDefaultState();
  saveState();
  renderAll();
});

syncRealCalendarDate();
renderAll();