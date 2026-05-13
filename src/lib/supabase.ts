//import { createClient } from '@supabase/supabase-js'


//export const supabase = createClient(
  //process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
//)

//export const supabase = "hello"

//import { createClient } from '@supabase/supabase-js'

//const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
//const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

//export const supabase = createClient(supabaseUrl, supabaseKey)

import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)