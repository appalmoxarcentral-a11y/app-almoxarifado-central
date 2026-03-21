import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_table_policies', { table_name: 'plans' });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Policies:');
  console.log(JSON.stringify(data, null, 2));
}

checkPolicies();
