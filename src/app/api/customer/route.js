import { supabase } from "@/lib/supabaseServer";

function normalizePhone(input) {
  return (input || "").replace(/\D/g, "");
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const phone = normalizePhone(searchParams.get("phone"));

  if (!phone || phone.length < 10) {
    return Response.json({ ok: false, message: "Invalid phone number." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("customers")
    .select("name, phone, points")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    return Response.json({ ok: false, message: error.message }, { status: 500 });
  }
  if (!data) {
    return Response.json({ ok: false, message: "Customer not found." }, { status: 404 });
  }

  return Response.json({ ok: true, customer: data });
}