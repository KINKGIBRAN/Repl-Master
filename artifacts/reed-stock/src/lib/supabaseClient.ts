import { createClient } from "@supabase/supabase-js";

// ─── Setup environment variable ────────────────────────────────────────────
// Di Replit: buka tab "Secrets" (ikon gembok di sidebar kiri), tambahkan:
//   VITE_SUPABASE_URL      → URL project Supabase (Dashboard → Settings → API)
//   VITE_SUPABASE_ANON_KEY → anon/public key (Dashboard → Settings → API)
//
// Vite otomatis expose env var yang diawali VITE_ lewat import.meta.env.
// Setelah menambah Secrets baru, restart dev server (klik Run lagi) supaya terbaca.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase env var belum diset. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di Replit Secrets, lalu restart dev server."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
