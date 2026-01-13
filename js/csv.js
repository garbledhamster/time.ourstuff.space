import { minutesBetween } from "./utils.js";

function csvEscape(v) {
  const s = String(v ?? "");
  return `"${s.replaceAll('"', '""')}"`;
}

export function buildCsv(tickets, logs) {
  const ticketsById = new Map(tickets.map(t => [t.id, t]));
  const rows = [];
  rows.push(["Start","End","Minutes","TicketKey","Title","Notes"].join(","));

  const sorted = [...logs].sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  for (const log of sorted) {
    const t = ticketsById.get(log.ticketId);
    const s = new Date(log.start);
    const e = new Date(log.end);
    const mins = minutesBetween(s, e);

    rows.push([
      csvEscape(s.toISOString()),
      csvEscape(e.toISOString()),
      String(mins),
      csvEscape(log.ticketKey),
      csvEscape(t?.title ?? ""),
      csvEscape(log.notes ?? "")
    ].join(","));
  }
  return rows.join("\n");
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === "\"") {
        const next = text[i + 1];
        if (next === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}
