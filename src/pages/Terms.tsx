import { useNavigate } from "react-router-dom";
import PublicTopBar from "@/components/PublicTopBar";

export default function Terms() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-blue-100 text-foreground">
      <PublicTopBar
        menuItems={[
          { label: "Privacy Policy", onClick: () => navigate("/privacy") },
        ]}
      />

      <main className="px-4 pb-12 pt-10 sm:px-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-8 shadow-xl animate-in slide-in-from-bottom-4 fade-in duration-500">
          <h1 className="text-2xl font-bold">RotaGen — Terms of Use</h1>
          <p className="mt-1 text-sm text-muted-foreground">Last updated: March 2026</p>

          <h2 className="mt-8 text-lg font-semibold">Acceptance of terms</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            By accessing or using RotaGen, you agree to these terms. If you do not agree, do not use the service.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Who can use RotaGen</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            RotaGen is intended for use by authorised NHS staff only. Access is granted by invitation during the early access period. Coordinators must not share their credentials.
          </p>

          <h2 className="mt-8 text-lg font-semibold">What RotaGen does</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            RotaGen generates rota schedules for NHS anaesthetic departments based on inputs provided by coordinators and doctors. The output is provided as a planning aid. Clinical and managerial responsibility for the published rota remains with the coordinator and department.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Data you provide</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            By submitting data through RotaGen (including doctor preferences, leave dates, and department configuration), you confirm you have appropriate authority to do so and that the data is accurate to the best of your knowledge.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Acceptable use</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            You must not attempt to circumvent access controls, submit false data, or use RotaGen for any purpose other than NHS rota scheduling. Misuse may result in immediate access removal.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Availability</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            During the early access period, RotaGen is provided without uptime guarantees. We will aim to notify users of planned downtime in advance.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Limitation of liability</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            RotaGen is provided in good faith as a scheduling aid. The platform owner accepts no liability for rota decisions made on the basis of its output. Coordinators remain responsible for validating the final rota before publication.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Changes to these terms</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We may update these terms. Continued use after notification of changes constitutes acceptance.
          </p>

          <h2 className="mt-8 text-lg font-semibold">Contact</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            For any questions about these terms, email <a href="mailto:hello@rotagen.co.uk" className="text-primary hover:underline">hello@rotagen.co.uk</a>.
          </p>
        </div>
      </main>

      <footer className="border-t border-border bg-white px-6 py-6 text-center">
        <p className="text-sm text-muted-foreground">RotaGen · NHS Rota Management · For authorised users only</p>
      </footer>
    </div>
  );
}
