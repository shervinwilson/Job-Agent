"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

function Login() {
  const error = useSearchParams().get("error");
  const signIn = () =>
    supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback` } });
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Job Agent</h1>
      <p className="text-sm text-ink/70">Sign in with the Google account set as the owner.</p>
      {error === "not_allowed" && <p role="alert" className="text-sm text-brick">That account isn’t the owner. Sign in with the account in ALLOWED_EMAIL.</p>}
      <button onClick={signIn} className="rounded bg-pine px-4 py-2 text-sm font-medium text-white hover:bg-pine/90">Sign in with Google</button>
    </main>
  );
}
export default function Page() { return <Suspense><Login /></Suspense>; }
