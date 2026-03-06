"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CheckinResultPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "Check-in successful.";
  const [secondsLeft, setSecondsLeft] = useState(8);

  useEffect(() => {
    const countdown = setInterval(() => {
      setSecondsLeft((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);

    const timer = setTimeout(() => {
      router.replace("/checkin");
    }, 8000);

    return () => {
      clearInterval(countdown);
      clearTimeout(timer);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border-2 border border-white/60 bg-white/5 p-8 shadow-xl text-center">
        <h1 className="text-3xl font-semibold">Bliss Nail Spa</h1>
        <p className="mt-4 text-2xl font-semibold">{message}</p>
        <p className="mt-6 text-base text-white/70">Returning to check-in in {secondsLeft}s...</p>
      </div>
    </div>
  );
}
