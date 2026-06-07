/* ===== comun.js — Dulzura del Hogar ===== */

const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';    // ← reemplazar
const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';   // ← reemplazar
const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';     // ← reemplazar

/* =====================================================================
   SUPABASE (CyC Admin v2 — base nueva)
   Config compartida: la usa también licencia.js
   ===================================================================== */
const SB_URL = 'https://pcxlhgdpxfuybzfsquem.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGxoZ2RweGZ1eWJ6ZnNxdWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDIyOTQsImV4cCI6MjA5NjE3ODI5NH0.HJWpFO8TkRsmUx15GtSsUusjvVEhUsi5b_QGoPoPU00';

/* =====================================================================
   SYNC MULTI-INQUILINO  (igual idea que SalonPro: 1 fila por inquilino)
   Cada licencia (codigo) tiene su propia "tienda" en la nube.
   Tabla: dulzura_backups  (tenant_id, datos, updated_at)
   ===================================================================== */
const DULZURA_SYNC_KEYS = [
  'productos', 'pedidos', 'promos',
  'app_nombre', 'app_emoji', 'app_logo',
  'admin_nombre', 'admin_email', 'admin_telefono',
  'tema'
];

let _dulzuraPush = false;          // recién se habilita después de hidratar de la nube
let _dulzuraTimer = null;

// Guardamos la versión original de setItem para escribir SIN disparar sync
const _origSetItem = localStorage.setItem.bind(localStorage);

// Código de licencia = tenant_id. Ignoramos el código de prueba genérico.
function _dulzuraCodigo() {
  try {
    const lic = JSON.parse(localStorage.getItem('dulzura_licencia') || 'null');
    const c = lic && lic.codigo ? lic.codigo : null;
    if (!c || c === 'TRIAL-15') return null;  // sin licencia real → todo local
    return c;
  } catch (e) { return null; }
}

function dulzuraHabilitarSync() { _dulzuraPush = true; }

function _dulzuraDebounce() {
  if (_dulzuraTimer) clearTimeout(_dulzuraTimer);
  _dulzuraTimer = setTimeout(dulzuraNubeGuardar, 800);
}

// Sube el estado actual (todos los datos del inquilino) a la nube
async function dulzuraNubeGuardar() {
  if (!_dulzuraPush) return;
  const codigo = _dulzuraCodigo();
  if (!codigo) return;
  const datos = {};
  DULZURA_SYNC_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) datos[k] = v;
  });
  try {
    await fetch(`${SB_URL}/rest/v1/dulzura_backups`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ tenant_id: codigo, datos, updated_at: new Date().toISOString() })
    });
  } catch (e) { console.warn('[Dulzura] No se pudo subir a la nube:', e); }
}

// Baja los datos del inquilino desde la nube y los escribe en localStorage
async function dulzuraNubeCargar() {
  const codigo = _dulzuraCodigo();
  if (!codigo) return { hydrated: false, changed: false };
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/dulzura_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { headers: { 'apikey': SB_KEY, 'Authorization': 'Bearer ' + SB_KEY } }
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length && rows[0].datos) {
        const datos = rows[0].datos;
        let changed = false;
        Object.keys(datos).forEach(k => {
          if (DULZURA_SYNC_KEYS.includes(k)) {
            if (localStorage.getItem(k) !== datos[k]) changed = true;
            _origSetItem(k, datos[k]); // escribir sin disparar push
          }
        });
        return { hydrated: true, changed, nuevo: false };
      }
    }
    // Inquilino nuevo: todavía no tiene datos en la nube (lo resuelve quien activa)
    _dulzuraPush = true;
    return { hydrated: true, changed: false, nuevo: true };
  } catch (e) {
    console.warn('[Dulzura] No se pudo bajar de la nube:', e);
    return { hydrated: false, changed: false };
  }
}

// Interceptar TODOS los guardados (productos, promos, perfil, tema...) sin tocar admin.js
localStorage.setItem = function (k, v) {
  _origSetItem(k, v);
  if (_dulzuraPush && DULZURA_SYNC_KEYS.includes(k)) _dulzuraDebounce();
};

