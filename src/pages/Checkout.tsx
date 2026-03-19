import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loadingType, setLoadingType] = useState<string | null>(null);

  const success = searchParams.get("success") === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  const handleCheckout = async (priceType: "pay_per_rota" | "monthly") => {
    setLoadingType(priceType);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          priceType,
          successUrl: `${window.location.origin}/checkout?success=true`,
          cancelUrl: `${window.location.origin}/checkout?cancelled=true`,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast.error("Could not start checkout — please try again.");
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="min-h-screen bg-blue-100 py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center">
              <span className="text-primary text-xs font-black tracking-tighter">RE</span>
            </div>
            <span className="text-base font-bold text-foreground">RotaGen</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight mb-2">Choose your plan</h1>
          <p className="text-muted-foreground text-sm">Dev-only pricing page — not linked from public site.</p>
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
              <p className="text-3xl font-extrabold text-foreground">£250</p>
              <Button
                className="w-full"
                disabled={loadingType !== null}
                onClick={() => handleCheckout("pay_per_rota")}
              >
                {loadingType === "pay_per_rota" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : "Buy Now"}
              </Button>
            </CardContent>
          </Card>

          {/* Monthly */}
          <Card className="border-2 border-primary/30 shadow-xl bg-card">
            <CardHeader>
              <CardTitle className="text-lg">Monthly Unlimited</CardTitle>
              <CardDescription className="text-sm">Unlimited rota generations. Cancel anytime.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-extrabold text-foreground">£50<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
              <Button
                className="w-full"
                disabled={loadingType !== null}
                onClick={() => handleCheckout("monthly")}
              >
                {loadingType === "monthly" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</> : "Subscribe"}
              </Button>
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
