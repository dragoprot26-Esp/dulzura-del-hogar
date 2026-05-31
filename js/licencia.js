/* ===== licencia.js — Dulzura del Hogar ===== */

const CLAVE_LICENCIA = 'dulzura_licencia';
const PROVEEDOR_MAIL = 'dragoprot26@gmail.com';
const APP_ID         = 'dulzurahogar';

// ─── Supabase (mismo backend que CyC Admin) ───
const SB_URL = 'https://upoexzjltapiuijhszzk.supabase.co';
const SB_KEY = 'sb_publishable_Ll8-8exzAJBQYqC4YQdflg_7qvjjakP';

/* ══════════════════════════════════════════
   SUPABASE
══════════════════════════════════════════ */
async function sbGetLicencia(codigo) {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/licencias?select=*&codigo=eq.${encodeURIComponent(codigo)}&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (e) { return null; }
}

/*
  sbActivarLicencia:
  - Calcula fecha_vencimiento sumando los días del plan desde HOY
  - Envía activa:true + fecha_activacion + fecha_vencimiento en un solo PATCH
  - CyC Admin muestra badge VERDE cuando los tres campos están presentes
  - Retorna el registro actualizado (Prefer: return=representation)
*/
async function sbActivarLicencia(codigo, dias) {
  try {
    const hoy         = new Date();
    const vencimiento = new Date(hoy.getTime() + (dias || 30) * 24 * 60 * 60 * 1000);
    const res = await fetch(
      `${SB_URL}/rest/v1/licencias?codigo=eq.${encodeURIComponent(codigo)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SB_KEY,
          Authorization: 'Bearer ' + SB_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'          // ← devuelve el registro actualizado
        },
        body: JSON.stringify({
          activa: true,
          fecha_activacion: hoy.toISOString(),
          fecha_vencimiento: vencimiento.toISOString()  // ← CyC Admin necesita este campo para mostrar verde
        })
      }
    );
    const data = await res.json();
    return Array.isArray(data) && data.length > 0 ? data[0] : null;
  } catch (e) {
    console.warn('sbActivarLicencia error:', e);
    return null;
  }
}

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

function crearLicenciaTemporal() {
  const lic = {
    valida: true, temporal: true,
    expira: Date.now() + 15 * 24 * 60 * 60 * 1000,
    dias: 15, codigo: 'TRIAL-15', plan: 'prueba'
  };
  guardarLicencia(lic);
  return lic;
}

function verificarLicencia() {
  const lic = obtenerLicencia();
  if (!lic) return false;
  if (lic.expira && Date.now() > lic.expira) {
    lic.valida = false;
    guardarLicencia(lic);
    return false;
  }
  if (lic.temporal && lic.expira) {
    const d = Math.ceil((lic.expira - Date.now()) / (1000 * 60 * 60 * 24));
    if (d <= 4) mostrarAvisoLicencia(d);
  }
  return true;
}

function mostrarAvisoLicencia(dias) {
  if (document.getElementById('avisoLicencia')) return;
  const div = document.createElement('div');
  div.id = 'avisoLicencia';
  const msg = dias <= 0
    ? '⚠️ Tu licencia de prueba <strong>venció</strong>.'
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
   1. Busca en Supabase
   2. Si no estaba activa → PATCH con activa+fecha_activacion+fecha_vencimiento
   3. Aplica usuario/pass del proveedor al localStorage (cambia credenciales de acceso)
   4. Guarda licencia local
══════════════════════════════════════════ */
async function activarLicencia(codigo) {
  codigo = codigo.trim().toUpperCase();
  if (!codigo || codigo.length < 5) {
    alert('⚠️ El código ingresado no es válido.');
    return false;
  }

  const remote = await sbGetLicencia(codigo);

  if (remote) {
    let final = remote;

    // Si no estaba completamente activa (falta activa, fecha_activacion o fecha_vencimiento)
    if (!remote.activa || !remote.fecha_activacion || !remote.fecha_vencimiento) {
      const actualizado = await sbActivarLicencia(codigo, remote.dias || 30);
      if (actualizado) final = actualizado;
    }

    // ── Aplicar credenciales del proveedor ──
    // CyC Admin genera usuario y contraseña al crear la licencia.
    // Al activarla acá, las aplicamos para que el admin ingrese con esas credenciales.
    if (final.usuario_admin) {
      localStorage.setItem('admin_user', final.usuario_admin);
    }
    if (final.pass_admin) {
      localStorage.setItem('admin_pass', btoa(final.pass_admin));
    }

    // ── Guardar licencia local ──
    const expira = final.fecha_vencimiento
      ? new Date(final.fecha_vencimiento).getTime()
      : Date.now() + (final.dias || 30) * 24 * 60 * 60 * 1000;

    guardarLicencia({
      valida: true,
      temporal: final.es_prueba || false,
      expira,
      dias: final.dias || 30,
      codigo,
      plan: final.plan || 'premium',
      negocio: final.nombre_negocio || '',
      usuario: final.usuario_admin || ''
    });

    return true;
  }

  // ── Fallback offline ──
  const PLANES = { '15':15,'30':30,'60':60,'90':90,'120':120,'180':180,'240':240,'300':300 };
  let dias = 30;
  for (const [k, v] of Object.entries(PLANES)) {
    if (codigo.includes(k)) { dias = v; break; }
  }
  guardarLicencia({
    valida: true, temporal: false,
    expira: Date.now() + dias * 24 * 60 * 60 * 1000,
    dias, codigo, plan: 'premium'
  });
  return true;
}

/* ══════════════════════════════════════════
   BIOMETRÍA — WebAuthn (huella, PIN, patrón)
   Usa el sensor nativo del dispositivo.
   Compatible con Android, iOS 16+, Windows Hello.
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
        rp: {
          name: 'Dulzura del Hogar',
          id: location.hostname || 'localhost'
        },
        user: {
          id: userId,
          name: localStorage.getItem('admin_user') || 'admin',
          displayName: localStorage.getItem('admin_nombre') || 'Administrador'
        },
        pubKeyCredParams: [
          { alg: -7,   type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }    // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // sensor del dispositivo (no llave externa)
          userVerification: 'required',          // exige biometría, PIN o patrón
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
  } catch (e) {
    console.warn('Registro biométrico:', e.message);
  }
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
  } catch (e) {
    console.warn('Verificación biométrica:', e.message);
    return false;
  }
}

function desactivarBiometria() {
  localStorage.removeItem(BIOMETRIA_KEY);
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

document.addEventListener('DOMContentLoaded', () => {
  if (window.location.href.includes('admin.html')) {
    mostrarInfoLicencia();
  } else {
    const el = document.getElementById('licenciaInfo');
    if (el) el.style.display = 'none';
  }
});
