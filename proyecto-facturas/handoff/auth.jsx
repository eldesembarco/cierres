/* ============ Autenticación con Google OAuth (Google Identity Services) ============ */

const GOOGLE_CLIENT_ID = "576260171226-ukm12ua10hcb16l3l4k4ejp1pnlh2mh7.apps.googleusercontent.com";
const ALLOWED_DOMAIN = "eldesembarco.com";
const TOKEN_KEY = "facturas_ia_token";

// Emails que pueden eliminar facturas. Tienen que ser @eldesembarco.com.
// Si la lista está vacía, cualquier usuario logueado puede eliminar (default abierto).
// Apenas agregás un email, SOLO esos pueden eliminar.
const ADMIN_EMAILS = [
  'polejavetzky@eldesembarco.com',
];

const isAdminEmail = (email) => {
  if (!email) return false;
  if (ADMIN_EMAILS.length === 0) return true; // permisivo cuando no hay lista
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
};

const decodeJwt = (token) => {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
};

const isTokenValid = (token) => {
  const decoded = decodeJwt(token);
  if (!decoded) return false;
  const now = Math.floor(Date.now() / 1000);
  return decoded.exp > now + 30; // 30s buffer
};

const useAuth = () => {
  const [token, setTokenState] = React.useState(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && isTokenValid(t) ? t : null;
  });

  const user = React.useMemo(() => {
    if (!token) return null;
    const d = decodeJwt(token);
    return d ? { email: d.email, name: d.name, picture: d.picture, hd: d.hd } : null;
  }, [token]);

  const setToken = React.useCallback((t) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    setTokenState(t);
  }, []);

  const handleCredential = React.useCallback((response) => {
    const newToken = response.credential;
    const decoded = decodeJwt(newToken);
    if (!decoded) {
      alert("No pude leer el token de Google");
      return;
    }
    if (decoded.hd !== ALLOWED_DOMAIN) {
      alert(`Acceso denegado. Solo cuentas @${ALLOWED_DOMAIN} pueden entrar.\nIngresaste con: ${decoded.email || "cuenta desconocida"}`);
      return;
    }
    setToken(newToken);
  }, [setToken]);

  const signOut = React.useCallback(() => {
    setToken(null);
    if (window.google?.accounts?.id) {
      try { window.google.accounts.id.disableAutoSelect(); } catch {}
    }
  }, [setToken]);

  // Auto-expira el token cuando vence (cae a login screen)
  React.useEffect(() => {
    if (!token) return;
    const decoded = decodeJwt(token);
    if (!decoded) return;
    const ms = (decoded.exp * 1000) - Date.now();
    if (ms <= 0) { setToken(null); return; }
    const t = setTimeout(() => setToken(null), Math.min(ms, 2147483000));
    return () => clearTimeout(t);
  }, [token, setToken]);

  return { token, user, handleCredential, signOut };
};

// fetch wrapper: añade Authorization Bearer + maneja 401
const apiFetch = (url, opts = {}) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...opts, headers }).then(res => {
    if (res.status === 401) {
      console.warn("apiFetch: 401 Unauthorized — limpiando sesión");
      localStorage.removeItem(TOKEN_KEY);
      setTimeout(() => window.location.reload(), 200);
      throw new Error("Sesión expirada — recargá la página");
    }
    return res;
  });
};

const LoginScreen = ({ onCredential }) => {
  const btnRef = React.useRef(null);
  const [status, setStatus] = React.useState("Cargando Google…");

  React.useEffect(() => {
    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        clearInterval(interval);
        setStatus(null);
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: onCredential,
            ux_mode: 'popup',
            auto_select: false,
          });
          if (btnRef.current) {
            window.google.accounts.id.renderButton(btnRef.current, {
              theme: 'filled_black',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              width: 280,
            });
          }
        } catch (e) {
          setStatus("Error: " + e.message);
        }
      }
    }, 80);
    return () => { cancelled = true; clearInterval(interval); };
  }, [onCredential]);

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-mark">D</div>
          <div>
            <div className="login-name">Desembarco</div>
            <div className="login-sub">Panel de Servicios · IA</div>
          </div>
        </div>
        <div className="login-title">Acceso restringido</div>
        <div className="login-subtitle">Iniciá sesión con tu cuenta corporativa</div>
        <div ref={btnRef} className="login-btn-host"/>
        {status && <div className="login-status">{status}</div>}
        <div className="login-foot">Solo cuentas @{ALLOWED_DOMAIN}</div>
      </div>
    </div>
  );
};

const UserBadge = ({ user, onSignOut }) => {
  const [open, setOpen] = React.useState(false);
  if (!user) return null;
  const display = (user.name || user.email || "").split(' ')[0];
  return (
    <div className="user-badge-wrap">
      <button className="user-badge" onClick={() => setOpen(v => !v)} title={user.email}>
        {user.picture
          ? <img src={user.picture} alt="" referrerPolicy="no-referrer"/>
          : <span className="user-badge-mark">{(user.email || "?")[0].toUpperCase()}</span>}
        <span className="user-badge-name">{display}</span>
        <Icon name="chevdown" size={10}/>
      </button>
      {open && (
        <>
          <div style={{position:"fixed",inset:0,zIndex:25}} onClick={()=>setOpen(false)}/>
          <div className="user-menu">
            <div className="user-menu-info">
              <div className="user-menu-name">{user.name || "—"}</div>
              <div className="user-menu-email">{user.email}</div>
            </div>
            <button className="user-menu-item" onClick={() => { setOpen(false); onSignOut(); }}>
              <Icon name="x" size={12}/>Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  );
};

Object.assign(window, { useAuth, apiFetch, LoginScreen, UserBadge, TOKEN_KEY, isAdminEmail, ADMIN_EMAILS });
