import { createClient } from "@supabase/supabase-js";
// Server-only: bypasses RLS. Never import from client components.
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
