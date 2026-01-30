import { getTimeFormat, cycleTimeFormat, formatDurationByFormat } from './utils.js';

/**
 * Format duration in hours, minutes, and seconds.
 */
function formatDurationParts(startDate, endDate) {
  const diffMs = endDate.getTime() - startDate.getTime();
  if (diffMs < 0 || isNaN(diffMs)) {
    return { hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { hours, minutes, seconds, totalSeconds };
}

function formatDurationLabel(totalSeconds) {
  const format = getTimeFormat();
  return formatDurationByFormat(totalSeconds, format);
}

/**
 * Position the card within screen boundaries.
 */
function positionCard(card, clickX, clickY) {
  const cardRect = card.getBoundingClientRect();
  const padding = 10;

  let left = clickX + padding;
  let top = clickY + padding;

  if (left + cardRect.width > window.innerWidth - padding) {
    left = clickX - cardRect.width - padding;
  }
  if (top + cardRect.height > window.innerHeight - padding) {
    top = clickY - cardRect.height - padding;
  }
  if (left < padding) {
    left = padding;
  }
  if (top < padding) {
    top = padding;
  }

  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
}

export function createEntryPopup() {
  let card = null;
  let currentEventId = null;
  let currentEvent = null;
  let currentTicket = null;
  let clickOutsideListenerAdded = false;

  function handleClickOutside(e) {
    if (card && !card.contains(e.target) && card.classList.contains("visible")) {
      hide();
    }
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape" && card && card.classList.contains("visible")) {
      hide();
    }
  }

  function create() {
    if (card) return card;

    card = document.createElement("div");
    card.className = "previewCard entryPopup";
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-modal", "false");
    card.setAttribute("aria-labelledby", "entryPopupTitle");
    card.innerHTML = `
      <div class="previewCard-header">
        <div class="previewCard-title" id="entryPopupTitle"></div>
        <div class="previewCard-actions">
          <button class="previewCard-action previewCard-close" type="button" aria-label="Close">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="previewCard-body">
        <div class="previewCard-time">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span class="previewCard-duration clickable" title="Click to cycle time format"></span>
        </div>
        <div class="previewCard-details">
          <div class="previewCard-detailRow" data-row="start">
            <span class="previewCard-detailLabel">Start</span>
            <span class="previewCard-detailValue" data-field="start"></span>
          </div>
          <div class="previewCard-detailRow" data-row="end">
            <span class="previewCard-detailLabel">End</span>
            <span class="previewCard-detailValue" data-field="end"></span>
          </div>
          <div class="previewCard-detailRow" data-row="hours">
            <span class="previewCard-detailLabel">Hours</span>
            <span class="previewCard-detailValue" data-field="hours"></span>
          </div>
          <div class="previewCard-detailRow" data-row="minutes">
            <span class="previewCard-detailLabel">Minutes</span>
            <span class="previewCard-detailValue" data-field="minutes"></span>
          </div>
          <div class="previewCard-detailRow" data-row="seconds">
            <span class="previewCard-detailLabel">Seconds</span>
            <span class="previewCard-detailValue" data-field="seconds"></span>
          </div>
          <div class="previewCard-detailRow" data-row="lastEdited">
            <span class="previewCard-detailLabel">Last edited</span>
            <span class="previewCard-detailValue" data-field="lastEdited"></span>
          </div>
          <div class="previewCard-detailRow" data-row="ticket">
            <span class="previewCard-detailLabel">Ticket</span>
            <span class="previewCard-detailValue" data-field="ticket"></span>
          </div>
          <div class="previewCard-detailRow" data-row="client">
            <span class="previewCard-detailLabel">Client</span>
            <span class="previewCard-detailValue" data-field="client"></span>
          </div>
          <div class="previewCard-detailRow" data-row="status">
            <span class="previewCard-detailLabel">Status</span>
            <span class="previewCard-detailValue" data-field="status"></span>
          </div>
        </div>
        <div class="previewCard-note"></div>
      </div>
    `;

    const closeBtn = card.querySelector(".previewCard-close");
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      hide();
    });

    // Duration click handler to cycle format
    const durationEl = card.querySelector('.previewCard-duration');
    durationEl.addEventListener('click', (e) => {
      e.stopPropagation();
      cycleTimeFormat();
      // Re-show with the same event to update the display
      if (currentEvent) {
        const start = currentEvent?.start ? new Date(currentEvent.start) : new Date();
        const end = currentEvent?.end ? new Date(currentEvent.end) : new Date();
        const durationParts = formatDurationParts(start, end);
        const durationLabel = formatDurationLabel(durationParts.totalSeconds);
        durationEl.textContent = durationLabel;
      }
    });

    document.body.appendChild(card);

    if (!clickOutsideListenerAdded) {
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside, true);
        document.addEventListener("keydown", handleEscapeKey);
        clickOutsideListenerAdded = true;
      }, 100);
    }

    return card;
  }

  function setField(cardEl, field, value, { fallback = "—", hideIfEmpty = false } = {}) {
    const fieldEl = cardEl.querySelector(`[data-field="${field}"]`);
    const rowEl = cardEl.querySelector(`[data-row="${field}"]`);
    if (!fieldEl) return;

    const hasValue = value !== null && value !== undefined && String(value).trim() !== "";
    if (!hasValue && hideIfEmpty && rowEl) {
      rowEl.style.display = "none";
      return;
    }
    if (rowEl) {
      rowEl.style.display = "";
    }
    fieldEl.textContent = hasValue ? String(value) : fallback;
  }

  function show({ event, ticket, clickX, clickY }) {
    currentEventId = event?.id || null;
    currentEvent = event;
    currentTicket = ticket;
    const cardEl = create();

    const start = event?.start ? new Date(event.start) : new Date();
    const end = event?.end ? new Date(event.end) : new Date();
    const durationParts = formatDurationParts(start, end);
    const durationLabel = formatDurationLabel(durationParts.totalSeconds);

    const title = ticket?.title || event?.title || ticket?.key || "Time Entry";
    cardEl.querySelector(".previewCard-title").textContent = title;
    cardEl.querySelector(".previewCard-duration").textContent = durationLabel;

    setField(cardEl, "start", start.toLocaleString());
    setField(cardEl, "end", end.toLocaleString());
    setField(cardEl, "hours", durationParts.hours);
    setField(cardEl, "minutes", durationParts.minutes);
    setField(cardEl, "seconds", durationParts.seconds);
    setField(cardEl, "lastEdited", event?.updatedAt ? new Date(event.updatedAt).toLocaleString() : "", {
      fallback: "Not available"
    });
    const ticketLabel = ticket?.key
      ? `${ticket.key}${ticket.title ? ` — ${ticket.title}` : ""}`
      : ticket?.title || "";
    setField(cardEl, "ticket", ticketLabel, { fallback: "Untitled" });
    setField(cardEl, "client", ticket?.client || "", { hideIfEmpty: true });
    setField(cardEl, "status", ticket?.status || "", { hideIfEmpty: true });

    const noteEl = cardEl.querySelector(".previewCard-note");
    if (event?.notes && event.notes.trim()) {
      noteEl.textContent = event.notes;
      noteEl.style.display = "block";
    } else {
      noteEl.textContent = "";
      noteEl.style.display = "none";
    }

    cardEl.classList.add("visible");
    requestAnimationFrame(() => {
      positionCard(cardEl, clickX, clickY);
    });
  }

  function hide() {
    if (card) {
      card.classList.remove("visible");
      currentEventId = null;
      currentEvent = null;
      currentTicket = null;
    }
  }

  function isVisible() {
    return card && card.classList.contains("visible");
  }

  function getCurrentEventId() {
    return currentEventId;
  }

  return { show, hide, isVisible, getCurrentEventId };
}
