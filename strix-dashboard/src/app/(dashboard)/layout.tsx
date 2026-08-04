import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
