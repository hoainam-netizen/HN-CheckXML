import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://udttexvcykxkfabxdptn.supabase.co';
const supabaseKey = 'sb_publishable_5cBPw8ymSPJYCjscnWPBIw_5U6ml9Wl';

export const supabase = createClient(supabaseUrl, supabaseKey);
