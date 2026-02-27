import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard } from "lucide-react";

export default function Dashboard() {
  return (
    <AdminLayout title="Generation Dashboard" subtitle="Track survey completions and generate the rota">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Generation Dashboard</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              View survey progress and generate the pre-rota. Coming in the next iteration.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
