export default function EnConstruccion({ titulo }) {
  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        gap: 14,
        minHeight: "60vh",
        textAlign: "center",
        color: "var(--muted)",
      }}
    > 
      <div>
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: 20,
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          {titulo}
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>
          Este módulo está en construcción.
        </p>
      </div>
    </div>
  );
}
