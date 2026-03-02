import { supabase } from "@/lib/supabaseServer";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

function todayISODate() {
  // Server local date (fine for now). Later we can force America/New_York if needed.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
}

export async function POST(req) {
  try {
    const body = await req.json();
    const phone = normalizePhone(body.phone);
    const name = (body.name || "").trim();
    const checkin_date = todayISODate();

    if (!phone || phone.length < 10) {
      return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
    }

    // 1) Find existing customer by phone
    const { data: existing, error: findErr } = await supabase
      .from("customers")
      .select("id, name, points")
      .eq("phone", phone)
      .maybeSingle();

    if (findErr) {
      return Response.json({ ok: false, message: findErr.message }, { status: 500 });
    }

    // 2) If customer doesn't exist, require name to create them
    if (!existing) {
      if (!name) {
        return Response.json({
          ok: true,
          needsName: true,
          message: "First time here — please enter your name to sign up."
        });
      }

      const { data: created, error: createErr } = await supabase
        .from("customers")
        .insert({ phone, name, points: 0 })
        .select("id, name, points")
        .single();

      if (createErr) {
        return Response.json({ ok: false, message: createErr.message }, { status: 500 });
      }

      // Now treat as existing for check-in
      return await doCheckin(created.id, created.points, created.name, checkin_date);
    }

    // 3) Existing customer: check-in
    return await doCheckin(existing.id, existing.points, existing.name, checkin_date);

  } catch (e) {
    return Response.json({ ok: false, message: "Server error." }, { status: 500 });
  }
}

async function doCheckin(customer_id, currentPoints, customerName, checkin_date) {
  // Try to insert today's check-in. Unique constraint blocks second check-in.
  const { error: insErr } = await supabase
    .from("checkins")
    .insert({ customer_id, checkin_date });

  if (insErr) {
    // 23505 = unique violation in Postgres
    if (insErr.code === "23505") {
      return Response.json({
        ok: true,
        alreadyCheckedIn: true,
        points: currentPoints,
        name: customerName,
        message: `You already checked-in today. Your total point is ${currentPoints}.`
      });
    }

    return Response.json({ ok: false, message: insErr.message }, { status: 500 });
  }

  // If insert succeeded, add 1 point
  const newPoints = currentPoints + 1;

  const { error: updErr } = await supabase
    .from("customers")
    .update({ points: newPoints })
    .eq("id", customer_id);

  if (updErr) {
    return Response.json({ ok: false, message: updErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    checkedIn: true,
    points: newPoints,
    name: customerName,
    message: `✅ Checked in! Your total point is ${newPoints}.`
  });
}