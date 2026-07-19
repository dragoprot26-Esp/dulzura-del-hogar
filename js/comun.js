/* ===== comun.js — Dulzura del Hogar =====
   Núcleo compartido: Supabase, login real (Auth), helpers y datos.
   Carga PRIMERO (antes de licencia.js / index.js / admin.js).
*/

/* ─────────────────────────────────────────────
   SUPABASE (base compartida del molde)
───────────────────────────────────────────── */
const SB_URL  = 'https://pcxlhgdpxfuybzfsquem.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGxoZ2RweGZ1eWJ6ZnNxdWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDIyOTQsImV4cCI6MjA5NjE3ODI5NH0.HJWpFO8TkRsmUx15GtSsUusjvVEhUsi5b_QGoPoPU00';

const APP_PREFIJO    = 'DULZ';
const DOMINIO_DUENO  = 'tiendalibre.app';     // compartido por todas las apps (NO cambiar)
const PROVEEDOR_MAIL = 'dragoprot26@gmail.com';

/* ─────────────────────────────────────────────
   EmailJS (avisos) — claves del molde
───────────────────────────────────────────── */
const EMAILJS_SERVICE_ID  = 'service_yyq7g8j';
const EMAILJS_PUBLIC_KEY   = 'jhKfIcmjuvOrBXfp5';
const EMAILJS_TEMPLATE_ID  = '';   // (opcional) completar si se usa recuperación por mail

/* ═════════════════════════════════════════════
   SESIÓN SUPABASE AUTH
═════════════════════════════════════════════ */
const SB_SESS_KEY = 'dulzura_sb_sess';

function sbGuardarSesion(data) {
  const s = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    user_id:       data.user?.id || '',
    email:         data.user?.email || '',
    expira:        Date.now() + ((data.expires_in || 3600) * 1000)
  };
  localStorage.setItem(SB_SESS_KEY, JSON.stringify(s));
  return s;
}

function sbObtenerSesion() {
  try {
    const raw = localStorage.getItem(SB_SESS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && s.access_token && s.refresh_token) ? s : null;
  } catch (e) { return null; }
}

function sbLimpiarSesion() {
  localStorage.removeItem(SB_SESS_KEY);
}

// Refresca el token si está por vencer (margen 60s). Devuelve la sesión o null.
async function sbRefrescar() {
  const s = sbObtenerSesion();
  if (!s) return null;
  if (Date.now() < s.expira - 60000) return s;   // todavía vigente
  try {
    const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: s.refresh_token })
    });
    const data = await res.json();
    if (!res.ok) { sbLimpiarSesion(); return null; }
    return sbGuardarSesion(data);
  } catch (e) {
    return s; // si falla por red, devolvemos la actual
  }
}

// Devuelve un access_token válido (refrescando si hace falta) o null.
async function sbToken() {
  const s = await sbRefrescar();
  return s ? s.access_token : null;
}

async function sbSignIn(email, password) {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error_description || data.msg || data.error || 'Credenciales incorrectas.' };
    }
    sbGuardarSesion(data);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

async function sbSignUp(email, password) {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SB_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error_description || data.msg || data.error || 'No se pudo crear la cuenta.' };
    }
    if (data.access_token) sbGuardarSesion(data);
    return { ok: true, conSesion: !!data.access_token };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

