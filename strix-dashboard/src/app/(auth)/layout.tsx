export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "var(--bg)", color: "var(--fg)", overflow: "hidden" }}>
      {/* Animated background blobs */}
      <div style={{
        position: "absolute",
        width: "50vw",
        height: "50vw",
        background: "radial-gradient(circle, rgba(74,222,128,0.15) 0%, rgba(0,0,0,0) 70%)",
        top: "-10%",
        left: "-10%",
        animation: "blob-float 12s infinite alternate",
        zIndex: 0
      }} />
      <div style={{
        position: "absolute",
        width: "60vw",
        height: "60vw",
        background: "radial-gradient(circle, rgba(255,124,31,0.1) 0%, rgba(0,0,0,0) 70%)",
        bottom: "-20%",
        right: "-10%",
        animation: "blob-float 15s infinite alternate-reverse",
        zIndex: 0
      }} />
      
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center", padding: 24 }}>
        {children}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blob-float {
          0% { transform: scale(1) translate(0, 0); }
          100% { transform: scale(1.1) translate(30px, 30px); }
        }
      `}} />
    </div>
  );
}
