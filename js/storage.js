// IndexedDB-backed storage via localForage (no build step required)
const hasLocalForage = typeof localforage !== "undefined";
const DB = hasLocalForage
  ? localforage.createInstance({ name: "ticket-time-tracker", storeName: "v1" })
  : {
      async getItem(key) {
        try {
          const raw = localStorage.getItem(key);
          return raw ? JSON.parse(raw) : null;
        } catch (error) {
          console.error("Local storage read failed", error);
          return null;
        }
      },
      async setItem(key, value) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          console.error("Local storage write failed", error);
        }
      }
    };

const KEYS = {
  tickets: "tickets_v1",
  events: "events_v1"
};

export async function loadTickets() {
  const t = await DB.getItem(KEYS.tickets);
  return Array.isArray(t) ? t : [];
}

export async function saveTickets(tickets) {
  await DB.setItem(KEYS.tickets, tickets);
}

export async function loadEvents() {
  const e = await DB.getItem(KEYS.events);
  return Array.isArray(e) ? e : [];
}

export async function saveEvents(events) {
  await DB.setItem(KEYS.events, events);
}
