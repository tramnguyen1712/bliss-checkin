import { supabase } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

function todayNY() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function GET(req) {
  const pin = req.headers.get("x-admin-pin") || "";
  if (!process.env.ADMIN_PIN || pin !== process.env.ADMIN_PIN) {
    return Response.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const date = new URL(req.url).searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ ok: false, message: "Invalid date." }, { status: 400 });
  }
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > todayNY()) {
    return Response.json({ ok: false, message: "Invalid date." }, { status: 400 });
  }

  try {
    // Fetch in batches so busy days are not silently truncated at Supabase's default row limit.
    const allCheckins = [];
    const batchSize = 500;
    for (let offset = 0; ; offset += batchSize) {
      const { data, error } = await supabase
        .from("checkins")
        .select("id, customer_id, checkin_date, created_at")
        .eq("checkin_date", date)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      allCheckins.push(...(data || []));
      if (!data || data.length < batchSize) break;
    }

    if (allCheckins.length === 0) {
      return Response.json({ ok: true, checkins: [] });
    }

    const customerIds = [...new Set(allCheckins.map((r) => r.customer_id))];
    const customers = [];
    for (let offset = 0; offset < customerIds.length; offset += 200) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, points")
        .in("id", customerIds.slice(offset, offset + 200));
      if (error) throw error;
      customers.push(...(data || []));
    }
    const byId = new Map(customers.map((c) => [String(c.id), c]));
    const checkins = allCheckins.map((r) => {
      const c = byId.get(String(r.customer_id));
      return {
        checkin_id: r.id,
        created_at: r.created_at,
        name: c?.name || "Customer unavailable",
        phone: c?.phone || "",
        points: c?.points ?? 0,
      };
    });
    return Response.json({ ok: true, checkins }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Daily check-in history error:", err.message);
    return Response.json({ ok: false, message: "Unable to load check-in history." }, { status: 500 });
  }
}
