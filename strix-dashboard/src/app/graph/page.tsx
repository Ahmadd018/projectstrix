export default function Graph() {
  return (
    <div className="glass-panel" style={{ padding: '24px', height: 'calc(100vh - 160px)' }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: '16px' }}>Agent Live Graph</h2>
      <div style={{
        height: '100%', 
        border: '1px dashed var(--border-color)', 
        borderRadius: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        [Interactive Node Graph Placeholder]
      </div>
    </div>
  );
}
