"use client";

import { useEffect, useState } from "react";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [phone, setPhone] = useState("");
  const [result, setResult] = useState(null); // { name, phone, points }
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Always require PIN on page load (don't restore session)
  useEffect(() => {
    // PIN is required every time, no session persistence
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    if (!pin.trim()) {
      setMessage("Enter staff PIN.");
      return;
    }

    setAuthLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });

      const data = await res.json();
      if (!data.ok) {
        setMessage(data.message || "Wrong staff PIN.");
        return;
      }

      sessionStorage.setItem("admin_pin", pin.trim());
      sessionStorage.setItem("admin_authed", "1");
      setAuthed(true);
      setMessage("");
    } catch {
      setMessage("Network error.");
    } finally {
      setAuthLoading(false);
    }
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
      <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl rounded-2xl border-2 border border-white/60 bg-white/5 p-8 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Staff Admin</h1>
              <p className="mt-3 text-base text-white/70">Enter the staff PIN to continue.</p>
            </div>

            <a
              href="/"
              className="shrink-0 rounded-xl border-2 border border-white/60 bg-black/30 px-5 py-3 text-base hover:bg-black/40"
            >
              Home
            </a>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Staff PIN"
              type="password"
              inputMode="numeric"
              className="w-full rounded-xl bg-black/40 border-2 border border-white/60 px-5 py-4 text-xl outline-none focus:border-white/40"
            />
            <button
              disabled={authLoading}
              className="w-full rounded-xl bg-white text-black font-semibold py-4 text-xl hover:bg-white/90 disabled:opacity-60"
            >
              {authLoading ? "Checking..." : "Unlock Admin"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border-2 border border-white/60 bg-black/30 p-4 text-lg text-white/80 min-h-[56px]">
            {message || " "}
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-2xl border-2 border border-white/60 bg-white/5 p-8 shadow-xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Admin — Points Lookup</h1>
            <p className="mt-3 text-base text-white/70">
              Enter customer phone to view points and redeem 10% (costs 10 points).
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-xl border-2 border border-white/60 bg-black/30 px-5 py-3 text-base hover:bg-black/40"
            >
              Home
            </a>
            <button
              onClick={logout}
              className="rounded-xl border-2 border border-white/60 bg-black/30 px-5 py-3 text-base hover:bg-black/40"
            >
              Logout
            </button>
          </div>
        </div>

        <form onSubmit={lookup} className="mt-8 flex gap-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Customer phone"
            className="flex-1 rounded-xl bg-black/40 border-2 border border-white/60 px-5 py-4 text-lg outline-none focus:border-white/40"
          />
          <button
            disabled={loading}
            className="rounded-xl bg-white text-black text-lg font-semibold px-6 py-4 disabled:opacity-60"
          >
            {loading ? "..." : "Search"}
          </button>
        </form>

        {result && (
          <div className="mt-8 rounded-xl border-2 border border-white/60 bg-black/30 p-5">
            <div className="text-2xl font-semibold">{result.name}</div>
            <div className="text-base text-white/70 mt-1">Phone: {result.phone}</div>
            <div className="mt-4 text-2xl">
              Points: <span className="font-bold">{result.points}</span>
            </div>

            <button
              onClick={redeem}
              disabled={loading}
              className="mt-5 w-full rounded-xl bg-white text-black text-lg font-semibold py-4 disabled:opacity-60"
            >
              Redeem 10% (Use 10 points)
            </button>
          </div>
        )}

        <div className="mt-6 rounded-xl border-2 border border-white/60 bg-black/30 p-4 text-lg text-white/80 min-h-[56px]">
          {message || " "}
        </div>
      </div>
    </div>
  );
}