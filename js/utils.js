export function $(id) {
  return document.getElementById(id);
}

export function safeUUID() {
  return (crypto && crypto.randomUUID) ? crypto.randomUUID() : ("id-" + Math.random().toString(16).slice(2) + "-" + Date.now());
}

export function debounce(fn, ms = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function addMinutes(date, minutes) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

export function toLocalInputValue(date) {
  const d = new Date(date);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(val) {
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function snapToMinutes(date, minutes) {
  const ms = date.getTime();
  const step = minutes * 60 * 1000;
  return new Date(Math.round(ms / step) * step);
}

export function nowIso() {
  return new Date().toISOString();
}

export function extractTicketKey(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";

  const m1 = s.match(/tickets\/(\d+)/i);
  if (m1 && m1[1]) return m1[1];

  const m2 = s.match(/(\d{4,})\D*$/);
  if (m2 && m2[1]) return m2[1];

  return s;
}

export function normalizeTitle(ticketKey, title) {
  const key = String(ticketKey || "").trim();
  const t = String(title || "").trim();
  if (!key && !t) return "Untitled";
  if (key && t) return `${key} — ${t}`;
  return key || t;
}

export function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function eventColors(seed) {
  const hue = hashHue(seed);
  return {
    backgroundColor: `hsla(${hue}, 80%, 55%, 0.20)`,
    borderColor: `hsla(${hue}, 85%, 60%, 0.55)`,
    textColor: `rgba(255,255,255,.95)`
  };
}

export function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function minutesBetween(a, b) {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

/**
 * Snap an event's start/end to nearby event boundaries.
 * Priority: snap to touching event boundaries before allowing overlap.
 * When dragging near another event, first snaps to touch it (no overlap).
 * Only if dragged further past does it allow overlapping.
 *
 * @param {Date} start - The event's start time
 * @param {Date} end - The event's end time
 * @param {Array} otherEvents - Array of other events with start/end properties
 * @param {Object} options - Snapping options
 * @param {number} options.thresholdMinutes - Snap threshold in minutes (default 15)
 * @param {'move'|'resize-start'|'resize-end'} options.mode - Operation mode
 * @returns {{start: Date, end: Date, snapped: boolean}}
 */
export function snapToEventBoundaries(start, end, otherEvents, options = {}) {
  const { thresholdMinutes = 15, mode = 'move' } = typeof options === 'number'
    ? { thresholdMinutes: options }
    : options;

  const thresholdMs = thresholdMinutes * 60 * 1000;
  const startMs = start.getTime();
  const endMs = end.getTime();
  const duration = endMs - startMs;

  let snappedStart = startMs;
  let snappedEnd = endMs;
  let snapped = false;

  // Collect all event boundaries with their parent event info
  const boundaries = [];
  for (const evt of otherEvents) {
    const evtStart = new Date(evt.start).getTime();
    const evtEnd = new Date(evt.end).getTime();
    if (!isNaN(evtStart) && !isNaN(evtEnd)) {
      boundaries.push({ time: evtStart, type: 'start', eventStart: evtStart, eventEnd: evtEnd });
      boundaries.push({ time: evtEnd, type: 'end', eventStart: evtStart, eventEnd: evtEnd });
    }
  }

  // Helper: check if snapping to this boundary would create overlap
  const wouldOverlap = (newStart, newEnd, boundary) => {
    // Check if the new event range overlaps with the boundary's parent event
    return newStart < boundary.eventEnd && newEnd > boundary.eventStart;
  };

  // Helper: find best snap point for a given time, preferring non-overlapping snaps
  const findBestSnap = (targetMs, newStartIfSnap, newEndIfSnap, preferType) => {
    let bestNonOverlap = null;
    let bestNonOverlapDist = Infinity;
    let bestAny = null;
    let bestAnyDist = Infinity;

    for (const b of boundaries) {
      const dist = Math.abs(targetMs - b.time);
      if (dist > thresholdMs) continue;

      // Calculate what the event position would be if we snap here
      const testStart = newStartIfSnap(b.time);
      const testEnd = newEndIfSnap(b.time);
      const overlaps = wouldOverlap(testStart, testEnd, b);

      // Track closest regardless of overlap
      if (dist < bestAnyDist) {
        bestAnyDist = dist;
        bestAny = b;
      }

      // Prefer snaps that don't cause overlap, and prefer the right boundary type
      if (!overlaps) {
        const typeBonus = b.type === preferType ? 0.5 : 1;
        const effectiveDist = dist * typeBonus;
        if (effectiveDist < bestNonOverlapDist) {
          bestNonOverlapDist = effectiveDist;
          bestNonOverlap = b;
        }
      }
    }

    // Return non-overlapping snap if available, otherwise any snap
    return bestNonOverlap || bestAny;
  };

  if (mode === 'resize-start') {
    // Only snap the start time, keep end fixed
    const snap = findBestSnap(
      startMs,
      (t) => t,
      () => endMs,
      'end' // Prefer snapping to other events' end times
    );
    if (snap) {
      snappedStart = snap.time;
      snapped = true;
    }
  } else if (mode === 'resize-end') {
    // Only snap the end time, keep start fixed
    const snap = findBestSnap(
      endMs,
      () => startMs,
      (t) => t,
      'start' // Prefer snapping to other events' start times
    );
    if (snap) {
      snappedEnd = snap.time;
      snapped = true;
    }
  } else {
    // Move mode: snap based on closest boundary, maintaining duration

    // Check start boundary first
    const startSnap = findBestSnap(
      startMs,
      (t) => t,
      (t) => t + duration,
      'end' // When moving, prefer snapping our start to other events' ends
    );

    // Check end boundary
    const endSnap = findBestSnap(
      endMs,
      (t) => t - duration,
      (t) => t,
      'start' // When moving, prefer snapping our end to other events' starts
    );

    // Use the closer snap point
    const startDist = startSnap ? Math.abs(startMs - startSnap.time) : Infinity;
    const endDist = endSnap ? Math.abs(endMs - endSnap.time) : Infinity;

    if (startDist <= endDist && startSnap) {
      snappedStart = startSnap.time;
      snappedEnd = snappedStart + duration;
      snapped = true;
    } else if (endSnap) {
      snappedEnd = endSnap.time;
      snappedStart = snappedEnd - duration;
      snapped = true;
    }
  }

  return {
    start: new Date(snappedStart),
    end: new Date(snappedEnd),
    snapped
  };
}

/**
 * Time format types for duration display
 */
const TIME_FORMATS = ['hm', 'decimal', 'minutes', 'seconds'];
const TIME_FORMAT_KEY = 'timeDisplayFormat';

/**
 * Get current time format preference from localStorage
 */
export function getTimeFormat() {
  const stored = localStorage.getItem(TIME_FORMAT_KEY);
  return TIME_FORMATS.includes(stored) ? stored : 'hm';
}

/**
 * Set time format preference in localStorage
 */
export function setTimeFormat(format) {
  if (TIME_FORMATS.includes(format)) {
    localStorage.setItem(TIME_FORMAT_KEY, format);
  }
}

/**
 * Cycle to the next time format
 */
export function cycleTimeFormat() {
  const current = getTimeFormat();
  const currentIndex = TIME_FORMATS.indexOf(current);
  const nextIndex = (currentIndex + 1) % TIME_FORMATS.length;
  const nextFormat = TIME_FORMATS[nextIndex];
  setTimeFormat(nextFormat);
  return nextFormat;
}

/**
 * Format duration in total seconds based on selected format
 * @param {number} totalSeconds - Duration in seconds
 * @param {string} format - Format type: 'hm', 'decimal', 'minutes', 'seconds'
 * @returns {string} Formatted duration string
 */
export function formatDurationByFormat(totalSeconds, format) {
  if (totalSeconds < 0 || isNaN(totalSeconds)) {
    return '0s';
  }

  switch (format) {
    case 'hm': {
      // Format: 1h 30m (omit seconds)
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const parts = [];
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (seconds > 0 && parts.length === 0) parts.push(`${seconds}s`);
      
      return parts.length > 0 ? parts.join(' ') : '0s';
    }
    
    case 'decimal': {
      // Format: 1.5h
      const hours = totalSeconds / 3600;
      return hours >= 0.01 ? `${hours.toFixed(2)}h` : '0h';
    }
    
    case 'minutes': {
      // Format: 90m
      const minutes = Math.floor(totalSeconds / 60);
      return `${minutes}m`;
    }
    
    case 'seconds': {
      // Format: 5400s
      return `${totalSeconds}s`;
    }
    
    default:
      return formatDurationByFormat(totalSeconds, 'hm');
  }
}
