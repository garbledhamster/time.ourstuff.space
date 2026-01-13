// IndexedDB-backed storage via localForage (no build step required)
const DB = localforage.createInstance({ name: "ticket-time-tracker", storeName: "v1" });

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
