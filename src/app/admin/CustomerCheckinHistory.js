"use client";

import { useEffect, useState } from "react";

function displayTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(value));
}

function displayDate(iso) {
  if (!iso) return "—";
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export default function CustomerCheckinHistory({ customerId, adminPin }) {
  const [page, setPage] = useState(0);
  const [records, setRecords] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(0);
  }, [customerId]);

  useEffect(() => {
    if (!customerId || !adminPin) return;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin-customer-checkins?customerId=${encodeURIComponent(customerId)}&page=${page}`, {
          headers: { "x-admin-pin": adminPin },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || "Unable to load history.");
        setRecords(data.checkins || []);
        setCount(data.count || 0);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message || "Unable to load history.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [customerId, adminPin, page]);

  return (
    <div className="rounded-xl border-2 border-white/60 bg-black/30 p-5 space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Customer Check-in History</h3>
        <p className="text-sm text-white/60">Previous check-ins, newest first · Eastern Time</p>
      </div>
      {loading ? <p className="text-white/60">Loading check-ins...</p> : error ? (
        <p role="alert" className="text-red-300">{error}</p>
      ) : records.length === 0 ? (
        <p className="text-white/60">No check-ins recorded for this customer.</p>
      ) : (
        <div className="space-y-2">
          {records.map((item) => (
            <div key={item.id} className="flex justify-between gap-3 border-b border-white/15 pb-2 last:border-0">
              <span>{displayDate(item.checkin_date)}</span>
              <span className="text-white/70">{displayTime(item.created_at)}</span>
            </div>
          ))}
        </div>
      )}
      {count > 10 && !error && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button type="button" disabled={loading || page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded-lg border border-white/50 px-3 py-2 disabled:opacity-40">Previous</button>
          <span className="text-white/60">{page * 10 + 1}–{Math.min((page + 1) * 10, count)} of {count}</span>
          <button type="button" disabled={loading || (page + 1) * 10 >= count} onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-white/50 px-3 py-2 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  );
}
