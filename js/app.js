import { buildCsv, downloadText, parseCsv } from "./csv.js";
import { createCalendar, toCalendarEvent } from "./calendar.js";
import { createLogModal } from "./modal.js";
import {
  loadEvents,
  loadTickets,
  saveEvents,
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
  snapToMinutes
} from "./utils.js";

const state = {
  tickets: [],
  events: [],
  activeTicketId: null,
  searchTerm: "",
  statusFilters: ["open", "in-progress"],
  clientFilter: ""
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
  viewMenuBtn: $("viewMenuBtn"),
  viewMenu: $("viewMenu"),
  prevBtnMobile: $("prevBtnMobile"),
  nextBtnMobile: $("nextBtnMobile"),
  todayBtnMobile: $("todayBtnMobile")
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
    client: record.client || ""
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
    onSelect: (id) => {
      state.activeTicketId = id;
      updateTicketList();
    },
    onAddLog: (id) => addLogForTicket(id),
    onDelete: (id) => deleteTicket(id)
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
    client
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
        client: ""
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

  // Mobile navigation buttons
  if (elements.prevBtnMobile) {
    elements.prevBtnMobile.addEventListener("click", () => calendar.prev());
  }
  if (elements.nextBtnMobile) {
    elements.nextBtnMobile.addEventListener("click", () => calendar.next());
  }
  if (elements.todayBtnMobile) {
    elements.todayBtnMobile.addEventListener("click", () => calendar.today());
  }

  document.querySelectorAll("[data-view]").forEach((btn) => {
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

function wireViewMenu() {
  if (!elements.viewMenuBtn || !elements.viewMenu) return;

  const toggle = () => {
    elements.viewMenu.classList.toggle("open");
  };
  const close = () => {
    elements.viewMenu.classList.remove("open");
  };

  elements.viewMenuBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle();
  });

  // Close menu when clicking outside
  document.addEventListener("click", (event) => {
    if (!elements.viewMenu.contains(event.target) && event.target !== elements.viewMenuBtn) {
      close();
    }
  });

  // Close menu when a view button is clicked
  elements.viewMenu.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", close);
  });
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
}

async function init() {
  if (typeof localforage === "undefined") {
    reportError("localForage failed to load. Falling back to local storage.");
  }
  if (typeof FullCalendar === "undefined") {
    throw new Error("FullCalendar failed to load.");
  }

  const [tickets, events] = await Promise.all([loadTickets(), loadEvents()]);
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
    onEventChange: (event) => {
      if (!event.end) {
        event.setEnd(addMinutes(event.start, 30));
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
  wireViewMenu();
  updateTicketList();
}

init().catch((error) => {
  reportError("Failed to initialize the app.", error);
});
