import { safeUUID } from "./utils.js";

// Generate a simple ULID-like ID (timestamp + random)
function generateULID() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `${timestamp}${random}`;
}

/**
 * Create an artifact from a ticket
 */
export function ticketToArtifact(ticket, owner = "local_user") {
  const now = new Date().toISOString();
  
  return {
    id: ticket.artifactId || generateULID(),
    type: "time",
    title: ticket.title || ticket.key || "Untitled",
    
    owner: owner,
    
    acl: {
      owners: [owner],
      editors: [],
      viewers: []
    },
    
    visibility: "private",
    
    primaryProjectId: null,
    projectIds: [],
    
    tags: ticket.client ? [ticket.client] : [],
    
    status: ticket.status === "closed" ? "archived" : "active",
    schemaVersion: 1,
    
    createdAt: ticket.createdAt || now,
    updatedAt: now,
    
    refs: {
      assets: [],
      sources: [],
      links: []
    },
    
    data: {
      core: {
        text: ticket.note || "",
        context: {
          source: "ticket-time-tracker",
          location: "",
          url: ""
        },
        assetIds: [],
        meta: {
          ticketKey: ticket.key || "",
          ticketStatus: ticket.status || "open"
        }
      },
      
      time: {
        ticketId: ticket.id,
        ticketKey: ticket.key || "",
        client: ticket.client || "",
        legacyStatus: ticket.status || "open"
      }
    },
    
    extraAttributes: {
      extraAttribute1: null,
      extraAttribute2: null,
      extraAttribute3: null,
      extraAttribute4: null,
      extraAttribute5: null
    }
  };
}

/**
 * Create an artifact from a time entry event
 */
export function eventToArtifact(event, owner = "local_user") {
  const now = new Date().toISOString();
  const start = new Date(event.start);
  const end = new Date(event.end);
  const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  
  return {
    id: event.artifactId || generateULID(),
    type: "time",
    title: event.title || "Time Entry",
    
    owner: owner,
    
    acl: {
      owners: [owner],
      editors: [],
      viewers: []
    },
    
    visibility: "private",
    
    primaryProjectId: event.ticketArtifactId || null,
    projectIds: event.ticketArtifactId ? [event.ticketArtifactId] : [],
    
    tags: [],
    
    status: "active",
    schemaVersion: 1,
    
    createdAt: event.createdAt || now,
    updatedAt: now,
    
    refs: {
      assets: [],
      sources: [],
      links: []
    },
    
    data: {
      core: {
        text: event.notes || "",
        context: {
          source: "ticket-time-tracker",
          location: "",
          url: ""
        },
        assetIds: [],
        meta: {
          ticketKey: event.ticketKey || "",
          duration: `${durationMinutes} minutes`
        }
      },
      
      time: {
        eventId: event.id,
        ticketId: event.ticketId,
        ticketKey: event.ticketKey || "",
        startTime: event.start,
        endTime: event.end,
        durationMinutes: durationMinutes,
        notes: event.notes || ""
      }
    },
    
    extraAttributes: {
      extraAttribute1: null,
      extraAttribute2: null,
      extraAttribute3: null,
      extraAttribute4: null,
      extraAttribute5: null
    }
  };
}

/**
 * Convert artifact back to ticket format
 */
export function artifactToTicket(artifact) {
  if (!artifact || artifact.type !== "time" || !artifact.data?.time?.ticketId) {
    return null;
  }
  
  return {
    id: artifact.data.time.ticketId,
    key: artifact.data.time.ticketKey || "",
    title: artifact.title || "",
    status: artifact.data.time.legacyStatus || (artifact.status === "archived" ? "closed" : "open"),
    client: artifact.data.time.client || "",
    note: artifact.data.core?.text || "",
    artifactId: artifact.id,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}

/**
 * Convert artifact back to event format
 */
export function artifactToEvent(artifact) {
  if (!artifact || artifact.type !== "time" || !artifact.data?.time?.eventId) {
    return null;
  }
  
  return {
    id: artifact.data.time.eventId,
    ticketId: artifact.data.time.ticketId,
    ticketKey: artifact.data.time.ticketKey || "",
    title: artifact.title || "Time Entry",
    start: artifact.data.time.startTime,
    end: artifact.data.time.endTime,
    notes: artifact.data.time.notes || "",
    artifactId: artifact.id,
    ticketArtifactId: artifact.primaryProjectId,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt
  };
}

/**
 * Migrate old format data to artifacts
 */
export function migrateToArtifacts(tickets, events, owner = "local_user") {
  const artifacts = [];
  const ticketIdToArtifactId = new Map();
  
  // Convert tickets to artifacts
  for (const ticket of tickets) {
    const artifact = ticketToArtifact(ticket, owner);
    artifacts.push(artifact);
    ticketIdToArtifactId.set(ticket.id, artifact.id);
  }
  
  // Convert events to artifacts, linking to ticket artifacts
  for (const event of events) {
    const ticketArtifactId = ticketIdToArtifactId.get(event.ticketId);
    const eventWithLink = {
      ...event,
      ticketArtifactId
    };
    const artifact = eventToArtifact(eventWithLink, owner);
    artifacts.push(artifact);
  }
  
  return artifacts;
}

/**
 * Extract tickets and events from artifacts
 */
export function extractFromArtifacts(artifacts) {
  const tickets = [];
  const events = [];
  
  for (const artifact of artifacts) {
    if (!artifact || artifact.type !== "time" || !artifact.data?.time) continue;
    
    if (artifact.data.time.ticketId && !artifact.data.time.eventId) {
      // This is a ticket artifact
      const ticket = artifactToTicket(artifact);
      if (ticket) tickets.push(ticket);
    } else if (artifact.data.time.eventId) {
      // This is an event artifact
      const event = artifactToEvent(artifact);
      if (event) events.push(event);
    }
  }
  
  return { tickets, events };
}
