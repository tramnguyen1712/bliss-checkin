export async function POST(req) {
  try {
    const body = await req.json();
    const pin = (body?.pin || "").trim();

    if (!process.env.ADMIN_PIN) {
      return Response.json({ ok: false, message: "ADMIN_PIN is not configured." }, { status: 500 });
    }

    if (!pin) {
      return Response.json({ ok: false, message: "Enter staff PIN." }, { status: 400 });
    }

    if (pin !== process.env.ADMIN_PIN) {
      return Response.json({ ok: false, message: "Wrong staff PIN." }, { status: 401 });
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, message: "Server error." }, { status: 500 });
  }
}