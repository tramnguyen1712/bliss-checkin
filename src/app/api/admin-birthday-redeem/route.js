import { supabase } from "@/lib/supabaseServer";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

function todayISODateNY() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function daysBetween(a, b) {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function isWithinBirthdayWindow(checkISO, dobMonth, dobDay) {
  if (!dobMonth || !dobDay) return { ok: false };
  const checkDate = parseISODate(checkISO);
  const checkYear = checkDate.getUTCFullYear();
  const bThis = new Date(Date.UTC(checkYear, dobMonth - 1, dobDay));
  const bNext = new Date(Date.UTC(checkYear + 1, dobMonth - 1, dobDay));
  const windowOk = (birthday) => {
    const diff = daysBetween(checkDate, birthday);
    return diff >= -5 && diff <= 4;
  };
  if (windowOk(bThis)) return { ok: true, promoYear: checkYear };
  if (windowOk(bNext)) return { ok: true, promoYear: checkYear + 1 };
  return { ok: false };
}

export async function POST(req) {
  const headerPin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || headerPin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();
  const phone = normalizePhone(body.phone);

  if (!phone || phone.length < 10) {
    return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
  }

  const { data: customer, error: findErr } = await supabase
    .from("customers")
    .select("id, name, points, dob_month, dob_day")
    .eq("phone", phone)
    .maybeSingle();

  if (findErr) return Response.json({ ok: false, message: findErr.message }, { status: 500 });
  if (!customer) return Response.json({ ok: false, message: "Customer not found." }, { status: 404 });

  const today = todayISODateNY();
  const window = isWithinBirthdayWindow(today, customer.dob_month, customer.dob_day);

  if (!window.ok) {
    return Response.json(
      { ok: false, message: "Customer is not within their birthday promo window." },
      { status: 400 }
    );
  }

  // Check if already redeemed this promo year
  const { data: existing } = await supabase
    .from("redemptions")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("type", "birthday")
    .eq("promo_year", window.promoYear)
    .limit(1);

  if (existing && existing.length > 0) {
    return Response.json(
      { ok: false, message: "Birthday promo already redeemed for this year." },
      { status: 400 }
    );
  }

  const newPoints = Math.max(0, customer.points - 1);

  const { error: updErr } = await supabase
    .from("customers")
    .update({ points: newPoints })
    .eq("id", customer.id);

  if (updErr) return Response.json({ ok: false, message: updErr.message }, { status: 500 });

  const { error: logErr } = await supabase.from("redemptions").insert({
    customer_id: customer.id,
    type: "birthday",
    promo_year: window.promoYear,
    points_used: 1,
  });

  if (logErr) {
    return Response.json({
      ok: true,
      points: newPoints,
      message: `🎂 Birthday 20% OFF redeemed for ${customer.name}! New points: ${newPoints}. (Log warning: ${logErr.message})`,
    });
  }

  return Response.json({
    ok: true,
    points: newPoints,
    message: `🎂 Birthday 20% OFF redeemed for ${customer.name}! New points: ${newPoints}.`,
  });
}
