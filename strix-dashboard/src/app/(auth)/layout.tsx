export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", backgroundColor: "#0a0a0a", color: "var(--fg)", overflow: "hidden" }}>
      {/* Moving Grid Background */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        backgroundPosition: "center center",
        zIndex: 0,
        opacity: 0.5,
        animation: "grid-move 20s linear infinite"
      }} />

      {/* Animated background blobs */}
      <div style={{
        position: "absolute",
        width: "70vw",
        height: "70vw",
        background: "radial-gradient(circle, rgba(255,30,30,0.12) 0%, rgba(0,0,0,0) 70%)",
        top: "-20%",
        left: "-20%",
        animation: "blob-orbit-1 25s linear infinite",
        zIndex: 0
      }} />
      <div style={{
        position: "absolute",
        width: "80vw",
        height: "80vw",
        background: "radial-gradient(circle, rgba(220,20,60,0.08) 0%, rgba(0,0,0,0) 70%)",
        bottom: "-30%",
        right: "-20%",
        animation: "blob-orbit-2 30s linear infinite reverse",
        zIndex: 0
      }} />
      
      <div style={{ position: "relative", zIndex: 1, width: "100%", display: "flex", justifyContent: "center", padding: 24, perspective: "1000px" }}>
        {children}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blob-orbit-1 {
          0% { transform: rotate(0deg) translateX(50px) rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) translateX(100px) rotate(-180deg) scale(1.2); }
          100% { transform: rotate(360deg) translateX(50px) rotate(-360deg) scale(1); }
        }
        @keyframes blob-orbit-2 {
          0% { transform: rotate(0deg) translateY(40px) rotate(0deg) scale(1.1); }
          50% { transform: rotate(180deg) translateY(80px) rotate(-180deg) scale(0.9); }
          100% { transform: rotate(360deg) translateY(40px) rotate(-360deg) scale(1.1); }
        }
        @keyframes grid-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(40px); }
        }
      `}} />
    </div>
  );
}
