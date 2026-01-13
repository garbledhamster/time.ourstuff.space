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
