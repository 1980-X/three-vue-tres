export function Unavailable() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: '#111',
        color: '#eee',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <p style={{ fontSize: 20, margin: 0 }}>展馆已下架或不可用</p>
    </main>
  );
}
