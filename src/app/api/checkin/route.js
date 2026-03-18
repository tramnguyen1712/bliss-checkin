import { supabase } from "@/lib/supabaseServer";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

function parseDOB(dobStr) {
  // accepts "MM/DD", "M/D", or raw 4-digit "MMDD"
  const s = (dobStr || "").trim();
  let month, day;
  const slashMatch = s.match(/^(\d{1,2})\s*\/\s*(\d{1,2})$/);
  if (slashMatch) {
    month = Number(slashMatch[1]);
    day = Number(slashMatch[2]);
  } else {
    const digits = s.replace(/\D/g, "");
    if (digits.length === 4) {
      month = Number(digits.slice(0, 2));
      day = Number(digits.slice(2));
    } else if (digits.length === 3) {
      // e.g. "117" → month=1, day=17
      month = Number(digits.slice(0, 1));
      day = Number(digits.slice(1));
    } else {
      return null;
    }
  }
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) return null;
  return { month, day };
}

// NY date only (Cary)
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
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / ms);
}

/**
 * Birthday window: -5 days to +4 days around birthday.
 * Returns { ok: boolean, promoYear?: number }
 */
function isWithinBirthdayWindow(checkISO, dobMonth, dobDay) {
  if (!dobMonth || !dobDay) return { ok: false };

  const checkDate = parseISODate(checkISO);
  const checkYear = checkDate.getUTCFullYear();

  const bThis = new Date(Date.UTC(checkYear, dobMonth - 1, dobDay));
  const bNext = new Date(Date.UTC(checkYear + 1, dobMonth - 1, dobDay));

  const windowOk = (birthday) => {
    const diff = daysBetween(checkDate, birthday); // check - birthday
    return diff >= -5 && diff <= 4;
  };

  if (windowOk(bThis)) return { ok: true, promoYear: checkYear };
  if (windowOk(bNext)) return { ok: true, promoYear: checkYear + 1 };

  return { ok: false };
}

async function ensureBirthdayPromoView(customerId, promoYear) {
  const { error } = await supabase
    .from("promo_views")
    .insert({ customer_id: customerId, promo_type: "birthday", promo_year: promoYear });

  // 23505 unique violation => already shown, that's fine
  if (error && error.code !== "23505") return { ok: false, error };
  return { ok: true, inserted: !error };
}

export async function POST(req) {
  try {
    const body = await req.json();

    const phone = normalizePhone(body.phone);
    const name = (body.name || "").trim();
    const dob = parseDOB(body.dob); // {month, day} or null
    const checkin_date = todayISODateNY();

    if (!phone || phone.length < 10) {
      return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
    }

    // Find customer
    const { data: existing, error: findErr } = await supabase
      .from("customers")
      .select("id, name, points, dob_month, dob_day")
      .eq("phone", phone)
      .maybeSingle();

    if (findErr) return Response.json({ ok: false, message: findErr.message }, { status: 500 });

    // New customer: require name + dob
    if (!existing) {
      if (!name) {
        return Response.json({
          ok: true,
          needsName: true,
          needsDob: true,
          message: "First time here — please enter your full name and birthday (MM/DD).",
        });
      }
      if (!dob) {
        return Response.json({
          ok: true,
          needsDob: true,
          message: "Please enter your birthday (MM/DD) to finish signup.",
        });
      }

      const { data: created, error: createErr } = await supabase
        .from("customers")
        .insert({
          phone,
          name,
          points: 0,
          dob_month: dob.month,
          dob_day: dob.day,
        })
        .select("id, name, points, dob_month, dob_day")
        .single();

      if (createErr) return Response.json({ ok: false, message: createErr.message }, { status: 500 });

      return await doCheckinAndPromos(created, checkin_date);
    }

    // Existing customer missing DOB: ask on next check-in
    if (!existing.dob_month || !existing.dob_day) {
      if (!dob) {
        return Response.json({
          ok: true,
          needsDob: true,
          message: "To unlock birthday promotions, please enter your birthday (MM/DD).",
        });
      }

      const { error: updDobErr } = await supabase
        .from("customers")
        .update({ dob_month: dob.month, dob_day: dob.day })
        .eq("id", existing.id);

      if (updDobErr) return Response.json({ ok: false, message: updDobErr.message }, { status: 500 });

      existing.dob_month = dob.month;
      existing.dob_day = dob.day;
    }

    return await doCheckinAndPromos(existing, checkin_date);
  } catch {
    return Response.json({ ok: false, message: "Server error." }, { status: 500 });
  }
}

async function doCheckinAndPromos(customer, checkin_date) {
  // 1/day enforced by unique(customer_id, checkin_date)
  const { error: insErr } = await supabase
    .from("checkins")
    .insert({ customer_id: customer.id, checkin_date });

  if (insErr) {
    if (insErr.code === "23505") {
      const birthday = await maybeBirthdayMessage(customer, checkin_date);
      return Response.json({
        ok: true,
        alreadyCheckedIn: true,
        points: customer.points,
        name: customer.name,
        ...birthday,
        message: `✅ You already checked-in today. Your total point is ${customer.points}.`,
      });
    }
    return Response.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  // Add 1 point
  const newPoints = customer.points + 1;

  const { error: updErr } = await supabase
    .from("customers")
    .update({ points: newPoints })
    .eq("id", customer.id);

  if (updErr) return Response.json({ ok: false, message: updErr.message }, { status: 500 });

  const isMilestone = newPoints % 10 === 0;
  const milestoneMsg = isMilestone
    ? "🥳🎉 CONGRATULATIONS 🎊🥳, you get 10% OFF today, Please let the staff know!"
    : `✅ Checked in! Your total point is ${newPoints}.`;

  const birthday = await maybeBirthdayMessage(customer, checkin_date);

  return Response.json({
    ok: true,
    checkedIn: true,
    points: newPoints,
    name: customer.name,
    ...birthday,
    message: milestoneMsg,
  });
}

async function maybeBirthdayMessage(customer, checkin_date) {
  if (!customer.dob_month || !customer.dob_day) return {};

  const within = isWithinBirthdayWindow(checkin_date, customer.dob_month, customer.dob_day);
  if (!within.ok) return {};

  // If already redeemed birthday this promo year, don't show message
  const { data: redeemed } = await supabase
    .from("redemptions")
    .select("id")
    .eq("customer_id", customer.id)
    .eq("type", "birthday")
    .eq("promo_year", within.promoYear)
    .limit(1);

  if (redeemed && redeemed.length > 0) return {};

  // Show once per year (promo_views)
  const viewRes = await ensureBirthdayPromoView(customer.id, within.promoYear);
  if (!viewRes.ok) return {};

  if (viewRes.inserted) {
    return {
      birthdayMessage:
        "🥳🎉 HAPPY BIRTHDAY 🎊🥳! You get 20% OFF today. Please let the staff know.",
    };
  }

  return {};
}