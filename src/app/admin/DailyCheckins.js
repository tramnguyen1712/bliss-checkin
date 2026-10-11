"use client";

import { useCallback, useEffect, useState } from "react";

function dateNY() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function formatPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 10) return value || "—";
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function DailyCheckins({ adminPin, onManage, selectedDate, onDateChange }) {
  const date = selectedDate || dateNY();
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin-checkins?date=${encodeURIComponent(date)}`, {
        headers: { "x-admin-pin": adminPin }, cache: "no-store", signal,
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Could not load check-ins.");
      }
      setRows(result.checkins || []);
    } catch (err) {
      if (err.name !== "AbortError") {
        setError(err.message || "Could not load check-ins.");
        setRows([]);
      }
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [adminPin, date]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshCount]);

  const term = search.trim().toLowerCase();
  const searchDigits = term.replace(/\D/g, "");
  const filtered = rows.filter((r) =>
    !term || (r.name || "").toLowerCase().includes(term) ||
    (searchDigits.length > 0 && (r.phone || "").replace(/\D/g, "").includes(searchDigits))
  );

  return (
    <section className="rounded-xl border-2 border-white/60 bg-white/5 p-5 space-y-5" aria-label="Daily Check-in History">
      <div>
        <h2 className="text-2xl font-semibold">Daily Check-in History</h2>
        <p className="text-white/60 text-sm mt-1">Select a date to see who checked in. Times shown in Eastern Time.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 space-y-2">
          <label htmlFor="checkin-history-date" className="block text-sm text-white/80">Check-in date</label>
          <input id="checkin-history-date" type="date" value={date} max={dateNY()}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full rounded-xl border-2 border-white/60 bg-neutral-900 px-4 py-3 text-white scheme-dark" />
        </div>
        <div className="flex-1 space-y-2">
          <label htmlFor="checkin-history-search" className="block text-sm text-white/80">Find customer on this date</label>
          <input id="checkin-history-search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or phone" className="w-full rounded-xl border-2 border-white/60 bg-black/40 px-4 py-3 text-white" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/70">{rows.length} check-in{rows.length !== 1 ? "s" : ""} on {date}</p>
        <button type="button" onClick={() => setRefreshCount((n) => n + 1)} disabled={loading}
          className="rounded-lg border border-white/50 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-50">
          Refresh
        </button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-400/60 p-3 text-red-200">{error}</p>}
      {loading ? <p className="text-white/70">Loading check-ins...</p>
        : !error && filtered.length === 0 ? <p className="text-white/70">{rows.length === 0 ? "No customers checked in on this date." : "No matching customers on this date."}</p>
        : !error && (
          <div className="space-y-3">
            {filtered.map((r) => (
              <div key={r.checkin_id} className="rounded-xl border border-white/30 bg-black/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-semibold text-lg">{r.name}</span>
                    <span className="text-white/60 text-sm">{formatTime(r.created_at)}</span>
                  </div>
                  <p className="text-white/70 text-sm mt-1">{formatPhone(r.phone)} · {r.points} point{r.points !== 1 ? "s" : ""}</p>
                </div>
                <button type="button" onClick={() => onManage(r)} disabled={!r.phone}
                  className="shrink-0 rounded-xl bg-white text-black font-semibold px-5 py-3 hover:bg-white/90 disabled:opacity-40">
                  Manage
                </button>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}
