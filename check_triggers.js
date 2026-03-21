import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('get_table_triggers', { table_name: 'plans' });
  
  if (error) {
    // If RPC doesn't exist, try to read from pg_trigger via raw SQL if possible
    console.error('Error or RPC missing:', error);
    return;
  }
  
  console.log('Triggers:');
  console.log(JSON.stringify(data, null, 2));
}

checkTriggers();
