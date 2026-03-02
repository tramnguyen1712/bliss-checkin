import { supabase } from "@/lib/supabaseServer";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}


export async function POST(req) {

  const headerPin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || headerPin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized (wrong staff PIN)." }, { status: 401 });
  }

  const body = await req.json();
  const phone = normalizePhone(body.phone);

  if (!phone || phone.length < 10) {
    return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
  }

  // Find customer
  const { data: customer, error: findErr } = await supabase
    .from("customers")
    .select("id, name, points")
    .eq("phone", phone)
    .maybeSingle();

  if (findErr) return Response.json({ ok: false, message: findErr.message }, { status: 500 });
  if (!customer) return Response.json({ ok: false, message: "Customer not found." }, { status: 404 });

  if (customer.points < 10) {
    return Response.json({
      ok: false,
      message: `Not enough points to redeem. Current points: ${customer.points}.`
    }, { status: 400 });
  }

  const newPoints = customer.points - 10;

  // Update points
  const { error: updErr } = await supabase
    .from("customers")
    .update({ points: newPoints })
    .eq("id", customer.id);

  if (updErr) return Response.json({ ok: false, message: updErr.message }, { status: 500 });

  // Log redemption
  const { error: logErr } = await supabase
    .from("redemptions")
    .insert({ customer_id: customer.id, points_used: 10 });

  if (logErr) {
    // points updated already; still return success but mention logging issue
    return Response.json({
      ok: true,
      points: newPoints,
      message: `Redeemed 10 points. New total: ${newPoints}. (Log warning: ${logErr.message})`
    });
  }

  return Response.json({
    ok: true,
    points: newPoints,
    message: `✅ Redeemed 10 points for 10% off. New total: ${newPoints}.`
  });
}