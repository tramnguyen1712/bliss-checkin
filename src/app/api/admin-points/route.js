import { supabase } from "@/lib/supabaseServer";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

export async function POST(req) {
  const headerPin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || headerPin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await req.json();
  const phone = normalizePhone(body.phone);
  const action = body.action; // 'set' | 'add' | 'subtract'
  const value = Number(body.value);

  if (!phone || phone.length < 10) {
    return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
  }
  if (!["set", "add", "subtract"].includes(action)) {
    return Response.json({ ok: false, message: "Invalid action. Use set, add, or subtract." }, { status: 400 });
  }
  if (!Number.isInteger(value) || value < 0) {
    return Response.json({ ok: false, message: "Value must be a non-negative integer." }, { status: 400 });
  }

  const { data: customer, error: findErr } = await supabase
    .from("customers")
    .select("id, points")
    .eq("phone", phone)
    .maybeSingle();

  if (findErr) return Response.json({ ok: false, message: findErr.message }, { status: 500 });
  if (!customer) return Response.json({ ok: false, message: "Customer not found." }, { status: 404 });

  let newPoints;
  if (action === "set") newPoints = value;
  else if (action === "add") newPoints = customer.points + value;
  else newPoints = Math.max(0, customer.points - value);

  const { error: updErr } = await supabase
    .from("customers")
    .update({ points: newPoints })
    .eq("id", customer.id);

  if (updErr) return Response.json({ ok: false, message: updErr.message }, { status: 500 });

  return Response.json({
    ok: true,
    points: newPoints,
    message: `✅ Points updated to ${newPoints}.`,
  });
}
