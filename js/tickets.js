import { normalizeTitle } from "./utils.js";

function formatMinutes(totalMinutes) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function getTicketTotals(events) {
  const totals = new Map();
  for (const event of events) {
    const start = new Date(event.start);
    const end = new Date(event.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) continue;
    const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
    totals.set(event.ticketId, (totals.get(event.ticketId) || 0) + minutes);
  }
  return totals;
}

export function renderTickets({
  tickets,
  events,
  listEl,
  countEl,
  searchTerm,
  statusFilters,
  clientFilter,
  activeTicketId,
  onSelect,
  onAddLog,
  onDelete
}) {
  const term = String(searchTerm || "").trim().toLowerCase();
  const clientTerm = String(clientFilter || "").trim().toLowerCase();
  const statusSet = new Set(
    Array.isArray(statusFilters)
      ? statusFilters.map((status) => String(status || "").toLowerCase())
      : []
  );
  const totals = getTicketTotals(events);

  const filtered = tickets.filter((ticket) => {
    const status = String(ticket.status || "open").toLowerCase();
    if (statusSet.size > 0 && !statusSet.has(status)) {
      return false;
    }
    if (clientTerm) {
      const client = String(ticket.client || "").toLowerCase();
      if (client !== clientTerm) {
        return false;
      }
    }
    if (!term) return true;
    const key = String(ticket.key || "").toLowerCase();
    const title = String(ticket.title || "").toLowerCase();
    return key.includes(term) || title.includes(term);
  });

  listEl.textContent = "";
  countEl.textContent = String(tickets.length);

  for (const ticket of filtered) {
    const item = document.createElement("div");
    item.className = "ticketItem";
    if (ticket.id === activeTicketId) {
      item.classList.add("active");
    }

    const handle = document.createElement("div");
    handle.className = "dragHandle";

    const body = document.createElement("div");
    body.className = "ticketBody";

    const key = document.createElement("div");
    key.className = "ticketKey";
    key.textContent = ticket.key || "Untitled";

    const title = document.createElement("div");
    title.className = "ticketTitle";
    title.textContent = ticket.title || normalizeTitle(ticket.key, "");

    const meta = document.createElement("div");
    meta.className = "ticketMeta";

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = formatMinutes(totals.get(ticket.id) || 0);

    const actions = document.createElement("div");

    const addBtn = document.createElement("button");
    addBtn.className = "iconBtn";
    addBtn.type = "button";
    addBtn.title = "Add time block";
    addBtn.textContent = "+";

    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn danger";
    delBtn.type = "button";
    delBtn.title = "Delete ticket";
    delBtn.textContent = "×";

    actions.append(addBtn, delBtn);
    meta.append(badge, actions);
    body.append(key, title, meta);
    item.append(handle, body);

    addBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onAddLog(ticket.id);
    });
    delBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onDelete(ticket.id);
    });
    item.addEventListener("click", () => {
      onSelect(ticket.id);
    });

    listEl.append(item);
  }
}
