"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ResultClient({ message }) {
  const router = useRouter();
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

  const parts = message.split("\n\n");
  const mainMessage = parts[0] || "";
  const birthdayMessage = parts[1] || "";

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl border-2 border-white/60 bg-white/5 p-8 shadow-xl text-center">
        <h1 className="text-3xl font-semibold">Bliss Nail Spa</h1>
        <p className="mt-4 text-2xl font-semibold">{mainMessage}</p>
        {birthdayMessage && (
          <div className="mt-6 rounded-xl border-2 border-yellow-400/70 bg-yellow-400/10 p-5">
            <p className="text-2xl font-bold text-yellow-300">{birthdayMessage}</p>
          </div>
        )}
        <p className="mt-6 text-base text-white/70">Returning to check-in in {secondsLeft}s...</p>
      </div>
    </div>
  );
}
