import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "matteferro31@gmail.com";
  const password = "matteferro31";

  // Check if user already exists
  const { data: existing } = await supabaseAdmin.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === email);
  if (found) {
    return new Response(JSON.stringify({ message: "User already exists", id: found.id }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Matteo Ferrari" },
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ message: "User created", id: data.user.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
