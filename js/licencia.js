/* ===== licencia.js — Dulzura del Hogar =====
   Activación segura por RPC validar_licencia (NO se escribe la tabla directo).
   Carga DESPUÉS de comun.js (usa sbRPC).
*/

const CLAVE_LICENCIA = 'dulzura_licencia';

/* ══════════════════════════════════════════
   LICENCIA LOCAL
══════════════════════════════════════════ */
function obtenerLicencia() {
  try { return JSON.parse(localStorage.getItem(CLAVE_LICENCIA) || 'null'); }
  catch (e) { return null; }
}

function guardarLicencia(obj) {
  localStorage.setItem(CLAVE_LICENCIA, JSON.stringify(obj));
}

function verificarLicencia() {
  const lic = obtenerLicencia();
  if (!lic || !lic.valida) return false;
  if (lic.expira && Date.now() > lic.expira) {
    lic.valida = false;
    guardarLicencia(lic);
    return false;
  }
  if (lic.expira) {
    const d = Math.ceil((lic.expira - Date.now()) / (1000 * 60 * 60 * 24));
    if (d <= 4) mostrarAvisoLicencia(d);
  }
  return true;
}

function mostrarAvisoLicencia(dias) {
  if (document.getElementById('avisoLicencia')) return;
  const div = document.createElement('div');
  div.id = 'avisoLicencia';
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#b45309;color:#fff;padding:10px 14px;text-align:center;font-size:0.85rem;z-index:9999;';
  const msg = dias <= 0
    ? '⚠️ Tu licencia <strong>venció</strong>.'
    : `⏳ Tu licencia vence en <strong>${dias} día${dias !== 1 ? 's' : ''}</strong>.`;
  div.innerHTML = `${msg}
    <a href="mailto:${PROVEEDOR_MAIL}" style="color:#fff;text-decoration:underline;display:block;margin-top:6px;font-size:0.82rem;">
      Contactar proveedor →
    </a>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}

/* ══════════════════════════════════════════
   ACTIVAR LICENCIA
   1. RPC validar_licencia(p_codigo) → activa (idempotente) y devuelve la fila.
   2. Si es un inquilino NUEVO (cambió el código) → limpiar datos locales.
   3. Guardar licencia local. (NO se guarda la contraseña.)
   Devuelve el objeto licencia local, o null si el código no existe.
══════════════════════════════════════════ */
async function activarLicencia(codigo) {
  codigo = (codigo || '').trim().toUpperCase();
  if (!codigo || codigo.length < 5) return null;

  const r = await sbRPC('validar_licencia', { p_codigo: codigo }, { conAuth: false });
  if (!r.ok || !r.data) return null;   // código inexistente o error

  const remoto = r.data; // fila completa de licencias (jsonb)

  // ¿Inquilino nuevo? Si el código cambió respecto del guardado, arrancamos limpio.
  const previa = obtenerLicencia();
  if (!previa || previa.codigo !== codigo) {
    limpiarDatosInquilino();
    if (remoto.nombre_negocio) localStorage.setItem('app_nombre', remoto.nombre_negocio);
  }

  // Vencimiento: usar el de la licencia si viene; si no, calcular desde 'dias'.
  const dias = remoto.dias || remoto.dias_prueba || 30;
  const expira = remoto.fecha_vencimiento
    ? new Date(remoto.fecha_vencimiento).getTime()
    : Date.now() + dias * 24 * 60 * 60 * 1000;

  const lic = {
    valida: true,
    codigo,
    usuario: remoto.usuario_admin || (previa && previa.usuario) || '',
    plan: remoto.plan || (remoto.es_prueba ? 'prueba' : 'premium'),
    temporal: !!remoto.es_prueba,
    negocio: remoto.nombre_negocio || '',
    color: remoto.color_principal || '',
    dias,
    expira
  };
  guardarLicencia(lic);
  return lic;
}

/* ══════════════════════════════════════════
   INFO LICENCIA (footer admin)
══════════════════════════════════════════ */
function mostrarInfoLicencia() {
  const el = document.getElementById('licenciaInfo');
  if (!el) return;
  if (!window.location.href.includes('admin.html')) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  const lic = obtenerLicencia();
  if (!lic) { el.textContent = '🔓 Sin licencia activa'; return; }
  if (!lic.valida || (lic.expira && Date.now() > lic.expira)) {
    el.innerHTML = `❌ Licencia vencida — <a href="mailto:${PROVEEDOR_MAIL}" style="color:inherit;">Renovar</a>`;
    return;
  }
  const d = Math.ceil((lic.expira - Date.now()) / (1000 * 60 * 60 * 24));
  el.textContent = lic.temporal
    ? `⏳ Licencia de prueba — ${d} día${d !== 1 ? 's' : ''} restante${d !== 1 ? 's' : ''}`
    : `✅ Licencia ${lic.plan || 'premium'} activa — ${d} días restantes`;
}

/* ══════════════════════════════════════════
   BIOMETRÍA — WebAuthn (huella, PIN, patrón)
══════════════════════════════════════════ */
const BIOMETRIA_KEY = 'dulzura_biometria';

function biometriaDisponible() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}
function biometriaRegistrada() {
  return !!localStorage.getItem(BIOMETRIA_KEY);
}

async function registrarBiometria() {
  if (!biometriaDisponible()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId    = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Dulzura del Hogar', id: location.hostname || 'localhost' },
        user: {
          id: userId,
          name: (obtenerLicencia() && obtenerLicencia().usuario) || 'dueno',
          displayName: localStorage.getItem('admin_nombre') || 'Administrador'
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (cred) {
      const credId = Array.from(new Uint8Array(cred.rawId));
      localStorage.setItem(BIOMETRIA_KEY, JSON.stringify({ credId, ts: Date.now() }));
      return true;
    }
  } catch (e) { console.warn('Registro biométrico:', e.message); }
  return false;
}

async function verificarBiometria() {
  if (!biometriaDisponible()) return false;
  const stored = JSON.parse(localStorage.getItem(BIOMETRIA_KEY) || 'null');
  if (!stored?.credId) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname || 'localhost',
        allowCredentials: [{ id: new Uint8Array(stored.credId), type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return assertion !== null;
  } catch (e) { console.warn('Verificación biométrica:', e.message); return false; }
}

function desactivarBiometria() {
  localStorage.removeItem(BIOMETRIA_KEY);
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.href.includes('admin.html')) {
    mostrarInfoLicencia();
  } else {
    const el = document.getElementById('licenciaInfo');
    if (el) el.style.display = 'none';
  }
});
