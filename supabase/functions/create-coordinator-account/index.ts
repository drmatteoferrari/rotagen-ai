import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://rotagen.co.uk",
  "https://rotagen-ai.lovable.app",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { email, password, fullName, username, hospitalName, departmentName } = await req.json();

    if (!email || !password || !fullName || !username) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user already exists BEFORE attempting creation.
    // This handles re-approval of a failed previous attempt cleanly
    // without relying on fragile error string matching.
    let userId: string | null = null;

    const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
      page: 1,
    });

    const existingUser = (allUsers ?? []).find((u) => u.email === email);

    if (existingUser) {
      // User exists — update their password and metadata so the
      // credentials in the welcome email always match what's in Auth
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password,
        user_metadata: {
          full_name: fullName,
          username,
          must_change_password: true,
        },
      });
      userId = existingUser.id;
    } else {
      // User does not exist — create them fresh
      const { data: newUser, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            username,
            must_change_password: true,
          },
        });

      if (createError || !newUser?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: createError?.message ?? "Failed to create user",
          }),
          { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
        );
      }
      userId = newUser.user.id;
    }

    // Ensure account_settings row exists for this coordinator
    await supabaseAdmin
      .from("account_settings")
      .upsert(
        {
          owned_by: userId,
          department_name: departmentName ?? null,
          trust_name: hospitalName ?? null,
        },
        { onConflict: "owned_by" }
      );

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message ?? "Unknown error" }),
      { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
