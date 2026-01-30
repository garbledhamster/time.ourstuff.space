import { normalizeTitle } from "./utils.js";
import { addTooltip } from "./tooltip.js";

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
  zendeskUrl,
  onSelect,
  onAddLog,
  onEdit,
  onDelete,
  onNoteChange,
  onEntryTimeClick
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
    item.dataset.ticketId = ticket.id;
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
    const baseUrl = zendeskUrl || "https://zendesk.com/agent/tickets/";
    if (ticket.key && /^\d+$/.test(ticket.key)) {
      const link = document.createElement("a");
      link.href = `${baseUrl}${ticket.key}`;
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
    addBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
    addTooltip(addBtn, "Add time block");

    const editBtn = document.createElement("button");
    editBtn.className = "iconBtn";
    editBtn.type = "button";
    editBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    addTooltip(editBtn, "Edit ticket");

    const delBtn = document.createElement("button");
    delBtn.className = "iconBtn danger";
    delBtn.type = "button";
    delBtn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    addTooltip(delBtn, "Delete ticket");

    actions.append(addBtn, editBtn, delBtn);
    meta.append(badge, actions);
    body.append(key, title, client, meta);

    // Add note field and time entries if ticket is expanded (active and not collapsed)
    if (ticket.id === activeTicketId && !isCollapsed) {
      // Time entries section
      const ticketEvents = events.filter(e => e.ticketId === ticket.id);
      if (ticketEvents.length > 0) {
        const entriesSection = document.createElement("div");
        entriesSection.className = "ticketEntries";
        
        const entriesLabel = document.createElement("div");
        entriesLabel.className = "entriesLabel";
        entriesLabel.textContent = `Time Entries (${ticketEvents.length})`;
        
        const entriesList = document.createElement("div");
        entriesList.className = "entriesList";
        
        for (const event of ticketEvents) {
          const entry = document.createElement("div");
          entry.className = "entryItem";

          const start = new Date(event.start);
          const end = new Date(event.end);

          // Validate dates
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            continue; // Skip invalid entries
          }

          const duration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));

          // Scale the entry height based on duration (0.8px per minute, min 40px)
          const minHeight = Math.max(40, duration * 0.8);
          entry.style.minHeight = `${minHeight}px`;
          
          const entryTime = document.createElement("button");
          entryTime.className = "entryTime";
          entryTime.type = "button";
          entryTime.textContent = `${start.toLocaleString()} - ${end.toLocaleTimeString()} (${formatMinutes(duration)})`;
          entryTime.addEventListener("click", (e) => {
            e.stopPropagation();
            if (onEntryTimeClick) {
              onEntryTimeClick(event, ticket, e.clientX, e.clientY);
            }
          });
          
          entry.appendChild(entryTime);
          
          if (event.notes && event.notes.trim()) {
            const entryNotes = document.createElement("div");
            entryNotes.className = "entryNotes";
            entryNotes.textContent = event.notes;
            entry.appendChild(entryNotes);
          }
          
          entriesList.appendChild(entry);
        }
        
        entriesSection.append(entriesLabel, entriesList);
        body.append(entriesSection);
      }
      
      const noteSection = document.createElement("div");
      noteSection.className = "ticketNote";
      
      const noteLabel = document.createElement("label");
      noteLabel.className = "noteLabel";
      noteLabel.textContent = "Note";
      noteLabel.htmlFor = `note-${ticket.id}`;
      
      const noteInput = document.createElement("textarea");
      noteInput.className = "input noteInput";
      noteInput.id = `note-${ticket.id}`;
      noteInput.placeholder = "Add a note for this ticket...";
      noteInput.value = ticket.note || "";
      noteInput.setAttribute("aria-label", "Ticket note");
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
    editBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onEdit(ticket.id);
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
