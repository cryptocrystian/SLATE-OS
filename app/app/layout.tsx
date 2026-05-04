import { AppShell } from "@/components/layout/app-shell";
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
      {children}
    </AppShell>
  );
}
