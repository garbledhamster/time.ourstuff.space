import { buildCsv, downloadText } from "./csv.js";
import { createCalendar, toCalendarEvent } from "./calendar.js";
import { createLogModal } from "./modal.js";
import { loadEvents, loadTickets, saveEvents, saveTickets } from "./storage.js";
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
  statusFilters: ["open", "in-progress"]
};

const elements = {
  ticketKeyInput: $("ticketKeyInput"),
  ticketTitleInput: $("ticketTitleInput"),
  addTicketBtn: $("addTicketBtn"),
  ticketList: $("ticketList"),
  ticketsCount: $("ticketsCount"),
  ticketSearchInput: $("ticketSearchInput"),
  statusFilterInputs: document.querySelectorAll('input[name="ticketStatusFilter"]'),
  exportBtn: $("exportBtn"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  todayBtn: $("todayBtn"),
  openDrawerBtn: $("openDrawerBtn"),
  closeDrawerBtn: $("closeDrawerBtn"),
  drawerOverlay: $("drawerOverlay"),
  ticketsPanel: $("ticketsPanel"),
  errorBanner: $("errorBanner")
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
    status: record.status || "open"
  };
}

function syncStorage() {
  saveTickets(state.tickets);
  saveEvents(state.events);
}

function updateTicketList() {
  renderTickets({
    tickets: state.tickets,
    events: state.events,
    listEl: elements.ticketList,
    countEl: elements.ticketsCount,
    searchTerm: state.searchTerm,
    statusFilters: state.statusFilters,
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
  if (!key && !title) return;

  const ticket = {
    id: safeUUID(),
    key,
    title,
    status: "open"
  };

  state.tickets = [ticket, ...state.tickets];
  elements.ticketKeyInput.value = "";
  elements.ticketTitleInput.value = "";
  state.activeTicketId = ticket.id;
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
      if (!ticket || ticket.status !== normalized.status || ticket.id !== normalized.id) {
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
  updateTicketList();
}

init().catch((error) => {
  reportError("Failed to initialize the app.", error);
});
