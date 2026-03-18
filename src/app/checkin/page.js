"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

function formatPhoneDisplay(input) {
  const digits = normalizePhone(input).slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function CheckinPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState(""); // MM/DD
  const [needsName, setNeedsName] = useState(false);
  const [needsDob, setNeedsDob] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function appendDigit(digit) {
    setPhone((prev) => {
      const digits = normalizePhone(prev);
      if (digits.length >= 10) return digits;
      return `${digits}${digit}`;
    });
  }

  function removeLastDigit() {
    setPhone((prev) => normalizePhone(prev).slice(0, -1));
  }

  function clearPhone() {
    setPhone("");
  }

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
        body: JSON.stringify({
          phone: cleaned,
          name: needsName ? name : undefined,
          dob: needsDob ? dob : undefined,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMessage(data.message || "Something went wrong.");
        return;
      }

      if (data.needsName) setNeedsName(true);
      if (data.needsDob) setNeedsDob(true);

      if (data.needsName || data.needsDob) {
        setMessage(data.message);
        return;
      }

      setNeedsName(false);
      setNeedsDob(false);
      setName("");
      setDob("");
      setPhone("");

      const msg = data.birthdayMessage ? `${data.message}\n\n${data.birthdayMessage}` : data.message;
      router.push(`/checkin/result?message=${encodeURIComponent(msg || "Check-in successful.")}`);
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="relative w-full max-w-5xl rounded-2xl border-2 border-white/60 bg-white/5 p-6 shadow-xl">
        <a
          href="/"
          className="absolute left-6 top-6 rounded-lg border-2 border-white/60 bg-black/30 px-3 py-2 text-sm hover:bg-black/40"
        >
          Home
        </a>

        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col pt-14">
            <h1 className="text-3xl font-semibold">Bliss Nail Spa — Check In</h1>
            <p className="mt-3 text-base text-white/70">Enter your phone number to check in and earn 1 POINT.</p>
            <h2 className="text-3xl font-semibold mt-2">✅ 10 POINTS = 10% OFF 🎉</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-base text-white/80">Phone Number</label>
            <input
              value={formatPhoneDisplay(phone)}
              readOnly
              type="text"
              onFocus={(e) => e.target.blur()}
              placeholder="(919) 555-1234"
              className="w-full rounded-xl bg-black/40 border-2 border-white/60 px-5 py-4 text-xl outline-none"
            />

            {!needsName && !needsDob && (
              <div className="grid grid-cols-3 gap-1 justify-items-center">
                {["1","2","3","4","5","6","7","8","9"].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => appendDigit(digit)}
                    className="h-14 w-14 rounded-full border-2 border-white/60 bg-black/30 text-xl font-semibold hover:bg-black/40 active:bg-white active:text-black transition-colors"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearPhone}
                  className="h-14 w-14 rounded-full border-2 border-white/60 bg-black/30 text-xl font-semibold hover:bg-black/40 active:bg-white active:text-black transition-colors"
                >
                  C
                </button>
                <button
                  type="button"
                  onClick={() => appendDigit("0")}
                  className="h-14 w-14 rounded-full border-2 border-white/60 bg-black/30 text-xl font-semibold hover:bg-black/40 active:bg-white active:text-black transition-colors"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={removeLastDigit}
                  className="h-14 w-14 rounded-full border-2 border-white/60 bg-black/30 text-xl font-semibold hover:bg-black/40 active:bg-white active:text-black transition-colors"
                >
                  ⌫
                </button>
              </div>
            )}

            {needsName && (
              <>
                <label className="block text-base text-white/80 mt-3">Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  placeholder="First & last name"
                  className="w-full rounded-xl bg-black/40 border-2 border-white/60 px-5 py-4 text-xl outline-none"
                />
              </>
            )}

            {needsDob && (
              <>
                <label className="block text-base text-white/80 mt-3">Birthday (MM/DD)</label>
                <input
                  value={dob}
                  onChange={(e) => {
                    // Strip everything except digits, then auto-insert slash after 2 month digits
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                    if (digits.length <= 2) {
                      setDob(digits);
                    } else {
                      setDob(`${digits.slice(0, 2)}/${digits.slice(2)}`);
                    }
                  }}
                  type="text"
                  inputMode="numeric"
                  placeholder="03/25"
                  className="w-full rounded-xl bg-black/40 border-2 border-white/60 px-5 py-4 text-xl outline-none"
                />
                <p className="text-sm text-white/60">Year not needed. Used only for birthday promotions.</p>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-white text-black font-semibold py-4 text-xl hover:bg-white/90 disabled:opacity-60"
            >
              {loading ? "Please wait..." : (needsName || needsDob) ? "Save & Check In" : "Check In"}
            </button>

            {message && (
              <div className="rounded-xl border-2 border-white/60 bg-black/30 p-3 text-base text-white/80">
                {message}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}