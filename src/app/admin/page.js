"use client";

import { useState } from "react";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

function isPhoneSearch(input) {
  // No letters and >= 10 stripped digits → treat as phone
  return !/[a-zA-Z]/.test(input) && normalizePhone(input).length >= 10;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatDob(month, day) {
  if (!month || !day) return "Not on file";
  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function redeemLabel(item) {
  if (item.type === "birthday") return "🎂 Birthday 20% OFF";
  return "🏆 10% Discount";
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [customer, setCustomer] = useState(null);
  const [history, setHistory] = useState([]);
  const [customersList, setCustomersList] = useState([]);

  const [adjustValue, setAdjustValue] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  function getAdminPin() {
    return sessionStorage.getItem("admin_pin") || "";
  }

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
    setAuthed(false);
    setPin("");
    setSearchInput("");
    setCustomer(null);
    setHistory([]);
    setCustomersList([]);
    setMessage("Logged out.");
  }

  async function fetchCustomer(phone) {
    const res = await fetch(`/api/admin-customer?phone=${normalizePhone(phone)}`, {
      headers: { "x-admin-pin": getAdminPin() },
    });
    const data = await res.json();
    if (!data.ok) {
      setMessage(data.message || "Lookup failed.");
      return false;
    }
    setCustomer(data.customer);
    setHistory(data.history || []);
    return true;
  }

  async function lookup(e) {
    e.preventDefault();
    setMessage("");
    setCustomer(null);
    setHistory([]);
    setCustomersList([]);
    setAdjustValue("");

    if (!searchInput.trim()) {
      setMessage("Enter a phone number or customer name.");
      return;
    }

    setLoading(true);
    try {
      const url = isPhoneSearch(searchInput)
        ? `/api/admin-customer?phone=${normalizePhone(searchInput)}`
        : `/api/admin-customer?name=${encodeURIComponent(searchInput.trim())}`;

      const res = await fetch(url, { headers: { "x-admin-pin": getAdminPin() } });
      const data = await res.json();

      if (!data.ok) {
        setMessage(data.message || "Lookup failed.");
        return;
      }

      if (data.customers) {
        if (data.customers.length === 1) {
          await fetchCustomer(data.customers[0].phone);
        } else {
          setCustomersList(data.customers);
        }
      } else {
        setCustomer(data.customer);
        setHistory(data.history || []);
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function selectFromList(c) {
    setCustomersList([]);
    setMessage("");
    setLoading(true);
    try {
      await fetchCustomer(c.phone);
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!customer) return;
    await fetchCustomer(customer.phone);
  }

  async function redeem() {
    if (!customer) return;
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": getAdminPin() },
        body: JSON.stringify({ phone: customer.phone }),
      });
      const data = await res.json();
      setMessage(data.message || (data.ok ? "Done." : "Failed."));
      if (data.ok) await refresh();
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function redeemBirthday() {
    if (!customer) return;
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin-birthday-redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": getAdminPin() },
        body: JSON.stringify({ phone: customer.phone }),
      });
      const data = await res.json();
      setMessage(data.message || (data.ok ? "Done." : "Failed."));
      if (data.ok) await refresh();
    } catch {
      setMessage("Network error.");
    } finally {
      setLoading(false);
    }
  }

  async function adjustPoints(action) {
    if (!customer) return;
    const value = parseInt(adjustValue, 10);
    if (isNaN(value) || value < 0) {
      setMessage("Enter a valid non-negative number.");
      return;
    }
    setAdjustLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-pin": getAdminPin() },
        body: JSON.stringify({ phone: customer.phone, action, value }),
      });
      const data = await res.json();
      setMessage(data.message || (data.ok ? "Done." : "Failed."));
      if (data.ok) {
        setCustomer((prev) => ({ ...prev, points: data.points }));
        setAdjustValue("");
      }
    } catch {
      setMessage("Network error.");
    } finally {
      setAdjustLoading(false);
    }
  }

  // ── PIN screen ───────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-black text-white p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl rounded-2xl border-2 border-white/60 bg-white/5 p-8 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Staff Admin</h1>
              <p className="mt-3 text-base text-white/70">Enter the staff PIN to continue.</p>
            </div>
            <a
              href="/"
              className="shrink-0 rounded-xl border-2 border-white/60 bg-black/30 px-5 py-3 text-base hover:bg-black/40"
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
              className="w-full rounded-xl bg-black/40 border-2 border-white/60 px-5 py-4 text-xl outline-none focus:border-white/40"
            />
            <button
              disabled={authLoading}
              className="w-full rounded-xl bg-white text-black font-semibold py-4 text-xl hover:bg-white/90 disabled:opacity-60"
            >
              {authLoading ? "Checking..." : "Unlock Admin"}
            </button>
          </form>

          <div className="mt-6 rounded-xl border-2 border-white/60 bg-black/30 p-4 text-lg text-white/80 min-h-[56px]">
            {message || " "}
          </div>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="w-full max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Staff Admin</h1>
            <p className="mt-1 text-sm text-white/60">Search by phone number or customer name.</p>
          </div>
          <div className="flex gap-2">
            <a
              href="/"
              className="rounded-xl border-2 border-white/60 bg-black/30 px-5 py-3 text-base hover:bg-black/40"
            >
              Home
            </a>
            <button
              onClick={logout}
              className="rounded-xl border-2 border-white/60 bg-black/30 px-5 py-3 text-base hover:bg-black/40"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Search form */}
        <form onSubmit={lookup} className="flex gap-3">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Phone number or customer name"
            className="flex-1 rounded-xl bg-black/40 border-2 border-white/60 px-5 py-4 text-lg outline-none focus:border-white/40"
          />
          <button
            disabled={loading}
            className="rounded-xl bg-white text-black text-lg font-semibold px-6 py-4 hover:bg-white/90 disabled:opacity-60"
          >
            {loading ? "..." : "Search"}
          </button>
        </form>

        {/* Multiple name-search results */}
        {customersList.length > 0 && (
          <div className="rounded-xl border-2 border-white/60 bg-black/30 p-5 space-y-3">
            <p className="text-white/60 text-sm">Multiple customers found — select one:</p>
            {customersList.map((c) => (
              <button
                key={c.id}
                onClick={() => selectFromList(c)}
                className="w-full text-left rounded-xl border border-white/30 bg-black/20 px-4 py-3 hover:bg-white/10 transition-colors"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-white/60 ml-3 text-sm">{c.phone}</span>
                <span className="text-white/50 ml-3 text-sm">{c.points} pts</span>
                {c.dob_month && (
                  <span className="text-white/40 ml-3 text-sm">
                    🎂 {formatDob(c.dob_month, c.dob_day)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Customer card */}
        {customer && (
          <div className="rounded-xl border-2 border-white/60 bg-black/30 p-5 space-y-5">

            {/* Basic info */}
            <div>
              <div className="text-2xl font-semibold">{customer.name}</div>
              <div className="text-base text-white/70 mt-1">Phone: {customer.phone}</div>
              <div className="text-base text-white/70">
                Birthday: {formatDob(customer.dob_month, customer.dob_day)}
              </div>
            </div>

            {/* Points */}
            <div className="text-3xl">
              Points: <span className="font-bold">{customer.points}</span>
            </div>

            {/* Birthday promo section */}
            {customer.dob_month && customer.dob_day && (
              <div>
                {customer.birthdayEligible ? (
                  <div className="rounded-xl border-2 border-yellow-400/70 bg-yellow-400/10 p-4">
                    <p className="text-yellow-300 font-semibold text-lg">🎂 Birthday Promo Available</p>
                    <p className="text-yellow-300/80 text-sm mt-1">
                      Customer is within their birthday window. Redeem 20% OFF (uses 1 point).
                    </p>
                    <button
                      onClick={redeemBirthday}
                      disabled={loading}
                      className="mt-3 w-full rounded-xl bg-yellow-400 text-black text-lg font-semibold py-3 hover:bg-yellow-300 disabled:opacity-60 transition-colors"
                    >
                      Redeem Birthday 20% OFF
                    </button>
                  </div>
                ) : customer.birthdayRedeemed ? (
                  <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                    <p className="text-white/50 text-sm">🎂 Birthday promo already redeemed this year.</p>
                  </div>
                ) : null}
              </div>
            )}

            {/* 10% Redeem */}
            <button
              onClick={redeem}
              disabled={loading || customer.points < 10}
              className="w-full rounded-xl bg-white text-black text-lg font-semibold py-4 hover:bg-white/90 disabled:opacity-40 transition-colors"
            >
              Redeem 10% Discount (uses 10 points)
            </button>

            {/* Points adjustment */}
            <div className="space-y-3 pt-2 border-t border-white/20">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-widest pt-2">
                Adjust Points
              </p>
              <input
                value={adjustValue}
                onChange={(e) => setAdjustValue(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter amount"
                inputMode="numeric"
                className="w-full rounded-xl bg-black/40 border-2 border-white/60 px-5 py-3 text-lg outline-none focus:border-white/40"
              />
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => adjustPoints("add")}
                  disabled={adjustLoading}
                  className="rounded-xl border-2 border-green-400/60 bg-green-400/10 text-green-300 font-semibold py-3 hover:bg-green-400/20 disabled:opacity-60 transition-colors"
                >
                  + Add
                </button>
                <button
                  onClick={() => adjustPoints("subtract")}
                  disabled={adjustLoading}
                  className="rounded-xl border-2 border-red-400/60 bg-red-400/10 text-red-300 font-semibold py-3 hover:bg-red-400/20 disabled:opacity-60 transition-colors"
                >
                  − Subtract
                </button>
                <button
                  onClick={() => adjustPoints("set")}
                  disabled={adjustLoading}
                  className="rounded-xl border-2 border-blue-400/60 bg-blue-400/10 text-blue-300 font-semibold py-3 hover:bg-blue-400/20 disabled:opacity-60 transition-colors"
                >
                  = Set
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Redemption history */}
        {history.length > 0 && (
          <div className="rounded-xl border-2 border-white/60 bg-black/30 p-5">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4">
              Redemption History
            </p>
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm border-b border-white/10 pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <span className="font-semibold">{redeemLabel(item)}</span>
                    <span className="text-white/50 ml-2">
                      −{item.points_used} pt{item.points_used !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-white/40">{formatDate(item.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        <div className="rounded-xl border-2 border-white/60 bg-black/30 p-4 text-lg text-white/80 min-h-[56px]">
          {message || " "}
        </div>

      </div>
    </div>
  );
}
