import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export default function Register() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [hospital, setHospital] = useState("");
  const [department, setDepartment] = useState("");
  const [heardFrom, setHeardFrom] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "First name is required";
    if (!lastName.trim()) errs.lastName = "Last name is required";
    if (!email.trim()) errs.email = "Email is required";
    if (!phone.trim()) errs.phone = "Phone number is required";
    if (!jobTitle.trim()) errs.jobTitle = "Job title is required";
    if (!hospital.trim()) errs.hospital = "Hospital / Trust name is required";
    if (!department.trim()) errs.department = "Department name is required";
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const fullName = `${firstName.trim()} ${lastName.trim()}`;

    setLoading(true);
    try {
      const { data: reqData, error: dbError } = await (supabase
        .from('registration_requests' as any)
        .insert({
          full_name: fullName,
          email: email.trim(),
          phone: phone.trim(),
          job_title: jobTitle.trim(),
          hospital: hospital.trim(),
          department: department.trim(),
          heard_from: heardFrom.trim() || null,
          status: 'pending',
        })
        .select('approval_token')
        .single() as any);
      if (dbError) throw dbError;

      try {
        await Promise.race([
          supabase.functions.invoke("send-registration-request", {
            body: { fullName, email: email.trim(), phone: phone.trim(), jobTitle: jobTitle.trim(), hospital: hospital.trim(), department: department.trim(), heardFrom: heardFrom.trim(), approvalToken: reqData.approval_token },
          }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error("Email notification timed out")), 10000)
          ),
        ]);
      } catch (emailErr) {
        console.warn("Email notification failed (request still saved):", emailErr);
      }

      setSuccess(true);
    } catch (err: any) {
      console.error("Registration request failed:", err);
      setError("Something went wrong — please try again or email matteferro31@gmail.com");
    } finally {
      setLoading(false);
    }
  };

  const renderField = (id: string, label: string, value: string, setter: (v: string) => void, opts?: { placeholder?: string; type?: string }) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={opts?.type ?? "text"}
        placeholder={opts?.placeholder}
        value={value}
        onChange={(e) => { setter(e.target.value); setFieldErrors((p) => ({ ...p, [id]: "" })); }}
      />
      {fieldErrors[id] && <p className="text-xs text-destructive">{fieldErrors[id]}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-100 p-4">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card border border-border shadow-sm">
            <span className="text-2xl font-black tracking-tighter text-primary">RE</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">RotaGen</h1>
          <p className="text-sm text-muted-foreground">Fair NHS rotas in minutes, not hours</p>
        </div>

        <Card className="w-full shadow-xl">
          <CardContent className="p-6 pt-6">
            {success ? (
              <div className="text-center space-y-3 py-4">
                <h2 className="text-lg font-semibold text-card-foreground">Request received</h2>
                <p className="text-sm text-muted-foreground">
                  Thank you — your request has been received. We'll review your details and be in touch at <strong className="text-foreground">{email}</strong> shortly.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => navigate("/login")}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <>
                <h2 className="mb-5 text-center text-lg font-semibold text-card-foreground">Request access</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* First name / Last name side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    {renderField("firstName", "First name", firstName, setFirstName, { placeholder: "e.g. Jane" })}
                    {renderField("lastName", "Last name", lastName, setLastName, { placeholder: "e.g. Smith" })}
                  </div>

                  {renderField("email", "Email address", email, setEmail, { placeholder: "you@nhs.net", type: "email" })}
                  {renderField("phone", "Contact phone number", phone, setPhone, { placeholder: "07700 900000", type: "tel" })}
                  {renderField("jobTitle", "Job title", jobTitle, setJobTitle, { placeholder: "e.g. Rota Coordinator, Clinical Lead, Consultant Anaesthetist" })}
                  {renderField("hospital", "Hospital / Trust name", hospital, setHospital, { placeholder: "e.g. Royal Devon University Healthcare" })}
                  {renderField("department", "Department name", department, setDepartment, { placeholder: "e.g. Anaesthetics" })}

                  <div className="space-y-1.5">
                    <Label htmlFor="heardFrom">How did you hear about RotaGen? <span className="text-muted-foreground">(optional)</span></Label>
                    <Textarea
                      id="heardFrom"
                      placeholder="e.g. colleague recommendation, conference, social media"
                      value={heardFrom}
                      onChange={(e) => setHeardFrom(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Submitting…" : "Submit request"}
                  </Button>
                </form>

                {error && <p className="mt-3 text-xs text-destructive text-center">{error}</p>}

                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-xs text-primary hover:underline w-full text-center mt-4 block"
                >
                  Already have an account? Sign in
                </button>
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          RotaGen · NHS Rota Management · For authorised users only ·{" "}
          <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
