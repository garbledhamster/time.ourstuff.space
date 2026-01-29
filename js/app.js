import { buildCsv, downloadText, parseCsv } from "./csv.js";
import { createCalendar, toCalendarEvent } from "./calendar.js";
import { createLogModal } from "./modal.js";
import {
  loadEvents,
  loadSettings,
  loadTickets,
  saveEvents,
  saveSettings,
  saveTickets
} from "./storage.js";
import { renderTickets } from "./tickets.js";
import {
  $,
  addMinutes,
  debounce,
  extractTicketKey,
  normalizeTitle,
  safeUUID,
  snapToMinutes,
  snapToEventBoundaries
} from "./utils.js";

const DEFAULT_THEME_ID = "midnight";
const DEFAULT_THEME_COLORS = {
  primaryColor: "#7aa2ff",
  secondaryColor: "#9cf6d6",
  backgroundColor: "#0b1020",
  surfaceColor: "#0f1730",
  surfaceMutedColor: "#0c142a",
  borderColor: "rgba(255,255,255,0.10)",
  textColor: "rgba(255,255,255,0.92)",
  textMutedColor: "rgba(255,255,255,0.65)",
  dangerColor: "#ff6b6b"
};

const THEME_COLOR_KEYS = [
  "primaryColor",
  "secondaryColor",
  "backgroundColor",
  "surfaceColor",
  "surfaceMutedColor",
  "borderColor",
  "textColor",
  "textMutedColor",
  "dangerColor"
];

const THEME_COLOR_LABELS = {
  primaryColor: "Primary",
  secondaryColor: "Secondary",
  backgroundColor: "Background",
  surfaceColor: "Surface",
  surfaceMutedColor: "Surface muted",
  borderColor: "Border",
  textColor: "Text",
  textMutedColor: "Text muted",
  dangerColor: "Danger"
};

const THEME_COLOR_VARIABLES = {
  primaryColor: "--primary-color",
  secondaryColor: "--secondary-color",
  backgroundColor: "--background-color",
  surfaceColor: "--surface-color",
  surfaceMutedColor: "--surface-muted-color",
  borderColor: "--border-color",
  textColor: "--text-color",
  textMutedColor: "--text-muted-color",
  dangerColor: "--danger-color"
};

let THEME_PRESET_LIST = [
  { id: DEFAULT_THEME_ID, label: "Midnight Glow", colors: DEFAULT_THEME_COLORS }
];
let THEME_PRESETS = {
  [DEFAULT_THEME_ID]: THEME_PRESET_LIST[0]
};

const state = {
  tickets: [],
  events: [],
  activeTicketId: null,
  searchTerm: "",
  statusFilters: ["open", "in-progress"],
  clientFilter: "",
  collapsedTickets: new Set()
};

