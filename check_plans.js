import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function checkPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('price');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Plans from database:');
  console.log(JSON.stringify(data, null, 2));
}

checkPlans();
