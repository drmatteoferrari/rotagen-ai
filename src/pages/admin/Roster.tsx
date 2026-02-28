import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, UserPlus, Send, Users, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  grade: string;
  surveyStatus: "not_sent" | "pending" | "completed";
}

const initialDoctors: Doctor[] = [
  { id: "1", firstName: "Sarah", lastName: "Chen", email: "s.chen@nhs.net", grade: "ST5", surveyStatus: "completed" },
  { id: "2", firstName: "James", lastName: "Okafor", email: "j.okafor@nhs.net", grade: "ST3", surveyStatus: "pending" },
  { id: "3", firstName: "Emily", lastName: "Wright", email: "e.wright@nhs.net", grade: "CT2", surveyStatus: "not_sent" },
];

export default function Roster() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>(initialDoctors);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const addDoctor = () => {
    if (!firstName || !lastName || !email) return;
    const newDoctor: Doctor = {
      id: Date.now().toString(),
      firstName,
      lastName,
      email,
      grade: "—",
      surveyStatus: "not_sent",
    };
    setDoctors([...doctors, newDoctor]);
    setFirstName("");
    setLastName("");
    setEmail("");
    toast.success(`${firstName} ${lastName} added to the roster`);
  };

  const removeDoctor = (id: string) => {
    setDoctors(doctors.filter((d) => d.id !== id));
    toast("Doctor removed from roster");
  };

  const markPending = (id: string) => {
    setDoctors(doctors.map((d) => d.id === id ? { ...d, surveyStatus: "pending" as const } : d));
  };

  const copyMagicLink = (doctor: Doctor) => {
    const link = `${window.location.origin}/doctor/survey/1?token=${doctor.id}`;
    navigator.clipboard.writeText(link);
    markPending(doctor.id);
    toast.success("Magic link copied — status set to Pending");
  };

  const sendInvite = (doctor: Doctor) => {
    markPending(doctor.id);
    toast.success(`Survey invite sent to ${doctor.firstName} ${doctor.lastName}`);
  };

  const sendAllSurveys = () => {
    const unsent = doctors.filter((d) => d.surveyStatus === "not_sent");
    if (unsent.length === 0) return;
    setDoctors(doctors.map((d) => d.surveyStatus === "not_sent" ? { ...d, surveyStatus: "pending" as const } : d));
    toast.success(`Survey invites sent to ${unsent.length} doctor${unsent.length !== 1 ? "s" : ""}`);
  };

  const completed = doctors.filter((d) => d.surveyStatus === "completed").length;
  const pending = doctors.filter((d) => d.surveyStatus === "pending").length;

  const statusBadge = (status: Doctor["surveyStatus"]) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">✅ Completed</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">🟡 Pending</Badge>;
      case "not_sent":
        return <Badge className="bg-muted text-muted-foreground border-border hover:bg-muted">⚪ Not Sent</Badge>;
    }
  };

  return (
    <AdminLayout title="Roster & Invites" subtitle="Build the team and send survey invitations">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{doctors.length}</p>
                <p className="text-xs text-muted-foreground">Total Doctors</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Send className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                <UserPlus className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add doctor + table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Roster</CardTitle>
            <CardDescription>Add doctors to this rota period and track their survey progress.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick add row */}
            <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="flex-1">
                <Input placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="flex-[2]">
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button onClick={addDoctor} disabled={!firstName || !lastName || !email}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Add Doctor
              </Button>
            </div>

            {/* Table */}
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Survey Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctors.map((doctor) => (
                    <TableRow key={doctor.id}>
                      <TableCell className="font-medium">{doctor.firstName} {doctor.lastName}</TableCell>
                      <TableCell className="text-muted-foreground">{doctor.email}</TableCell>
                      <TableCell>{doctor.grade}</TableCell>
                      <TableCell>{statusBadge(doctor.surveyStatus)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendInvite(doctor)}
                            title="Send survey invite"
                            disabled={doctor.surveyStatus !== "not_sent"}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyMagicLink(doctor)}
                            title="Copy magic link"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/survey-override/${doctor.id}/1`)}
                            title="Admin override — edit survey"
                            disabled={doctor.surveyStatus !== "completed"}
                            className={doctor.surveyStatus === "completed" ? "text-amber-600 hover:text-amber-700" : ""}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeDoctor(doctor.id)}
                            className="text-muted-foreground hover:text-destructive"
                            title="Remove doctor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {doctors.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No doctors added yet. Use the form above to add team members.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Send surveys */}
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={sendAllSurveys}
                disabled={doctors.filter((d) => d.surveyStatus === "not_sent").length === 0}
              >
                <Send className="mr-2 h-4 w-4" /> Send All Invites
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
