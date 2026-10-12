import { supabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const pin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const params = new URL(req.url).searchParams;
  const id = params.get("customerId") || "";
  const page = Number(params.get("page") || "0");
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(page) || page < 0 || page > 10000) {
    return Response.json({ ok: false, message: "Invalid customer or page." }, { status: 400 });
  }

  const pageSize = 10;
  const { data, error, count } = await supabase
    .from("checkins")
    .select("id, checkin_date, created_at", { count: "exact" })
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    console.error("Customer check-in history lookup failed", error.code);
    return Response.json({ ok: false, message: "Unable to load check-in history." }, { status: 500 });
  }
  return Response.json({ ok: true, checkins: data || [], count: count || 0, page }, {
    headers: { "Cache-Control": "no-store" },
  });
}
