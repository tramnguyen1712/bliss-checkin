import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl rounded-2xl border-2 border border-white/60 bg-white/5 p-6 shadow-xl">
        <h1 className="text-3xl font-semibold">Bliss Check-in</h1>
        <p className="mt-2 text-white/70">Choose where you want to go.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link
            href="/checkin"
            className="rounded-2xl border-2 border border-white/60 bg-black/20 p-6 hover:bg-black/30 transition"
          >
            <div className="text-xl font-semibold">Customer Check-in</div>
            <div className="mt-2 text-sm text-white/70">
              Customers enter phone number to check in and earn points.
            </div>
            <div className="mt-6 inline-flex rounded-xl bg-white text-black font-semibold px-4 py-3">
              Open Check-in
            </div>
          </Link>

          <Link
            href="/admin"
            className="rounded-2xl border-2 border border-white/60 bg-black/20 p-6 hover:bg-black/30 transition"
          >
            <div className="text-xl font-semibold">Staff Admin</div>
            <div className="mt-2 text-sm text-white/70">
              Look up points and redeem 10% (requires staff PIN).
            </div>
            <div className="mt-6 inline-flex rounded-xl bg-white text-black font-semibold px-4 py-3">
              Open Admin
            </div>
          </Link>
        </div>

        <div className="mt-6 text-xs text-white/50">
          Tip: On the kiosk tablet, bookmark{" "}
          <span className="text-white/80">/checkin</span> and open it full screen.
        </div>
      </div>
    </div>
  );
}