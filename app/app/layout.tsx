import { AppShell } from "@/components/layout/app-shell";
import { reviewQueue } from "@/lib/mock-data";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell reviewCount={reviewQueue.length}>{children}</AppShell>;
}
