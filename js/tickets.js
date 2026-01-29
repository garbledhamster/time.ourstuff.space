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
  collapsedTickets,
  onSelect,
  onAddLog,
  onDelete,
  onNoteChange
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
    const isCollapsed = collapsedTickets && collapsedTickets.has(ticket.id);
    if (isCollapsed) {
      item.classList.add("collapsed");
    }

    const handle = document.createElement("div");
    handle.className = "dragHandle";

    const body = document.createElement("div");
    body.className = "ticketBody";

    const key = document.createElement("div");
    key.className = "ticketKey";
    
    // Make the key clickable if it looks like a Zendesk ticket number
    if (ticket.key && /^\d+$/.test(ticket.key)) {
      const link = document.createElement("a");
      link.href = `https://zendesk.com/agent/tickets/${ticket.key}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = ticket.key;
      link.title = "Open in Zendesk";
      link.addEventListener("click", (e) => e.stopPropagation());
      key.appendChild(link);
    } else {
      key.textContent = ticket.key || "Untitled";
    }

    const title = document.createElement("div");
    title.className = "ticketTitle";
    title.textContent = ticket.title || normalizeTitle(ticket.key, "");

    const client = document.createElement("div");
    client.className = "ticketClient";
    if (ticket.client) {
      client.textContent = ticket.client;
    }

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
    addBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';

    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn danger";
    delBtn.type = "button";
    delBtn.title = "Delete ticket";
    delBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

    actions.append(addBtn, delBtn);
    meta.append(badge, actions);
    body.append(key, title, client, meta);

    // Add note field if ticket is expanded (active and not collapsed)
    if (ticket.id === activeTicketId && !isCollapsed) {
      const noteSection = document.createElement("div");
      noteSection.className = "ticketNote";
      
      const noteLabel = document.createElement("div");
      noteLabel.className = "noteLabel";
      noteLabel.textContent = "Note";
      
      const noteInput = document.createElement("textarea");
      noteInput.className = "input noteInput";
      noteInput.placeholder = "Add a note for this ticket...";
      noteInput.value = ticket.note || "";
      noteInput.addEventListener("click", (e) => e.stopPropagation());
      noteInput.addEventListener("input", (e) => {
        if (onNoteChange) {
          onNoteChange(ticket.id, e.target.value);
        }
      });
      
      noteSection.append(noteLabel, noteInput);
      body.append(noteSection);
    }

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
