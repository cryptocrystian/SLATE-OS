import { AppShell } from "@/components/layout/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { reviewQueue } from "@/lib/mock-data";
import { getOperatorIdentity } from "@/lib/auth/identity";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getOperatorIdentity();
  return (
    <AppShell reviewCount={reviewQueue.length} identity={identity}>
      <ToastProvider>{children}</ToastProvider>
    </AppShell>
  );
}
