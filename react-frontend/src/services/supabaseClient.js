import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://gtygegvjefdvyjfryrgf.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0eWdlZ3ZqZWZkdnlqZnJ5cmdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MDE1OTcsImV4cCI6MjA4ODI3NzU5N30.W0xqVrfFaenmOo35BgN2jtWXvhOaZ3YDgaC2pRHWxBE'

export const supabase = createClient(supabaseUrl, supabaseKey)
