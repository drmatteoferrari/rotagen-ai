import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface BankHoliday {
  id: string;
  date: Date;
  name: string;
}

export default function RotaPeriodStep2() {
  const navigate = useNavigate();
  const [bankHolidays, setBankHolidays] = useState<BankHoliday[]>([
    { id: "1", date: new Date(2025, 3, 21), name: "Easter Monday" },
    { id: "2", date: new Date(2025, 4, 5), name: "Early May Bank Holiday" },
  ]);
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState<Date>();

  const addBankHoliday = () => {
    if (newHolidayDate && newHolidayName) {
      setBankHolidays([...bankHolidays, { id: Date.now().toString(), date: newHolidayDate, name: newHolidayName }]);
      setNewHolidayName("");
      setNewHolidayDate(undefined);
    }
  };

  const removeBankHoliday = (id: string) => {
    setBankHolidays(bankHolidays.filter((h) => h.id !== id));
  };

  return (
    <AdminLayout title="Rota Period" subtitle="Step 2 of 2 — Bank Holidays">
      <div className="mx-auto max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-amber-500" />
              Bank Holidays
            </CardTitle>
            <CardDescription>Add bank holidays that fall within the rota period.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Holiday Name</Label>
                <Input placeholder="e.g. Easter Monday" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full sm:w-[200px] justify-start text-left font-normal", !newHolidayDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newHolidayDate ? format(newHolidayDate, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newHolidayDate} onSelect={setNewHolidayDate} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <Button onClick={addBankHoliday} disabled={!newHolidayName || !newHolidayDate}>
                <Plus className="mr-1.5 h-4 w-4" />Add
              </Button>
            </div>

            {bankHolidays.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border">
                {bankHolidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{format(holiday.date, "EEEE, d MMMM yyyy")}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeBankHoliday(holiday.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-6">No bank holidays added yet.</p>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" size="lg" onClick={() => navigate("/admin/rota-period/step-1")}>
            <ArrowLeft className="mr-2 h-4 w-4" />Back
          </Button>
          <Button size="lg" onClick={() => navigate("/admin/dashboard")} className="bg-amber-500 hover:bg-amber-600">
            Save Rota Period
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
