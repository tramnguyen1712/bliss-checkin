"use client";

import { useState } from "react";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

export default function CheckinPage() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");

    const cleaned = normalizePhone(phone);
    if (cleaned.length < 10) {
      setMessage("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned, name: needsName ? name : undefined }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessage(data.message || "Something went wrong.");
        return;
      }

      if (data.needsName) {
        setNeedsName(true);
        setMessage(data.message);
        return;
      }

      setMessage(data.message);
      setNeedsName(false);
      setName("");
      // Auto-reset after 5 seconds for next client
      setTimeout(() => {
        setPhone("");
        setMessage("");
      }, 7000);
    } catch (err) {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border-2 border border-white/60 bg-white/5 p-6 shadow-xl">
        {/* Header with Home button */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Bliss Nail Spa — Check In</h1>
            <p className="mt-2 text-sm text-white/70">
              Enter your phone number to check in and earn 1 POINT 🥳.
            </p>
            <h1 className="text-2xl font-semibold">✅10 POINTS = 10% OFF🎉</h1>
          </div>

          <a
            href="/"
            className="shrink-0 rounded-xl border-2 border border-white/60 bg-black/30 px-4 py-2 text-sm hover:bg-black/40"
          >
            Home
          </a>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-3">
          <label className="block text-sm text-white/80">Phone Number</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="numeric"
            placeholder="(919) 555-1234"
            className="w-full rounded-xl bg-black/40 border-2 border border-white/60 px-4 py-3 text-lg outline-none focus:border-white/40"
          />

          {needsName && (
            <>
              <label className="block text-sm text-white/80 mt-3">Your Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                type="text"
                placeholder="First & last name"
                className="w-full rounded-xl bg-black/40 border-2 border border-white/60 px-4 py-3 text-lg outline-none focus:border-white/40"
              />
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white text-black font-semibold py-3 text-lg hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "Please wait..." : needsName ? "Sign Up & Check In" : "Check In"}
          </button>
        </form>

        <div className="mt-4 rounded-xl border-2 border border-white/60 bg-black/30 p-3 text-sm text-white/80 min-h-[44px]">
          {message || " "}
        </div>
      </div>
    </div>
  );
}