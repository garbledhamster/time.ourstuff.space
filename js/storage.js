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
  events: "events_v1",
  settings: "settings_v1",
  artifacts: "artifacts_v1",
  migrated: "migrated_to_artifacts_v1"
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

export async function loadSettings() {
  const settings = await DB.getItem(KEYS.settings);
  return settings && typeof settings === "object" ? settings : {};
}

export async function saveSettings(settings) {
  await DB.setItem(KEYS.settings, settings);
}

export async function loadArtifacts() {
  const a = await DB.getItem(KEYS.artifacts);
  return Array.isArray(a) ? a : [];
}

export async function saveArtifacts(artifacts) {
  await DB.setItem(KEYS.artifacts, artifacts);
}

export async function checkMigrated() {
  return await DB.getItem(KEYS.migrated);
}

export async function setMigrated(value) {
  await DB.setItem(KEYS.migrated, value);
}
