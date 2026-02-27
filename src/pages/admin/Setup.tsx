import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function Setup() {
  return (
    <AdminLayout title="Department Setup" subtitle="Define shift types and Working Time Regulations">
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-4">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-card-foreground">Department Setup</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              Configure shift templates and WTR rules. This page will be built in the next iteration.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
