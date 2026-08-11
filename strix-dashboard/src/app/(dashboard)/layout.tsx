import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { getSession } from "@/lib/session";
import PendingLockScreen from "@/components/PendingLockScreen";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSession();
  
  if (session?.status === "PENDING" || session?.status === "REJECTED") {
    return <PendingLockScreen />;
  }

  return (
    <div className="app">
      <Sidebar />
      <div className="main-area">
        <Header />
        <div className="page-scroll">
          {children}
        </div>
      </div>
    </div>
  );
}