/* ─── Datos de ejemplo ─── */
const PRODUCTOS_INICIALES = [
  {
    id: 'p1',
    nombre: 'Alfajores de Maicena',
    precio: 1500,
    imagen: '',
    detalle: 'Rellenos con dulce de leche, rebozados en coco rallado. ¡Irresistibles!',
    extras: { Ingredientes: 'Maicena, manteca, dulce de leche, coco', Unidades: '12 unidades' }
  },
  {
    id: 'p2',
    nombre: 'Mermelada Casera',
    precio: 900,
    imagen: '',
    detalle: 'Mermelada de durazno artesanal, sin conservantes, elaborada con fruta de estación.',
    extras: { Peso: '300 g', Conservación: 'Heladera hasta 2 semanas' }
  },
  {
    id: 'p3',
    nombre: 'Torta de Chocolate',
    precio: 4200,
    imagen: '',
    detalle: 'Húmeda, esponjosa, con ganache de chocolate negro. Pedido con 48 hs de anticipación.',
    extras: { Porciones: '8-10', Relleno: 'Ganache de chocolate' }
  }
];

/* ─── inicializarDatos ─── */
function inicializarDatos() {
  if (!localStorage.getItem('productos'))
    localStorage.setItem('productos', JSON.stringify(PRODUCTOS_INICIALES));
  if (!localStorage.getItem('pedidos'))
    localStorage.setItem('pedidos', JSON.stringify([]));
  // (Sin usuario/clave por defecto: el acceso se habilita solo al activar una licencia)
  if (!localStorage.getItem('admin_email'))
    localStorage.setItem('admin_email', 'admin@dulzurahogar.com');
  if (!localStorage.getItem('admin_nombre'))
    localStorage.setItem('admin_nombre', 'Abuela Rosa');
  if (!localStorage.getItem('admin_telefono'))
    localStorage.setItem('admin_telefono', '5491112345678');
  if (!localStorage.getItem('tema'))
    localStorage.setItem('tema', 'claro');
}

/* ─── Tema ─── */
function aplicarTema() {
  const tema = localStorage.getItem('tema') || 'claro';
  document.body.className = document.body.className
    .replace(/tema-\S+/g, '').trim();
  document.body.classList.add('tema-' + tema);
}

/* ─── Auth ─── */
function loginAdmin(user, pass) {
  // Solo entra con las credenciales que generó el panel (cargadas al activar la licencia).
  const u = localStorage.getItem('admin_user');
  const stored = localStorage.getItem('admin_pass');
  if (!u || !stored) return false;        // sin licencia activada, no hay acceso
  let p = '';
  try { p = atob(stored); } catch (e) { return false; }
  if (user.trim() === u && pass === p) {
    sessionStorage.setItem('admin_logged', 'true');
    return true;
  }
  return false;
}

function isAdminLogged() {
  return sessionStorage.getItem('admin_logged') === 'true';
}

function logoutAdmin() {
  sessionStorage.removeItem('admin_logged');
  window.location.href = 'index.html';
}

/* ─── Recuperar contraseña ─── */
function recuperarAdmin(email) {
  const adminEmail = localStorage.getItem('admin_email');
  if (email.trim().toLowerCase() !== adminEmail.trim().toLowerCase()) {
    alert('El correo ingresado no coincide con el del administrador.');
    return;
  }
  const stored = localStorage.getItem('admin_pass');
  if (!stored) { alert('Primero activá tu licencia con el código que te dieron.'); return; }
  const pass = atob(stored);

  if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: email,
      message: 'Tu contraseña de Dulzura del Hogar es: ' + pass
    }).then(() => {
      alert('✅ Contraseña enviada a ' + email);
    }).catch(() => {
      alert('⚠️ No se pudo enviar el correo. Verificá la configuración de EmailJS.');
    });
  } else {
    alert('EmailJS no está configurado. Tu contraseña es: ' + pass);
  }
}

/* ─── Helpers ─── */
function getProductos() {
  return JSON.parse(localStorage.getItem('productos') || '[]');
}

function setProductos(arr) {
  localStorage.setItem('productos', JSON.stringify(arr));
}

function getPedidos() {
  return JSON.parse(localStorage.getItem('pedidos') || '[]');
}

function setPedidos(arr) {
  localStorage.setItem('pedidos', JSON.stringify(arr));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatPrecio(n) {
  return '$' + Number(n).toLocaleString('es-AR');
}

function formatFecha(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/* ─── Inicializar al cargar ─── */
inicializarDatos();
aplicarTema();

/* ─── Hidratar desde la nube (1 sola vez por sesión) ─── */
(async function dulzuraHidratarInicial() {
  const codigo = _dulzuraCodigo();
  if (!codigo) { _dulzuraPush = false; return; }            // sin licencia real → todo local
  if (sessionStorage.getItem('dulzura_hidratado') === '1') { _dulzuraPush = true; return; }
  const r = await dulzuraNubeCargar();
  sessionStorage.setItem('dulzura_hidratado', '1');
  _dulzuraPush = true;
  if (r && r.changed) location.reload(); // refrescar para mostrar los datos de la nube
})();
