import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_PROJECT_URL;
const supabaseKey = import.meta.env.SUPABASE_SECRET_KEY;


export const supabase = createClient(supabaseUrl, supabaseKey);