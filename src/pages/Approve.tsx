import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type PageState = "loading" | "invalid" | "already_approved" | "confirm" | "processing" | "success" | "error";

interface RegistrationRequest {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  hospital: string | null;
  department: string | null;
  status: string;
}

export default function Approve() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [request, setRequest] = useState<RegistrationRequest | null>(null);
  const [createdUsername, setCreatedUsername] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) { setPageState("invalid"); return; }

    (supabase
      .from("registration_requests" as any)
      .select("*")
      .eq("approval_token", token)
      .maybeSingle() as any
    ).then(({ data, error }: any) => {
      if (error || !data) { setPageState("invalid"); return; }
      if (data.status !== "pending") { setPageState("already_approved"); return; }
      setRequest(data);
      setPageState("confirm");
    });
  }, [token]);

  const handleApprove = async () => {
    if (!request || !token) return;
    setPageState("processing");

    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-10) + "A1!";

      // Generate username from full_name
      const nameParts = request.full_name.trim().split(" ");
      const first = nameParts[0] ?? "user";
      const last = nameParts.slice(1).join("") || "user";
      const baseUsername = `${first[0].toLowerCase()}.${last.toLowerCase()}`;

      // Check for existing usernames to avoid collisions
      const { data: existingUsers } = await (supabase
        .from("coordinator_accounts" as any)
        .select("username") as any);
      const taken = new Set((existingUsers ?? []).map((u: any) => u.username));

      let username = baseUsername;
      let counter = 2;
      while (taken.has(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }

      // Mark request as approved FIRST (before any auth calls)
      await (supabase
        .from("registration_requests" as any)
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("approval_token", token) as any);

      // Insert coordinator_accounts row (non-blocking)
      try {
      await (supabase
          .from("coordinator_accounts" as any)
          .upsert({
            username: username,
            email: request.email,
            display_name: request.full_name,
            password: tempPassword,
            status: "active",
            must_change_password: true,
          }, { onConflict: "username" }) as any);
      } catch (insertErr) {
        console.warn("coordinator_accounts insert failed (non-blocking):", insertErr);
      }

      // Create auth user via Edge Function (blocking)
      const { data: fnData, error: fnError } = await supabase.functions.invoke("create-coordinator-account", {
        body: {
          email: request.email,
          password: tempPassword,
          fullName: request.full_name,
          username: username,
        },
      });
      if (fnError || !fnData?.success) {
        throw new Error(fnData?.error ?? fnError?.message ?? "Failed to create auth account");
      }

      // Send admin an email with the new user's credentials
      try {
        await supabase.functions.invoke("send-welcome-email", {
          body: {
            to: "matteferro31@gmail.com",
            fullName: request.full_name,
            username: username,
            email: request.email,
            tempPassword,
            hospital: request.hospital,
            department: request.department,
            jobTitle: request.job_title,
          },
        });
      } catch (emailErr) {
        console.warn("Welcome email failed (account still created):", emailErr);
      }

      setCreatedUsername(username);
      setPageState("success");
    } catch (err: any) {
      console.error("Approval failed:", err);
      setErrorMsg(err?.message ?? "Unknown error");
      setPageState("error");
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case "loading":
      case "processing":
        return (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {pageState === "loading" ? "Verifying approval token…" : "Activating account…"}
            </p>
          </div>
        );
      case "invalid":
        return (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-card-foreground">Invalid Link</h2>
            <p className="text-sm text-muted-foreground">This approval link is invalid or has expired.</p>
            <Button variant="outline" className="mt-2" onClick={() => navigate("/login")}>Back to sign in</Button>
          </div>
        );
      case "already_approved":
        return (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <h2 className="text-lg font-semibold text-card-foreground">Already Processed</h2>
            <p className="text-sm text-muted-foreground">This account has already been activated.</p>
            <Button variant="outline" className="mt-2" onClick={() => navigate("/login")}>Back to sign in</Button>
          </div>
        );
      case "confirm":
        return (
          <div className="space-y-4">
            <h2 className="text-center text-lg font-semibold text-card-foreground">Approve Access Request</h2>
            <p className="text-sm text-muted-foreground text-center">Review the details below and confirm to activate this account.</p>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
              <div><span className="font-medium">Name:</span> {request?.full_name}</div>
              <div><span className="font-medium">Email:</span> {request?.email}</div>
              {request?.hospital && <div><span className="font-medium">Hospital:</span> {request.hospital}</div>}
              {request?.department && <div><span className="font-medium">Department:</span> {request.department}</div>}
              {request?.job_title && <div><span className="font-medium">Job title:</span> {request.job_title}</div>}
            </div>
            <Button className="w-full" onClick={handleApprove}>Confirm and activate account</Button>
            <button type="button" onClick={() => navigate("/login")} className="text-xs text-primary hover:underline w-full text-center block">Cancel</button>
          </div>
        );
      case "success":
        return (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <h2 className="text-lg font-semibold text-card-foreground">Account Activated</h2>
            <p className="text-sm text-muted-foreground">
              Account created for <strong className="text-foreground">{request?.full_name}</strong> (username: <strong className="text-foreground">{createdUsername}</strong>).
              You have been emailed their login credentials.
            </p>
            <Button variant="outline" className="mt-2" onClick={() => navigate("/login")}>Back to sign in</Button>
          </div>
        );
      case "error":
        return (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold text-card-foreground">Something Went Wrong</h2>
            <p className="text-sm text-muted-foreground">{errorMsg || "Please try again."}</p>
            <Button variant="outline" className="mt-2" onClick={() => setPageState("confirm")}>Try again</Button>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border shadow-sm">
            <span className="text-2xl font-black tracking-tighter text-primary">RE</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">RotaGen</h1>
          <p className="text-sm text-muted-foreground">Account Approval</p>
        </div>
        <Card className="w-full shadow-xl">
          <CardContent className="p-6 pt-6">{renderContent()}</CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">RotaGen · NHS Rota Management · For authorised users only</p>
      </div>
    </div>
  );
}