async function sbSignOut() {
  const s = sbObtenerSesion();
  if (s) {
    try {
      await fetch(`${SB_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: SB_ANON, Authorization: 'Bearer ' + s.access_token }
      });
    } catch (e) { /* no-op */ }
  }
  sbLimpiarSesion();
}

/* ═════════════════════════════════════════════
   RPC (funciones del servidor) con reintento ante 401/403
═════════════════════════════════════════════ */
async function sbRPC(fn, params = {}, { conAuth = true } = {}) {
  async function pedir(bearer) {
    return fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    });
  }
  try {
    let bearer = conAuth ? (await sbToken()) || SB_ANON : SB_ANON;
    let res = await pedir(bearer);
    // Reintento: si rechazó por auth y hay sesión, refrescamos y reintentamos
    if ((res.status === 401 || res.status === 403) && conAuth) {
      const s = await sbRefrescar();
      if (s) res = await pedir(s.access_token);
    }
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`RPC ${fn} falló (${res.status}):`, txt);
      return { ok: false, status: res.status, error: txt };
    }
    const txt = await res.text();
    return { ok: true, data: txt ? JSON.parse(txt) : null };
  } catch (e) {
    console.warn(`RPC ${fn} error:`, e);
    return { ok: false, error: String(e) };
  }
}

// Egress: versión liviana (solo la fecha updated_at) para no bajar todo si no cambió.
async function dulzuraVersion() {
  const lic = obtenerLicencia();
  if (!lic || !lic.codigo) return '';
  const r = await sbRPC('dulzura_version', { p_codigo: lic.codigo }, { conAuth: true });
  return (r && r.ok && r.data != null) ? String(r.data) : '';
}

// Comprime una imagen (achica a maxLado y baja a JPEG) antes de guardarla.
function comprimirImg(file, maxLado, cb) {
  const r = new FileReader();
  r.onload = () => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxLado || h > maxLado) { if (w >= h) { h = Math.round(h * maxLado / w); w = maxLado; } else { w = Math.round(w * maxLado / h); h = maxLado; } }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      try { cb(c.toDataURL('image/jpeg', 0.72)); } catch (e) { cb(r.result); }
    };
    img.onerror = () => cb(r.result);
    img.src = r.result;
  };
  r.readAsDataURL(file);
}

/* ═════════════════════════════════════════════
   CUENTA SEGURA DEL DUEÑO (Supabase Auth)
   Email interno determinístico (igual que el servidor):
     minúsculas(usuario + "." + codigo), solo [a-z0-9.], + "@tiendalibre.app"
═════════════════════════════════════════════ */
function emailDueno(usuario, codigo) {
  return (String(usuario) + '.' + String(codigo))
           .toLowerCase()
           .replace(/[^a-z0-9.]/g, '') + '@' + DOMINIO_DUENO;
}

// Email interno para colaboradores (espacio aparte para no chocar con el dueño).
function emailColab(usuario, codigo) {
  return ('colab.' + String(usuario) + '.' + String(codigo))
           .toLowerCase()
           .replace(/[^a-z0-9.]/g, '') + '@' + DOMINIO_DUENO;
}

// Garantiza que exista la cuenta Auth del dueño y deja la sesión iniciada.
// Devuelve { ok, error }.
async function asegurarCuentaSeguraDueno(codigo, usuario, pass) {
  if (!pass || pass.length < 6) {
    return { ok: false, error: 'La contraseña debe tener 6 caracteres o más.' };
  }
  const email = emailDueno(usuario, codigo);

  // 1) Intentar ingresar directo
  let r = await sbSignIn(email, pass);

  // 2) Si no entró, puede ser primera vez (no existe) o clave desincronizada
  if (!r.ok) {
    const alta = await sbSignUp(email, pass);
    if (alta.ok && alta.conSesion) {
      r = { ok: true };
    } else if (alta.ok && !alta.conSesion) {
      // cuenta creada pero sin sesión → intentar ingresar
      r = await sbSignIn(email, pass);
    } else {
      // Probablemente la cuenta ya existe con otra clave:
      // sincronizamos la clave Auth con la de la licencia y reintentamos.
      await sbRPC('sincronizar_clave_dueno',
        { p_codigo: codigo, p_usuario: usuario, p_pass: pass }, { conAuth: false });
      r = await sbSignIn(email, pass);
    }
  }

  if (!r.ok) {
    return { ok: false, error: r.error || 'No se pudo iniciar sesión. Revisá la contraseña (6+).' };
  }

  // 3) Sincronizar clave (idempotente) y vincular como dueño
  await sbRPC('sincronizar_clave_dueno',
    { p_codigo: codigo, p_usuario: usuario, p_pass: pass }, { conAuth: false });
  await sbRPC('reclamar_dulzura', { p_codigo: codigo }, { conAuth: true });

  // 4) Verificar que realmente quedó una sesión válida
  const token = await sbToken();
  if (!token) return { ok: false, error: 'No se pudo verificar la sesión. Probá de nuevo.' };
  return { ok: true };
}

/* ═════════════════════════════════════════════
   LOGIN / LOGOUT del panel
═════════════════════════════════════════════ */
// Login del dueño: activa la licencia (si hace falta) + cuenta segura.
// Devuelve { ok, error }.
async function loginDueno(codigo, usuario, pass) {
  codigo = (codigo || '').trim().toUpperCase();
  usuario = (usuario || '').trim();

  // 1) Validar/activar la licencia (RPC validar_licencia)
  const lic = await activarLicencia(codigo);
  if (!lic) return { ok: false, error: 'Código de licencia inválido o no encontrado.' };

  // Si no escribieron usuario, usamos el de la licencia
  if (!usuario) usuario = lic.usuario || '';
  if (!usuario) return { ok: false, error: 'Falta el usuario (lo genera el panel).' };

  if (!pass || pass.length < 6) {
    return { ok: false, error: 'La contraseña debe tener 6 caracteres o más.' };
  }

  // 2) Cuenta segura en la nube
  const res = await asegurarCuentaSeguraDueno(codigo, usuario, pass);
  if (!res.ok) return res;

  // 3) Marcar sesión local y guardar usuario en la licencia
  sessionStorage.setItem('admin_logged', 'true');
  const guardada = obtenerLicencia() || {};
  guardada.usuario = usuario;
  guardada.email = emailDueno(usuario, codigo);
  guardada.rol = 'dueno';
  guardarLicencia(guardada);

  // 4) Registrar este equipo (aplica el límite de accesos por tienda)
  const reg = await registrarDispositivo();
  if (!reg.ok) {
    sessionStorage.removeItem('admin_logged');
    await sbSignOut();
    return reg;
  }
  return { ok: true };
}

// Login de COLABORADOR: se une al local con su propia clave.
async function loginColab(codigo, usuario, pass) {
  codigo = (codigo || '').trim().toUpperCase();
  usuario = (usuario || '').trim();
  if (!codigo)  return { ok: false, error: 'Ingresá el código del local.' };
  if (!usuario) return { ok: false, error: 'Ingresá tu nombre de usuario.' };
  if (!pass || pass.length < 6) return { ok: false, error: 'La contraseña debe tener 6 caracteres o más.' };

  // 1) Verificar que el local exista y esté activo
  const ver = await sbRPC('verificar_colab_dulzura', { p_codigo: codigo }, { conAuth: false });
  const info = (ver.ok && Array.isArray(ver.data)) ? ver.data[0] : (ver.ok ? ver.data : null);
  if (!info) return { ok: false, error: 'Código de local inválido o inactivo.' };

  // 2) Cuenta del colaborador (la crea la primera vez)
  const email = emailColab(usuario, codigo);
  let r = await sbSignIn(email, pass);
  if (!r.ok) {
    const alta = await sbSignUp(email, pass);
    if (alta.ok && alta.conSesion) r = { ok: true };
    else r = await sbSignIn(email, pass);
  }
  if (!r.ok) return { ok: false, error: r.error || 'No se pudo iniciar sesión. Revisá tu clave (6+).' };

  // 3) Vincularse como colaborador del local
  const u = await sbRPC('unirse_colab_dulzura', { p_codigo: codigo }, { conAuth: true });
  if (!u.ok) return { ok: false, error: 'No se pudo unir al local. Probá de nuevo.' };

  // 4) Guardar la licencia local del colaborador
  sessionStorage.setItem('admin_logged', 'true');
  guardarLicencia({
    valida: true, codigo, usuario, email, rol: 'colab',
    plan: 'colaborador', temporal: false,
    negocio: info.nombre_negocio || '', color: info.color_principal || ''
  });
  return { ok: true };
}

function isAdminLogged() {
  return sessionStorage.getItem('admin_logged') === 'true' && !!sbObtenerSesion();
}

async function logoutAdmin() {
  await liberarDispositivo();   // libera el lugar antes de salir
  await sbSignOut();
  sessionStorage.removeItem('admin_logged');
  window.location.href = 'index.html';
}

// Cambio de contraseña desde el panel (actualiza la cuenta Auth). 6+ caracteres.
async function cambiarPasswordAuth(actual, nueva) {
  if (!nueva || nueva.length < 6) return { ok: false, error: 'La nueva contraseña debe tener 6+ caracteres.' };
  const lic = obtenerLicencia();
  if (!lic || !lic.codigo) return { ok: false, error: 'No hay licencia activa.' };
  const usuario = lic.usuario || '';
  const email = lic.email || emailDueno(usuario, lic.codigo);

  // Verificar la actual reingresando
  const v = await sbSignIn(email, actual);
  if (!v.ok) return { ok: false, error: 'La contraseña actual es incorrecta.' };

  const token = await sbToken();
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: nueva })
    });
    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: 'No se pudo cambiar la contraseña. ' + t };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo conectar con el servidor.' };
  }
}

/* ═════════════════════════════════════════════
   RECUPERAR CONTRASEÑA (sin exponer claves)
═════════════════════════════════════════════ */
function recuperarAdmin(_email) {
  alert('Para recuperar tu contraseña, contactá al proveedor con tu código de licencia:\n' + PROVEEDOR_MAIL);
}

/* ═════════════════════════════════════════════
   DATOS (por ahora locales; la nube se conecta en el próximo paso)
═════════════════════════════════════════════ */
function getProductos() { return JSON.parse(localStorage.getItem('productos') || '[]'); }
function setProductos(arr) { localStorage.setItem('productos', JSON.stringify(arr)); colaPush(); }
function getPedidos()   { return JSON.parse(localStorage.getItem('pedidos') || '[]'); }
function setPedidos(arr)   { localStorage.setItem('pedidos', JSON.stringify(arr)); colaPush(); }
function getPromos()    { return JSON.parse(localStorage.getItem('promos') || '[]'); }
function setPromos(arr)    { localStorage.setItem('promos', JSON.stringify(arr)); colaPush(); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function formatPrecio(n) { return '$' + Number(n).toLocaleString('es-AR'); }
function formatFecha(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

/* ═════════════════════════════════════════════
   SINCRONIZACIÓN CON LA NUBE (dulzura_backups)
   - Al entrar al panel: traer (pull) lo último de la nube.
   - Al cambiar datos: subir (push) en segundo plano.
   - Página pública: leer por código con dulzura_publica (sin login).
═════════════════════════════════════════════ */
let _pushPendiente     = false;
let _aplicandoSnapshot = false;
let _pushTimer = null;

function snapshotLocal() {
  return {
    productos: getProductos(),
    promos:    getPromos(),
    pedidos:   getPedidos(),
    app_nombre:     localStorage.getItem('app_nombre') || '',
    app_emoji:      localStorage.getItem('app_emoji') || '',
    app_logo:       localStorage.getItem('app_logo') || '',
    admin_nombre:   localStorage.getItem('admin_nombre') || '',
    admin_email:    localStorage.getItem('admin_email') || '',
    admin_telefono: localStorage.getItem('admin_telefono') || '',
    tema:           localStorage.getItem('tema') || 'claro',
    dispositivos:   getDispositivos(),
    max_personal:   maxPersonal()
  };
}

function aplicarSnapshot(d) {
  if (!d || typeof d !== 'object') return;
  _aplicandoSnapshot = true;
  if (Array.isArray(d.productos)) setProductos(d.productos);
  if (Array.isArray(d.promos))    setPromos(d.promos);
  if (Array.isArray(d.pedidos))   setPedidos(d.pedidos);
  ['app_nombre','app_emoji','app_logo','admin_nombre','admin_email','admin_telefono','tema'].forEach(k => {
    if (d[k] !== undefined && d[k] !== null && d[k] !== '') localStorage.setItem(k, d[k]);
  });
  if (d.dispositivos && typeof d.dispositivos === 'object') setDispositivos(d.dispositivos);
  if (d.max_personal) localStorage.setItem('max_personal', String(d.max_personal));
  _aplicandoSnapshot = false;
}

// Encola un push con un pequeño retardo (junta varios cambios seguidos).
function colaPush() {
  if (_aplicandoSnapshot) return;   // no re-subir lo que acabamos de bajar
  if (!sbObtenerSesion()) return;   // solo el dueño/colaborador logueado sube
  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => { nubeGuardar(); }, 800);
}

// Trae los datos del inquilino desde la nube y los aplica al localStorage.
async function nubeTraer() {
  const lic = obtenerLicencia();
  if (!lic || !lic.codigo) return false;
  const token = await sbToken();
  if (!token) return false;
  const url = `${SB_URL}/rest/v1/dulzura_backups?tenant_id=eq.${encodeURIComponent(lic.codigo)}&select=datos`;
  async function pedir(bearer) {
    return fetch(url, { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + bearer } });
  }
  try {
    let res = await pedir(token);
    if (res.status === 401 || res.status === 403) {
      const s = await sbRefrescar(); if (s) res = await pedir(s.access_token);
    }
    if (!res.ok) return false;
    const filas = await res.json();
    if (Array.isArray(filas) && filas.length && filas[0].datos) {
      aplicarSnapshot(filas[0].datos);
      return true;
    }
    return false;
  } catch (e) { console.warn('nubeTraer:', e); return false; }
}

// Sube (upsert) los datos actuales del inquilino a la nube.
async function nubeGuardar() {
  const lic = obtenerLicencia();
  if (!lic || !lic.codigo) return false;
  const token = await sbToken();
  if (!token) return false;
  _pushPendiente = true;
  const cuerpo = JSON.stringify({ tenant_id: lic.codigo, datos: snapshotLocal(), updated_at: new Date().toISOString() });
  async function pedir(bearer) {
    return fetch(`${SB_URL}/rest/v1/dulzura_backups`, {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: cuerpo
    });
  }
  try {
    let res = await pedir(token);
    if (res.status === 401 || res.status === 403) {
      const s = await sbRefrescar(); if (s) res = await pedir(s.access_token);
    }
    _pushPendiente = false;
    if (!res.ok) { console.warn('nubeGuardar falló:', res.status, await res.text()); return false; }
    return true;
  } catch (e) { _pushPendiente = false; console.warn('nubeGuardar:', e); return false; }
}

// Lectura PÚBLICA por código (página pública, sin login).
async function nubePublica(codigo) {
  const r = await sbRPC('dulzura_publica', { p_codigo: (codigo || '').trim().toUpperCase() }, { conAuth: false });
  return r.ok ? r.data : null;
}

/* ═════════════════════════════════════════════
   MULTI-DISPOSITIVO (varios equipos para una misma tienda)
═════════════════════════════════════════════ */
function deviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) { id = 'd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); localStorage.setItem('device_id', id); }
  return id;
}
function getOperador() { return localStorage.getItem('operador_nombre') || (obtenerLicencia() || {}).usuario || 'Operador'; }
function setOperador(n) { if (n && n.trim()) localStorage.setItem('operador_nombre', n.trim()); }
function maxPersonal() { return parseInt(localStorage.getItem('max_personal') || '2', 10) || 2; }
function getDispositivos() { try { return JSON.parse(localStorage.getItem('dispositivos') || '{}'); } catch (e) { return {}; } }
function setDispositivos(d) { localStorage.setItem('dispositivos', JSON.stringify(d || {})); }

// Registra este equipo en la tienda y aplica el límite de accesos.
// Devuelve { ok } o { ok:false, error } si se superó el máximo.
// Ante cualquier error de red NO bloquea (deja entrar), para no trabar al dueño.
async function registrarDispositivo() {
  try {
    await nubeTraer();                 // trae la lista actual de equipos
    const disp = getDispositivos();
    const id = deviceId();

    if (disp[id]) {                    // este equipo ya estaba habilitado → renovar
      disp[id].ts = Date.now();
      if (!localStorage.getItem('operador_nombre') && disp[id].nombre) setOperador(disp[id].nombre);
      setDispositivos(disp);
      localStorage.setItem('registrado', '1');
      await nubeGuardar();
      return { ok: true };
    }

    const max = maxPersonal();
    if (Object.keys(disp).length >= max) {
      return { ok: false, error: `Esta tienda ya tiene ${max} equipos conectados.\nLiberá uno desde "Mi cuenta → Equipos con acceso" (botón ✕), o escribí a ${PROVEEDOR_MAIL} para sumar más personal.` };
    }

    let nombre = localStorage.getItem('operador_nombre');
    if (!nombre && typeof prompt === 'function') {
      nombre = prompt('¿Cómo te llamás? (para registrar quién atiende los pedidos)') || '';
    }
    nombre = (nombre || '').trim() || 'Operador';
    setOperador(nombre);
    disp[id] = { nombre, ts: Date.now() };
    setDispositivos(disp);
    localStorage.setItem('registrado', '1');
    await nubeGuardar();               // sube la lista actualizada
    return { ok: true };
  } catch (e) {
    console.warn('registrarDispositivo:', e);
    return { ok: true };               // fail-open (nunca bloquea por error)
  }
}

// Libera el lugar de este equipo (al cerrar sesión).
async function liberarDispositivo() {
  try {
    const disp = getDispositivos();
    const id = deviceId();
    if (disp[id]) { delete disp[id]; setDispositivos(disp); await nubeGuardar(); }
  } catch (e) { /* no-op */ }
  localStorage.removeItem('registrado');
}

// Borra TODAS las claves del inquilino (para arrancar limpio uno nuevo).
function limpiarDatosInquilino() {
  ['productos', 'promos', 'pedidos',
   'app_nombre', 'app_emoji', 'app_logo',
   'admin_nombre', 'admin_email', 'admin_telefono', 'tema'
  ].forEach(k => localStorage.removeItem(k));
}

/* ─── Inicializar datos mínimos (sin contraseñas locales) ─── */
function inicializarDatos() {
  if (!localStorage.getItem('productos')) localStorage.setItem('productos', JSON.stringify([]));
  if (!localStorage.getItem('promos'))    localStorage.setItem('promos', JSON.stringify([]));
  if (!localStorage.getItem('pedidos'))   localStorage.setItem('pedidos', JSON.stringify([]));
  if (!localStorage.getItem('tema'))      localStorage.setItem('tema', 'claro');
}

/* ─── Tema ─── */
function aplicarTema() {
  const tema = localStorage.getItem('tema') || 'claro';
  document.body.className = document.body.className.replace(/tema-\S+/g, '').trim();
  document.body.classList.add('tema-' + tema);
}

/* ─── Inicializar al cargar ─── */
inicializarDatos();
aplicarTema();
