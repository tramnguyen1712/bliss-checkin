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
    return diff >= -15 && diff <= 15;
  };
  if (windowOk(bThis)) return { ok: true, promoYear: checkYear };
  if (windowOk(bNext)) return { ok: true, promoYear: checkYear + 1 };
  return { ok: false };
}

export async function GET(req) {
  const headerPin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || headerPin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const phone = normalizePhone(searchParams.get("phone") || "");
  const nameQuery = (searchParams.get("name") || "").trim();

  if (!phone && !nameQuery) {
    return Response.json({ ok: false, message: "Provide phone or name." }, { status: 400 });
  }

  // Name search — returns a list
  if (nameQuery) {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, phone, points, dob_month, dob_day")
      .ilike("name", `%${nameQuery}%`)
      .order("name")
      .limit(20);

    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
    if (!data || data.length === 0) {
      return Response.json({ ok: false, message: "No customers found." }, { status: 404 });
    }
    return Response.json({ ok: true, customers: data });
  }

  // Phone search — single result
  if (phone.length < 10) {
    return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
  }

  const { data: customer, error } = await supabase
    .from("customers")
    .select("id, name, phone, points, dob_month, dob_day")
    .eq("phone", phone)
    .maybeSingle();

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 });
  if (!customer) return Response.json({ ok: false, message: "Customer not found." }, { status: 404 });

  const today = todayISODateNY();
  const birthdayWindow = isWithinBirthdayWindow(today, customer.dob_month, customer.dob_day);

  let birthdayRedeemed = false;
  if (birthdayWindow.ok) {
    const { data: redemp } = await supabase
      .from("redemptions")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("type", "birthday")
      .eq("promo_year", birthdayWindow.promoYear)
      .limit(1);
    birthdayRedeemed = !!(redemp && redemp.length > 0);
  }

  const { data: history } = await supabase
    .from("redemptions")
    .select("id, type, points_used, promo_year, created_at")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  return Response.json({
    ok: true,
    customer: {
      ...customer,
      birthdayEligible: birthdayWindow.ok && !birthdayRedeemed,
      birthdayPromoYear: birthdayWindow.ok ? birthdayWindow.promoYear : null,
      birthdayRedeemed,
    },
    history: history || [],
  });
}
