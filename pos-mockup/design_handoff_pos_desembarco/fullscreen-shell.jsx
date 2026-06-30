// Shell fullscreen — escala la pantalla nativa al viewport
// Usage: <FullscreenShell width={1920} height={1080} screen="pos">{children}</FullscreenShell>

const FS_SCREENS = [
  { id: "pos",       label: "POS",        num: "01", file: "pos.html",       w: 1920, h: 1080 },
  { id: "salon",     label: "Salón",      num: "02", file: "salon.html",     w: 1920, h: 1080 },
  { id: "mozo",      label: "Mozo",       num: "03", file: "mozo.html",      w: 1280, h: 800  },
  { id: "kds",       label: "Cocina",     num: "04", file: "kds.html",       w: 1920, h: 1080 },
  { id: "apps",      label: "Apps",       num: "05", file: "apps.html",      w: 1920, h: 1080 },
  { id: "ticket",    label: "Cobro",      num: "06", file: "ticket.html",    w: 1920, h: 1080 },
  { id: "reportes",  label: "Reportes",   num: "07", file: "reportes.html",  w: 1920, h: 1080 },
];

function FullscreenShell({ width, height, screen, children }) {
  const stageRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);
  const [fit, setFit] = React.useState(() => localStorage.getItem("fs-fit") || "auto");

  React.useEffect(() => {
    const update = () => {
      if (fit === "actual") {
        setScale(1);
        return;
      }
      // auto: encajar en el viewport con un poco de margen
      const margin = 0; // sin margen para "página real"
      const sw = (window.innerWidth - margin * 2) / width;
      const sh = (window.innerHeight - margin * 2) / height;
      setScale(Math.min(sw, sh));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [width, height, fit]);

  React.useEffect(() => {
    document.documentElement.dataset.fsFit = fit === "auto" ? "true" : "false";
    localStorage.setItem("fs-fit", fit);
  }, [fit]);

  // Aplicar tema desde localStorage compartido con el canvas
  React.useEffect(() => {
    const theme = localStorage.getItem("fs-theme") || "dark";
    const density = localStorage.getItem("fs-density") || "regular";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
  }, []);

  // En modo "actual", permitir scroll
  const stageStyle = fit === "actual"
    ? { overflow: "auto", placeItems: "start start" }
    : {};

  return (
    <>
      <div className="fs-stage" ref={stageRef} style={stageStyle}>
        <div className="fs-canvas-wrap" style={{
          width: fit === "auto" ? width * scale : width,
          height: fit === "auto" ? height * scale : height,
        }}>
          <div className="fs-canvas" style={{
            width, height,
            transform: fit === "auto" ? `scale(${scale})` : "none",
          }}>
            {children}
          </div>
        </div>
      </div>

      <div className="fs-size-tag">
        {width}×{height} · ×{(scale * 100).toFixed(0)}%
      </div>

      <div className="fs-fit-toggle">
        <button className={"fs-fit-btn" + (fit === "auto" ? " is-active" : "")}
          onClick={() => setFit("auto")}>Fit</button>
        <button className={"fs-fit-btn" + (fit === "actual" ? " is-active" : "")}
          onClick={() => setFit("actual")}>1:1</button>
      </div>

      <FullscreenDock current={screen} />
    </>
  );
}

function FullscreenDock({ current }) {
  return (
    <div className="fs-dock">
      <a href="index.html" className="fs-dock-home" title="Volver al canvas">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="9" rx="1" />
          <rect x="14" y="3" width="7" height="5" rx="1" />
          <rect x="14" y="12" width="7" height="9" rx="1" />
          <rect x="3" y="16" width="7" height="5" rx="1" />
        </svg>
      </a>
      <div className="fs-dock-sep" />
      {FS_SCREENS.map((s) => (
        <a key={s.id} href={s.file}
          className={"fs-dock-btn" + (s.id === current ? " is-active" : "")}>
          <span className="fs-dock-num">{s.num}</span>
          <span>{s.label}</span>
        </a>
      ))}
    </div>
  );
}

window.FullscreenShell = FullscreenShell;
window.FS_SCREENS = FS_SCREENS;
