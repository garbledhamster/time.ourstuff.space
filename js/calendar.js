import { eventColors } from "./utils.js";

/**
 * Create resize handle elements for better visibility and touch targets
 * Uses custom class names to avoid conflicts with FullCalendar's internal classes
 */
function createResizeHandles() {
  const topHandle = document.createElement('div');
  topHandle.className = 'custom-resize-handle custom-resize-handle-top';
  topHandle.setAttribute('aria-hidden', 'true'); // Purely decorative, FullCalendar handles resize functionality
  
  const bottomHandle = document.createElement('div');
  bottomHandle.className = 'custom-resize-handle custom-resize-handle-bottom';
  bottomHandle.setAttribute('aria-hidden', 'true'); // Purely decorative, FullCalendar handles resize functionality
  
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

  let selectedEventId = null; // Track by ID instead of DOM element reference

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
      if (selectedEventId && selectedEventId !== info.event.id) {
        const prevSelected = document.querySelector('.fc-event-selected');
        if (prevSelected) {
          prevSelected.classList.remove('fc-event-selected');
        }
      }
      
      // Add selected class to clicked event
      info.el.classList.add('fc-event-selected');
      selectedEventId = info.event.id;
      
      if (onEventPreview) {
        onEventPreview(info.event, clickX, clickY);
      }
    },
    select(info) {
      // Clear selection when selecting a new time range
      if (selectedEventId) {
        const prevSelected = document.querySelector('.fc-event-selected');
        if (prevSelected) {
          prevSelected.classList.remove('fc-event-selected');
        }
        selectedEventId = null;
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
      // Check if handles already exist to avoid duplicates
      if (!info.el.querySelector('.custom-resize-handle')) {
        const handles = createResizeHandles();
        info.el.appendChild(handles.top);
        info.el.appendChild(handles.bottom);
      }
      
      // Restore selected state if this event was selected
      if (selectedEventId === info.event.id) {
        info.el.classList.add('fc-event-selected');
      }
    },
    eventWillUnmount(info) {
      // Clear selection if the selected event is being removed
      if (selectedEventId === info.event.id) {
        selectedEventId = null;
      }
    }
  });

  const normalizedEvents = events.map((record) => toCalendarEvent(record));
  calendar.addEventSource(normalizedEvents);
  calendar.render();

  return calendar;
}
