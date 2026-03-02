"use client";

import { useEffect, useState } from "react";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);

  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null); // { name, phone, points }
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Keep login on refresh (optional)
  useEffect(() => {
    const saved = sessionStorage.getItem("admin_authed");
    if (saved === "1") setAuthed(true);
  }, []);

  function handleLogin(e) {
    e.preventDefault();
    if (!pin.trim()) {
      setMessage("Enter staff PIN.");
      return;
    }
    // We don’t validate pin on the client (secure validation is on the server in /api/redeem)
    sessionStorage.setItem("admin_pin", pin.trim());
    sessionStorage.setItem("admin_authed", "1");
    setAuthed(true);
    setMessage("");
  }

  function logout() {
    sessionStorage.removeItem("admin_pin");
    sessionStorage.removeItem("admin_authed");
    setAuthed(false);
    setPin("");
    setPhone("");
    setResult(null);
    setMessage("Logged out.");
  }

  async function lookup(e) {
    e.preventDefault();
    setMessage("");
    setResult(null);

    const cleaned = normalizePhone(phone);
    if (cleaned.length < 10) {
      setMessage("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/customer?phone=${cleaned}`);
      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message || "Lookup failed.");
      } else {
        setResult(data.customer);
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function redeem() {
    if (!result) return;
    setMessage("");
    setLoading(true);

    const adminPin = sessionStorage.getItem("admin_pin") || "";

    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify({ phone: result.phone }),
      });

      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message || "Redeem failed.");
      } else {
        setResult((prev) => ({ ...prev, points: data.points }));
        setMessage(data.message);
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  // PIN screen
  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
        <div className="w-full max-w-md rounded-2xl border-2 border border-white/60 bg-white/5 p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold">Staff Admin</h1>
              <p className="mt-2 text-sm text-white/70">Enter the staff PIN to continue.</p>
            </div>

            <a
              href="/"
              className="shrink-0 rounded-xl border-2 border border-white/60 bg-black/30 px-4 py-2 text-sm hover:bg-black/40"
            >
              Home
            </a>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Staff PIN"
              type="password"
              inputMode="numeric"
              className="w-full rounded-xl bg-black/40 border-2 border border-white/60 px-4 py-3 text-lg outline-none focus:border-white/40"
            />
            <button className="w-full rounded-xl bg-white text-black font-semibold py-3 text-lg hover:bg-white/90">
              Unlock Admin
            </button>
          </form>

          <div className="mt-4 rounded-xl border-2 border border-white/60 bg-black/30 p-3 text-sm text-white/80 min-h-[44px]">
            {message || " "}
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-black text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border-2 border border-white/60 bg-white/5 p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Admin — Points Lookup</h1>
            <p className="mt-2 text-sm text-white/70">
              Enter customer phone to view points and redeem 10% (costs 10 points).
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-xl border-2 border border-white/60 bg-black/30 px-4 py-2 text-sm hover:bg-black/40"
            >
              Home
            </a>
            <button
              onClick={logout}
              className="rounded-xl border-2 border border-white/60 bg-black/30 px-4 py-2 text-sm hover:bg-black/40"
            >
              Logout
            </button>
          </div>
        </div>

        <form onSubmit={lookup} className="mt-6 flex gap-2">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Customer phone"
            className="flex-1 rounded-xl bg-black/40 border-2 border border-white/60 px-4 py-3 outline-none focus:border-white/40"
          />
          <button
            disabled={loading}
            className="rounded-xl bg-white text-black font-semibold px-4 py-3 disabled:opacity-60"
          >
            {loading ? "..." : "Search"}
          </button>
        </form>

        {result && (
          <div className="mt-6 rounded-xl border-2 border border-white/60 bg-black/30 p-4">
            <div className="text-lg font-semibold">{result.name}</div>
            <div className="text-sm text-white/70">Phone: {result.phone}</div>
            <div className="mt-3 text-xl">
              Points: <span className="font-bold">{result.points}</span>
            </div>

            <button
              onClick={redeem}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-white text-black font-semibold py-3 disabled:opacity-60"
            >
              Redeem 10% (Use 10 points)
            </button>
          </div>
        )}

        <div className="mt-4 rounded-xl border-2 border border-white/60 bg-black/30 p-3 text-sm text-white/80 min-h-[44px]">
          {message || " "}
        </div>
      </div>
    </div>
  );
}