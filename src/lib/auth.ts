import { supabaseServer } from "@/lib/supabase/server";
export async function isOwner() {
  const { data } = await supabaseServer().rpc("is_owner");
  return data === true;
}
