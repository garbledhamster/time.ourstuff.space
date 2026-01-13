import { eventColors } from "./utils.js";

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

export function createCalendar({ events, onSelectRange, onEventOpen, onEventChange }) {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) {
    throw new Error("Calendar element not found");
  }

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: "timeGridWeek",
    nowIndicator: true,
    selectable: true,
    editable: true,
    headerToolbar: false,
    height: "100%",
    eventClick(info) {
      if (onEventOpen) {
        onEventOpen(info.event);
      }
    },
    select(info) {
      if (onSelectRange) {
        onSelectRange(info);
      }
      info.view.calendar.unselect();
    },
    eventChange(info) {
      if (onEventChange) {
        onEventChange(info.event);
      }
    },
    eventDidMount(info) {
      info.el.addEventListener("dblclick", () => {
        if (onEventOpen) {
          onEventOpen(info.event);
        }
      });
    }
  });

  const normalizedEvents = events.map((record) => toCalendarEvent(record));
  calendar.addEventSource(normalizedEvents);
  calendar.render();

  return calendar;
}
