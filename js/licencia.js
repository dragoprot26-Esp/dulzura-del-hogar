/* ===== licencia.js — Dulzura del Hogar ===== */

const CLAVE_LICENCIA   = 'dulzura_licencia';
const PROVEEDOR_MAIL   = 'dragoprot26@gmail.com';
const APP_ID           = 'dulzurahogar';   // Prefijo CyC Admin: DULZ-PREM-2026-XXXX

// ─── Supabase (mismo backend que CyC Admin) ───
const SB_URL = 'https://upoexzjltapiuijhszzk.supabase.co';
const SB_KEY = 'sb_publishable_Ll8-8exzAJBQYqC4YQdflg_7qvjjakP';

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

async function sbActivarLicencia(codigo) {
  try {
    const hoy = new Date().toISOString();
    await fetch(`${SB_URL}/rest/v1/licencias?codigo=eq.${encodeURIComponent(codigo)}`, {
      method: 'PATCH',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ activa: true, fecha_activacion: hoy })
    });
  } catch (e) { console.warn('sbActivarLicencia error:', e); }
}

// ─── Licencia local (localStorage) ───
function obtenerLicencia() {
  try { return JSON.parse(localStorage.getItem(CLAVE_LICENCIA) || 'null'); }
  catch (e) { return null; }
}

function guardarLicencia(obj) {
  localStorage.setItem(CLAVE_LICENCIA, JSON.stringify(obj));
}

function crearLicenciaTemporal() {
  const lic = {
    valida: true,
    temporal: true,
    expira: Date.now() + 15 * 24 * 60 * 60 * 1000,
    dias: 15,
    codigo: 'TRIAL-15',
    plan: 'prueba'
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
    const diasRestantes = Math.ceil((lic.expira - Date.now()) / (1000 * 60 * 60 * 24));
    if (diasRestantes <= 4) mostrarAvisoLicencia(diasRestantes);
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
  div.innerHTML = `
    ${msg}
    <a href="mailto:${PROVEEDOR_MAIL}" style="color:#fff;text-decoration:underline;display:block;margin-top:6px;font-size:0.82rem;">
      Contactar proveedor →
    </a>`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 10000);
}

async function activarLicencia(codigo) {
  codigo = codigo.trim().toUpperCase();
  if (!codigo || codigo.length < 5) {
    alert('⚠️ El código ingresado no es válido.');
    return false;
  }

  // Intentar validar contra Supabase
  const remote = await sbGetLicencia(codigo);
  if (remote) {
    if (!remote.activa && !remote.fecha_activacion) {
      await sbActivarLicencia(codigo);
    }
    const expira = remote.fecha_vencimiento
      ? new Date(remote.fecha_vencimiento).getTime()
      : Date.now() + 30 * 24 * 60 * 60 * 1000;
    const lic = {
      valida: true,
      temporal: remote.es_prueba || false,
      expira,
      dias: remote.dias || 30,
      codigo,
      plan: remote.plan || 'premium',
      negocio: remote.nombre_negocio || '',
      usuario: remote.usuario_admin || ''
    };
    guardarLicencia(lic);
    return true;
  }

  // Fallback offline: cualquier código > 5 chars activa licencia local
  const PLANES = {
    '15': 15, '30': 30, '60': 60,
    '90': 90, '120': 120, '180': 180,
    '240': 240, '300': 300
  };
  let dias = 30;
  for (const [k, v] of Object.entries(PLANES)) {
    if (codigo.includes(k)) { dias = v; break; }
  }
  const lic = {
    valida: true,
    temporal: false,
    expira: Date.now() + dias * 24 * 60 * 60 * 1000,
    dias,
    codigo,
    plan: 'premium'
  };
  guardarLicencia(lic);
  return true;
}

function mostrarInfoLicencia() {
  const el = document.getElementById('licenciaInfo');
  if (!el) return;
  const lic = obtenerLicencia();
  if (!lic) { el.textContent = '🔓 Sin licencia activa'; return; }
  if (!lic.valida || (lic.expira && Date.now() > lic.expira)) {
    el.innerHTML = '❌ Licencia vencida — <a href="mailto:' + PROVEEDOR_MAIL + '" style="color:inherit;">Renovar</a>';
    return;
  }
  if (lic.temporal) {
    const d = Math.ceil((lic.expira - Date.now()) / (1000 * 60 * 60 * 24));
    el.textContent = `⏳ Licencia de prueba — ${d} día${d !== 1 ? 's' : ''} restante${d !== 1 ? 's' : ''}`;
  } else {
    const d = Math.ceil((lic.expira - Date.now()) / (1000 * 60 * 60 * 24));
    el.textContent = `✅ Licencia ${lic.plan || 'premium'} — vence en ${d} días`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  mostrarInfoLicencia();
});
