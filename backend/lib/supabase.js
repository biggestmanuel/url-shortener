import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Uses the SERVICE ROLE key, not the anon key — this server is the only
// thing that should ever write to the links table, so there's no need
// to expose a public key or set up RLS policies for browser access.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export const supabase = createClient(supabaseUrl, supabaseServiceKey);
