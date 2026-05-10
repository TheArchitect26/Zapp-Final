import 'dotenv/config'
import { supabaseAdmin } from "./lib/supabaseAdmin.ts"

async function test() {
  const { data, error } = await supabaseAdmin.rpc("process_transfer", {
    sender: "11111111-1111-1111-1111-111111111111",
    receiver: "22222222-2222-2222-2222-222222222222",
    amount: 10
  })

  console.log(data, error)
}

test()