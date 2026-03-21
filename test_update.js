import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function updatePlan() {
  const { data, error } = await supabase
    .from('plans')
    .update({
      price: 999,
      max_users: 888 // different from 999 to see if it updates
    })
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .select();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Update result:');
  console.log(JSON.stringify(data, null, 2));
}

updatePlan();
