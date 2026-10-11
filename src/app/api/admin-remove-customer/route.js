import { supabase } from "@/lib/supabaseServer";

export async function POST(req) {
  const pin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, message: "Invalid request." }, { status: 400 });
  }

  const phone = String(body?.phone || "").replace(/\D/g, "");
  if (phone.length !== 10) {
    return Response.json({ ok: false, message: "Enter a valid 10-digit phone number." }, { status: 400 });
  }

  try {
    const { data: customer, error: findError } = await supabase
      .from("customers")
      .select("id, name, points")
      .eq("phone", phone)
      .maybeSingle();
    if (findError) throw findError;
    if (!customer) {
      return Response.json({ ok: false, message: "Customer not found." }, { status: 404 });
    }
    if (customer.points !== 0) {
      return Response.json({ ok: false, message: "Only accounts with 0 points can be removed. Existing rewards must be preserved." }, { status: 409 });
    }

    const [{ count: visits, error: visitsError }, { count: redemptions, error: redemptionError }] = await Promise.all([
      supabase.from("checkins").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
      supabase.from("redemptions").select("id", { count: "exact", head: true }).eq("customer_id", customer.id),
    ]);
    if (visitsError) throw visitsError;
    if (redemptionError) throw redemptionError;
    if ((visits ?? 0) > 1 || (redemptions ?? 0) > 0) {
      return Response.json({ ok: false, message: "This customer has prior visits or redemptions. Account removal is limited to first-time registrations without redemption history." }, { status: 409 });
    }

    // Foreign keys in the original schema cascade to checkins/redemptions.
    // Use an ID + balance condition to guard against simple stale-point changes.
    const { data: removed, error: deleteError } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id)
      .eq("points", 0)
      .select("id");
    if (deleteError) throw deleteError;
    if (!removed || removed.length !== 1) {
      return Response.json({ ok: false, message: "Account changed while removing it. Refresh and try again." }, { status: 409 });
    }
    return Response.json({ ok: true, message: "Account removed." });
  } catch (err) {
    console.error("Remove account error:", err.message);
    return Response.json({ ok: false, message: "Unable to remove account." }, { status: 500 });
  }
}
