import { eventColors } from "./utils.js";

/**
 * Create resize handle elements for better visibility and touch targets
 */
function createResizeHandles() {
  const topHandle = document.createElement('div');
  topHandle.className = 'fc-event-resizer fc-event-resizer-start';
  topHandle.setAttribute('aria-label', 'Resize from top');
  
  const bottomHandle = document.createElement('div');
  bottomHandle.className = 'fc-event-resizer fc-event-resizer-end';
  bottomHandle.setAttribute('aria-label', 'Resize from bottom');
  
  return { top: topHandle, bottom: bottomHandle };
}

export function toCalendarEvent(record) {
  const colorSeed = record.ticketKey || record.ticketId || record.id;
  return {
    id: record.id,
    title: record.title,
    start: record.start,
    end: record.end,
    extendedProps: {
      ticketId: record.ticketId,
      ticketKey: record.ticketKey,
      notes: record.notes || ""
    },
    ...eventColors(colorSeed)
  };
}

export function createCalendar({ events, onSelectRange, onEventOpen, onEventPreview, onEventDrop, onEventResize }) {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    throw new Error("Calendar element not found");
  }

  let selectedEventEl = null;

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    nowIndicator: true,
    selectable: true,
    editable: true,
    headerToolbar: false,
    height: "100%",
    eventClick(info) {
      // Get click position
      const clickX = info.jsEvent.clientX;
      const clickY = info.jsEvent.clientY;
      
      // Remove selected class from previously selected event
      if (selectedEventEl && selectedEventEl !== info.el) {
        selectedEventEl.classList.remove('fc-event-selected');
      }
      
      // Add selected class to clicked event
      info.el.classList.add('fc-event-selected');
      selectedEventEl = info.el;
      
      if (onEventPreview) {
        onEventPreview(info.event, clickX, clickY);
      }
    },
    select(info) {
      // Clear selection when selecting a new time range
      if (selectedEventEl) {
        selectedEventEl.classList.remove('fc-event-selected');
        selectedEventEl = null;
      }
      
      if (onSelectRange) {
        onSelectRange(info);
      }
      info.view.calendar.unselect();
    },
    eventDrop(info) {
      if (onEventDrop) {
        onEventDrop(info.event, info.oldEvent);
      }
    },
    eventResize(info) {
      if (onEventResize) {
        onEventResize(info.event, info.oldEvent, info.startDelta, info.endDelta);
      }
    },
    eventDidMount(info) {
      info.el.addEventListener("dblclick", () => {
        if (onEventOpen) {
          onEventOpen(info.event);
        }
      });
      
      // Add resize handle elements for better visibility and touch targets
      const handles = createResizeHandles();
      info.el.appendChild(handles.top);
      info.el.appendChild(handles.bottom);
    }
  });

  const normalizedEvents = events.map((record) => toCalendarEvent(record));
  calendar.addEventSource(normalizedEvents);
  calendar.render();

  return calendar;
}
