import { $, addMinutes, fromLocalInputValue, toLocalInputValue } from "./utils.js";

export function createLogModal({ onSave, onDelete } = {}) {
  const overlay = $("modalOverlay");
  const titleEl = $("modalTitle");
  const subEl = $("modalSub");
  const eventTitleInput = $("modalEventTitle");
  const startInput = $("modalStart");
  const endInput = $("modalEnd");
  const notesInput = $("modalNotes");
  const closeBtn = $("closeModalBtn");
  const cancelBtn = $("cancelModalBtn");
  const saveBtn = $("saveModalBtn");
  const deleteBtn = $("deleteEventBtn");
  const startNowBtn = $("modalStartNowBtn");
  const endNowBtn = $("modalEndNowBtn");

  let currentEvent = null;

  function close() {
    overlay.classList.remove("open");
    currentEvent = null;
  }

  function open({ event, ticketTitle, ticketKey }) {
    currentEvent = event;
    const start = event.start ? new Date(event.start) : new Date();
    const end = event.end ? new Date(event.end) : addMinutes(start, 30);
    titleEl.textContent = "Edit time log";
    subEl.textContent = ticketTitle || ticketKey || "Untitled";
    // Provide default title for legacy events without titles
    eventTitleInput.value = event.title || ticketTitle || ticketKey || "Untitled";
    startInput.value = toLocalInputValue(start);
    endInput.value = toLocalInputValue(end);
    notesInput.value = event.extendedProps?.notes || "";
    overlay.classList.add("open");
    eventTitleInput.focus();
  }

  function handleSave() {
    if (!currentEvent) return;
    const start = fromLocalInputValue(startInput.value);
    const end = fromLocalInputValue(endInput.value);
    const title = eventTitleInput.value.trim();
    
    if (!start || !end) {
      alert("Please enter valid start and end times.");
      return;
    }
    if (end <= start) {
      alert("End time must be after the start time.");
      return;
    }
    if (!title) {
      alert("Please enter a title for the event.");
      return;
    }
    if (onSave) {
      onSave({
        event: currentEvent,
        title,
        start,
        end,
        notes: notesInput.value.trim()
      });
    }
    close();
  }

  function handleDelete() {
    if (!currentEvent) return;
    if (onDelete) {
      onDelete({ event: currentEvent });
    }
    close();
  }

  closeBtn.addEventListener("click", close);
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  saveBtn.addEventListener("click", handleSave);
  deleteBtn.addEventListener("click", handleDelete);
  startNowBtn.addEventListener("click", () => {
    startInput.value = toLocalInputValue(new Date());
  });
  endNowBtn.addEventListener("click", () => {
    endInput.value = toLocalInputValue(new Date());
  });

  return { open, close };
}