const elements = {
  ticketKeyInput: $("ticketKeyInput"),
  ticketTitleInput: $("ticketTitleInput"),
  ticketClientInput: $("ticketClientInput"),
  addTicketBtn: $("addTicketBtn"),
  ticketList: $("ticketList"),
  ticketsCount: $("ticketsCount"),
  ticketSearchInput: $("ticketSearchInput"),
  statusFilterInputs: document.querySelectorAll('input[name="ticketStatusFilter"]'),
  clientFilterSelect: $("clientFilterSelect"),
  exportBtn: $("exportBtn"),
  importBtn: $("importBtn"),
  importInput: $("importInput"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  todayBtn: $("todayBtn"),
  openDrawerBtn: $("openDrawerBtn"),
  closeDrawerBtn: $("closeDrawerBtn"),
  drawerOverlay: $("drawerOverlay"),
  ticketsPanel: $("ticketsPanel"),
  errorBanner: $("errorBanner"),
  themePresetSelect: $("themePresetSelect"),
  themeCustomFields: $("themeCustomFields"),
  expandAllBtn: $("expandAllBtn"),
  collapseAllBtn: $("collapseAllBtn")
};

let calendar = null;
let modal = null;

function reportError(message, error) {
  const details = error instanceof Error ? error.message : error ? String(error) : "";
  console.error(message, error);
  if (!elements.errorBanner) return;
  const entry = document.createElement("div");
  entry.className = "errorEntry";
  entry.textContent = details ? `${message} ${details}` : message;
  elements.errorBanner.append(entry);
  elements.errorBanner.classList.add("visible");
}

window.addEventListener("error", (event) => {
  if (event.error) {
    reportError("Unexpected error:", event.error);
  } else if (event.message) {
    reportError("Unexpected error:", event.message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  reportError("Unhandled promise rejection:", event.reason);
});

function loadYaml(text) {
  if (typeof jsyaml === "undefined" || typeof jsyaml.load !== "function") {
    throw new Error("js-yaml failed to load.");
  }
  return jsyaml.load(text);
}

async function loadThemePresets() {
  const fallback = [
    { id: DEFAULT_THEME_ID, label: "Midnight Glow", colors: { ...DEFAULT_THEME_COLORS } }
  ];

  try {
    const response = await fetch("./themes.yaml", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Theme preset fetch failed with status ${response.status}`);
    }
    const text = await response.text();
    const data = loadYaml(text);
    if (!Array.isArray(data)) {
      throw new Error("Theme presets must be a list.");
    }

    const list = [];
    for (const theme of data) {
      if (!theme || typeof theme !== "object") continue;
      const { id, label, colors } = theme;
      if (typeof id !== "string" || !id.trim()) continue;
      if (typeof label !== "string" || !label.trim()) continue;
      if (!colors || typeof colors !== "object") continue;

      const normalizedColors = {};
      let isValid = true;
      for (const key of THEME_COLOR_KEYS) {
        if (typeof colors[key] !== "string") {
          isValid = false;
          break;
        }
        normalizedColors[key] = colors[key];
      }
      if (!isValid) continue;
      list.push({ id, label, colors: normalizedColors });
    }

    THEME_PRESET_LIST = list.length ? list : fallback;
    THEME_PRESETS = Object.fromEntries(THEME_PRESET_LIST.map((theme) => [theme.id, theme]));
  } catch (error) {
    console.error("Theme preset load failed, using fallback.", error);
    THEME_PRESET_LIST = fallback;
    THEME_PRESETS = { [DEFAULT_THEME_ID]: fallback[0] };
  }

  return { list: THEME_PRESET_LIST, presets: THEME_PRESETS };
}

function getThemeSettings(settings = {}) {
  const resolved = settings && typeof settings === "object" ? settings : {};
  const theme = resolved.theme && typeof resolved.theme === "object" ? resolved.theme : {};
  const presetId =
    theme.presetId === "custom" || THEME_PRESETS[theme.presetId]
      ? theme.presetId
      : DEFAULT_THEME_ID;
  const customColors = {
    ...DEFAULT_THEME_COLORS,
    ...(theme.customColors && typeof theme.customColors === "object" ? theme.customColors : {})
  };

  return {
    ...resolved,
    zendeskUrl: resolved.zendeskUrl || "https://zendesk.com/agent/tickets/",
    theme: {
      presetId: presetId || DEFAULT_THEME_ID,
      customColors
    }
  };
}

function getActiveThemeColors() {
  const { presetId, customColors } = state.settings.theme;
  if (presetId === "custom") {
    return customColors;
  }
  return THEME_PRESETS[presetId]?.colors || DEFAULT_THEME_COLORS;
}

function applyThemeColors(colors) {
  const target = colors || DEFAULT_THEME_COLORS;
  const root = document.documentElement;
  for (const [key, variable] of Object.entries(THEME_COLOR_VARIABLES)) {
    if (typeof target[key] === "string") {
      root.style.setProperty(variable, target[key]);
    }
  }

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta && typeof target.backgroundColor === "string") {
    themeMeta.setAttribute("content", target.backgroundColor);
  }
}

function persistThemeSettings() {
  saveSettings(state.settings);
}

function updateThemeUIVisibility() {
  if (!elements.themeCustomFields) return;
  elements.themeCustomFields.classList.toggle(
    "visible",
    state.settings.theme.presetId === "custom"
  );
}

function syncCustomColorInputs() {
  if (!elements.themeCustomFields) return;
  elements.themeCustomFields.querySelectorAll('input[type="color"]').forEach((input) => {
    const key = input.dataset.colorKey;
    if (key && state.settings.theme.customColors[key]) {
      input.value = state.settings.theme.customColors[key];
    }
  });
}

function renderThemeControls() {
  if (!elements.themePresetSelect || !elements.themeCustomFields) return;

  elements.themePresetSelect.innerHTML = "";
  for (const theme of THEME_PRESET_LIST) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.label;
    elements.themePresetSelect.append(option);
  }
  const customOption = document.createElement("option");
  customOption.value = "custom";
  customOption.textContent = "Custom";
  elements.themePresetSelect.append(customOption);

  elements.themePresetSelect.value = state.settings.theme.presetId;

  elements.themeCustomFields.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "colorGrid";
  for (const key of THEME_COLOR_KEYS) {
    const field = document.createElement("div");
    field.className = "colorField";

    const label = document.createElement("label");
    label.textContent = THEME_COLOR_LABELS[key];

    const input = document.createElement("input");
    input.type = "color";
    input.value = state.settings.theme.customColors[key] || DEFAULT_THEME_COLORS[key];
    input.dataset.colorKey = key;
    input.addEventListener("input", (event) => {
      const nextValue = event.target.value;
      state.settings.theme.customColors = {
        ...state.settings.theme.customColors,
        [key]: nextValue
      };
      if (state.settings.theme.presetId === "custom") {
        applyThemeColors(getActiveThemeColors());
      }
      persistThemeSettings();
    });

    field.append(label, input);
    grid.append(field);
  }
  elements.themeCustomFields.append(grid);

  updateThemeUIVisibility();
  syncCustomColorInputs();
}
function normalizeEventRecord(record) {
  if (!record) return null;
  const start = new Date(record.start);
  const end = new Date(record.end);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  return {
    id: record.id || safeUUID(),
    ticketId: record.ticketId,
    ticketKey: record.ticketKey || "",
    title: record.title || normalizeTitle(record.ticketKey, ""),
    start: start.toISOString(),
    end: end.toISOString(),
    notes: record.notes || ""
  };
}

function normalizeTicketRecord(record) {
  if (!record) return null;
  return {
    id: record.id || safeUUID(),
    key: record.key || "",
    title: record.title || "",
    status: record.status || "open",
    client: record.client || "",
    note: record.note || ""
  };
}

function syncStorage() {
  saveTickets(state.tickets);
  saveEvents(state.events);
}

function updateClientFilterOptions() {
  if (!elements.clientFilterSelect) return;
  const clientSet = new Set();
  for (const ticket of state.tickets) {
    const client = String(ticket.client || "").trim();
    if (client) {
      clientSet.add(client);
    }
  }
  const options = Array.from(clientSet).sort((a, b) => a.localeCompare(b));
  const select = elements.clientFilterSelect;
  select.textContent = "";
  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All clients";
  select.append(allOption);
  for (const client of options) {
    const option = document.createElement("option");
    option.value = client;
    option.textContent = client;
    select.append(option);
  }

  const hasSelection = state.clientFilter && options.includes(state.clientFilter);
  if (!hasSelection) {
    state.clientFilter = "";
  }
  select.value = state.clientFilter;
}

function updateTicketList() {
  updateClientFilterOptions();
  renderTickets({
    tickets: state.tickets,
    events: state.events,
    listEl: elements.ticketList,
    countEl: elements.ticketsCount,
    searchTerm: state.searchTerm,
    statusFilters: state.statusFilters,
    clientFilter: state.clientFilter,
    activeTicketId: state.activeTicketId,
    collapsedTickets: state.collapsedTickets,
    zendeskUrl: state.settings.zendeskUrl,
    onSelect: (id) => {
      state.activeTicketId = id;
      state.collapsedTickets.delete(id);
      updateTicketList();
    },
    onAddLog: (id) => addLogForTicket(id),
    onDelete: (id) => deleteTicket(id),
    onNoteChange: (id, note) => {
      const ticket = state.tickets.find((t) => t.id === id);
      if (ticket) {
        ticket.note = note;
        syncStorage();
      }
    }
  });
}

function addTicket() {
  const key = extractTicketKey(elements.ticketKeyInput.value);
  const title = elements.ticketTitleInput.value.trim();
  const client = elements.ticketClientInput.value.trim();
  if (!key && !title) return;

  const ticket = {
    id: safeUUID(),
    key,
    title,
    status: "open",
    client,
    note: ""
  };

  state.tickets = [ticket, ...state.tickets];
  elements.ticketKeyInput.value = "";
  elements.ticketTitleInput.value = "";
  elements.ticketClientInput.value = "";
  state.activeTicketId = ticket.id;
  syncStorage();
  updateTicketList();
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findHeaderIndex(headers, options) {
  for (const option of options) {
    const idx = headers.indexOf(option);
    if (idx !== -1) return idx;
  }
  return -1;
}

async function importTicketsFromCsv(file) {
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  if (!rows.length) {
    reportError("CSV import failed: file was empty.");
    return;
  }

  const headers = rows[0].map(normalizeHeader);
  const idIndex = findHeaderIndex(headers, ["id", "ticket id", "ticket number"]);
  const subjectIndex = findHeaderIndex(headers, ["subject", "ticket title", "title"]);
  const statusIndex = findHeaderIndex(headers, ["ticket status", "status"]);

  if (idIndex === -1 || subjectIndex === -1 || statusIndex === -1) {
    reportError("CSV import failed: missing required headers (id, subject, ticket status).");
    return;
  }

  const nextTickets = [...state.tickets];
  const keyLookup = new Map(nextTickets.map((ticket) => [String(ticket.key), ticket]));
  let didChange = false;

  for (const row of rows.slice(1)) {
    if (!row || row.every((value) => !String(value || "").trim())) continue;
    const rawId = String(row[idIndex] || "").trim();
    const subject = String(row[subjectIndex] || "").trim();
    const statusRaw = String(row[statusIndex] || "").trim();
    if (!rawId) continue;

    const key = extractTicketKey(rawId);
    const status = statusRaw ? statusRaw.toLowerCase() : "open";
    const existing = keyLookup.get(key) || nextTickets.find((ticket) => String(ticket.id) === rawId);

    if (existing) {
      const updated = { ...existing };
      if (key && updated.key !== key) updated.key = key;
      if (subject && updated.title !== subject) updated.title = subject;
      if (status && updated.status !== status) updated.status = status;

      if (
        updated.key !== existing.key ||
        updated.title !== existing.title ||
        updated.status !== existing.status
      ) {
        const index = nextTickets.findIndex((ticket) => ticket.id === existing.id);
        if (index >= 0) {
          nextTickets[index] = updated;
          didChange = true;
          keyLookup.set(updated.key, updated);
        }
      }
    } else {
      const ticket = {
        id: safeUUID(),
        key,
        title: subject,
        status,
        client: "",
        note: ""
      };
      nextTickets.unshift(ticket);
      keyLookup.set(ticket.key, ticket);
      didChange = true;
    }
  }

  if (!didChange) return;
  state.tickets = nextTickets;
  syncStorage();
  updateTicketList();
}

function addLogForTicket(ticketId, range) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;

  const start = range?.start ? new Date(range.start) : snapToMinutes(new Date(), 15);
  const end = range?.end ? new Date(range.end) : addMinutes(start, 30);

  const record = normalizeEventRecord({
    id: safeUUID(),
    ticketId: ticket.id,
    ticketKey: ticket.key,
    title: normalizeTitle(ticket.key, ticket.title),
    start,
    end,
    notes: ""
  });

  if (!record) return;
  state.events = [...state.events, record];
  calendar.addEvent(toCalendarEvent(record));
  syncStorage();
  updateTicketList();
}

function deleteTicket(ticketId) {
  const ticket = state.tickets.find((item) => item.id === ticketId);
  if (!ticket) return;
  if (!confirm(`Delete ticket ${ticket.key || "Untitled"} and all its logs?`)) return;

  state.tickets = state.tickets.filter((item) => item.id !== ticketId);
  const remainingEvents = [];
  for (const record of state.events) {
    if (record.ticketId === ticketId) {
      const event = calendar.getEventById(record.id);
      if (event) event.remove();
    } else {
      remainingEvents.push(record);
    }
  }
  state.events = remainingEvents;
  if (state.activeTicketId === ticketId) {
    state.activeTicketId = state.tickets[0]?.id || null;
  }
  syncStorage();
  updateTicketList();
}

function upsertEventFromCalendar(event) {
  const updated = normalizeEventRecord({
    id: event.id,
    ticketId: event.extendedProps.ticketId,
    ticketKey: event.extendedProps.ticketKey,
    title: event.title,
    start: event.start,
    end: event.end,
    notes: event.extendedProps.notes
  });
  if (!updated) return;

  const index = state.events.findIndex((item) => item.id === event.id);
  if (index >= 0) {
    const next = [...state.events];
    next[index] = updated;
    state.events = next;
  } else {
    state.events = [...state.events, updated];
  }
  syncStorage();
  updateTicketList();
}

function handleModalSave({ event, start, end, notes }) {
  event.setStart(start);
  event.setEnd(end);
  event.setExtendedProp("notes", notes);
  upsertEventFromCalendar(event);
}

function handleModalDelete({ event }) {
  event.remove();
  state.events = state.events.filter((item) => item.id !== event.id);
  syncStorage();
  updateTicketList();
}

function handleCalendarSelect(info) {
  if (!state.activeTicketId) {
    alert("Select a ticket first to add a time block.");
    return;
  }
  addLogForTicket(state.activeTicketId, info);
}

function wireNavigation() {
  elements.prevBtn.addEventListener("click", () => calendar.prev());
  elements.nextBtn.addEventListener("click", () => calendar.next());
  elements.todayBtn.addEventListener("click", () => calendar.today());

  document.querySelectorAll(".viewGroup [data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      calendar.changeView(btn.dataset.view);
    });
  });
}

function wireDrawer() {
  const open = () => {
    elements.ticketsPanel.classList.add("open");
    elements.drawerOverlay.classList.add("open");
  };
  const close = () => {
    elements.ticketsPanel.classList.remove("open");
    elements.drawerOverlay.classList.remove("open");
  };
  elements.openDrawerBtn.addEventListener("click", open);
  elements.closeDrawerBtn.addEventListener("click", close);
  elements.drawerOverlay.addEventListener("click", close);
}

function wireInputs() {
  elements.addTicketBtn.addEventListener("click", addTicket);
  elements.ticketKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addTicket();
  });
  elements.ticketTitleInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addTicket();
  });
  elements.ticketClientInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addTicket();
  });

  elements.ticketSearchInput.addEventListener(
    "input",
    debounce((event) => {
      state.searchTerm = event.target.value;
      updateTicketList();
    }, 150)
  );

  elements.statusFilterInputs.forEach((input) => {
    input.checked = state.statusFilters.includes(input.value);
    input.addEventListener("change", () => {
      state.statusFilters = Array.from(elements.statusFilterInputs)
        .filter((item) => item.checked)
        .map((item) => item.value);
      updateTicketList();
    });
  });

  if (elements.clientFilterSelect) {
    elements.clientFilterSelect.addEventListener("change", (event) => {
      state.clientFilter = event.target.value;
      updateTicketList();
    });
  }

  elements.exportBtn.addEventListener("click", () => {
    const csv = buildCsv(state.tickets, state.events);
    downloadText("ticket-time-logs.csv", csv);
  });

  if (elements.themePresetSelect) {
    elements.themePresetSelect.addEventListener("change", (event) => {
      state.settings.theme.presetId = event.target.value;
      if (state.settings.theme.presetId !== "custom") {
        const presetColors = THEME_PRESETS[state.settings.theme.presetId]?.colors;
        if (presetColors) {
          state.settings.theme.customColors = {
            ...state.settings.theme.customColors,
            ...presetColors
          };
        }
      }
      applyThemeColors(getActiveThemeColors());
      updateThemeUIVisibility();
      syncCustomColorInputs();
      persistThemeSettings();
    });
  }

  if (elements.expandAllBtn) {
    elements.expandAllBtn.addEventListener("click", () => {
      state.collapsedTickets.clear();
      updateTicketList();
    });
  }

  if (elements.collapseAllBtn) {
    elements.collapseAllBtn.addEventListener("click", () => {
      state.collapsedTickets.clear();
      for (const ticket of state.tickets) {
        if (ticket.id !== state.activeTicketId) {
          state.collapsedTickets.add(ticket.id);
        }
      }
      updateTicketList();
    });
  }
}

async function init() {
  if (typeof localforage === "undefined") {
    reportError("localForage failed to load. Falling back to local storage.");
  }
  if (typeof FullCalendar === "undefined") {
    throw new Error("FullCalendar failed to load.");
  }

  const [tickets, events, settings] = await Promise.all([loadTickets(), loadEvents(), loadSettings()]);
  let didNormalizeTickets = false;
  state.tickets = tickets
    .map((ticket) => {
      const normalized = normalizeTicketRecord(ticket);
      if (!normalized) return null;
      if (
        !ticket ||
        ticket.status !== normalized.status ||
        ticket.id !== normalized.id ||
        ticket.client !== normalized.client
      ) {
        didNormalizeTickets = true;
      }
      return normalized;
    })
    .filter(Boolean);
  if (didNormalizeTickets) {
    saveTickets(state.tickets);
  }
  state.events = events.map(normalizeEventRecord).filter(Boolean);
  state.activeTicketId = state.tickets[0]?.id || null;
  state.settings = getThemeSettings(settings);
  applyThemeColors(getActiveThemeColors());

  calendar = createCalendar({
    events: state.events,
    onSelectRange: handleCalendarSelect,
    onEventOpen: (event) => {
      const ticket = state.tickets.find((item) => item.id === event.extendedProps.ticketId);
      modal.open({
        event,
        ticketKey: event.extendedProps.ticketKey,
        ticketTitle: ticket?.title
      });
    },
    onEventDrop: (event) => {
      if (!event.end) {
        event.setEnd(addMinutes(event.start, 30));
      }

      // Get other events (excluding the current one being dragged)
      const otherEvents = state.events.filter((e) => e.id !== event.id);

      // Apply snap-to-event-boundaries logic (move mode)
      const snapped = snapToEventBoundaries(event.start, event.end, otherEvents, {
        thresholdMinutes: 15,
        mode: 'move'
      });
      if (snapped.snapped) {
        event.setStart(snapped.start);
        event.setEnd(snapped.end);
      }

      upsertEventFromCalendar(event);
    },
    onEventResize: (event, oldEvent, startDelta, endDelta) => {
      if (!event.end) {
        event.setEnd(addMinutes(event.start, 30));
      }

      // Get other events (excluding the current one being resized)
      const otherEvents = state.events.filter((e) => e.id !== event.id);

      // Determine which boundary changed
      const startChanged = startDelta && (startDelta.milliseconds !== 0 || startDelta.days !== 0);
      const endChanged = endDelta && (endDelta.milliseconds !== 0 || endDelta.days !== 0);

      let mode = 'move';
      if (startChanged && !endChanged) {
        mode = 'resize-start';
      } else if (endChanged && !startChanged) {
        mode = 'resize-end';
      }

      // Apply snap-to-event-boundaries logic
      const snapped = snapToEventBoundaries(event.start, event.end, otherEvents, {
        thresholdMinutes: 15,
        mode
      });
      if (snapped.snapped) {
        event.setStart(snapped.start);
        event.setEnd(snapped.end);
      }

      upsertEventFromCalendar(event);
    }
  });

  modal = createLogModal({
    onSave: handleModalSave,
    onDelete: handleModalDelete
  });

  wireNavigation();
  wireDrawer();
  wireInputs();
  renderThemeControls();
  updateTicketList();
}

init().catch((error) => {
  reportError("Failed to initialize the app.", error);
});
