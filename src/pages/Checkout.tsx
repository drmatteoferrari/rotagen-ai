import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, AlertCircle } from "lucide-react";
import PublicTopBar from "@/components/PublicTopBar";

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const success = searchParams.get("success") === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  return (
    <div className="min-h-screen bg-blue-100">
      <PublicTopBar />
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">Choose your plan</h1>
          <p className="text-muted-foreground text-sm">Simple, transparent pricing for NHS anaesthetic departments.</p>
        </div>

        {/* Banners */}
        {success && (
          <div className="mb-6 rounded-lg border border-green-300 bg-green-50 p-4 text-center text-sm font-medium text-green-800 flex items-center justify-center gap-2">
            <Check className="h-4 w-4" /> Payment successful — your account has been updated.
          </div>
        )}
        {cancelled && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-center text-sm font-medium text-amber-800 flex items-center justify-center gap-2">
            <AlertCircle className="h-4 w-4" /> Checkout cancelled — no payment was taken.
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <Card className="border border-border shadow-xl bg-card relative">
            <Badge className="absolute top-4 right-4 bg-green-100 text-green-700 border-green-300 text-[10px] font-bold">Current offer</Badge>
            <CardHeader>
              <CardTitle className="text-lg">Free Access</CardTitle>
              <CardDescription className="text-sm">Early access for founding departments — full product, no payment required</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-extrabold text-foreground">£0</p>
              <Button className="w-full" variant="outline" onClick={() => navigate("/register")}>
                Request Access
              </Button>
            </CardContent>
          </Card>

          {/* Pay Per Rota */}
          <Card className="border border-border shadow-xl bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Pay Per Rota</CardTitle>
              <CardDescription className="text-sm">One rota generation plus one regeneration. No subscription.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-sm font-normal">Pricing coming soon</Badge>
              <Button className="w-full" disabled>Coming Soon</Button>
            </CardContent>
          </Card>

          {/* Monthly */}
          <Card className="border-2 border-primary/30 shadow-xl bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Monthly Unlimited</CardTitle>
              <CardDescription className="text-sm">Unlimited rota generations. Cancel anytime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-sm font-normal">Pricing coming soon</Badge>
              <Button className="w-full" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          <button onClick={() => navigate("/")} className="text-primary hover:underline">← Back to home</button>
        </p>
      </div>
    </div>
  );
}