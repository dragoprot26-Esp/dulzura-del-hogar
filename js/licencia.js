// =============================================
// LICENCIA DULZURA DEL HOGAR + Sincronización con Supabase
// =============================================
const CLAVE_LICENCIA = 'licencia_dulzura';
const PROVEEDOR_MAIL = 'dragoprot26@gmail.com';

// Configuración de Supabase (igual que en CyC Admin)
const SB_URL = 'https://upoexzjltapiuijhszzk.supabase.co';
const SB_KEY = 'sb_publishable_Ll8-8exzAJBQYqC4YQdflg_7qvjjakP';

// Almacenar el timestamp de la última sincronización para mostrarlo en el footer
let ultimaSincronizacion = null;

// Obtener licencia desde localStorage (sin sincronizar aún)
function obtenerLicenciaLocal() {
  const lic = localStorage.getItem(CLAVE_LICENCIA);
  if (!lic) return null;
  return JSON.parse(lic);
}

// Guardar licencia en localStorage
function guardarLicencia(licencia) {
  localStorage.setItem(CLAVE_LICENCIA, JSON.stringify(licencia));
}

// Consultar licencia en Supabase por código
async function consultarLicenciaEnSupabase(codigo) {
  if (!codigo) return null;
  try {
    const url = `${SB_URL}/rest/v1/licencias?codigo=eq.${encodeURIComponent(codigo)}&select=activa,fecha_vencimiento,plan,nombre_negocio,cliente_nombre,correo_cliente,usuario_admin,pass_admin`;
    const resp = await fetch(url, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY
      }
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.length > 0) {
      return data[0];
    }
    return null;
  } catch (e) {
    console.warn('Error consultando licencia en Supabase:', e);
    return null;
  }
}

// Sincronizar licencia local con Supabase (si existe un código válido)
// Devuelve true si hubo cambios, false si no
async function sincronizarLicenciaConSupabase() {
  const licLocal = obtenerLicenciaLocal();
  if (!licLocal || !licLocal.codigo) {
    // No hay licencia o no tiene código, no se puede sincronizar
    return false;
  }

  const supabaseData = await consultarLicenciaEnSupabase(licLocal.codigo);
  if (!supabaseData) {
    // La licencia no existe en Supabase (quizás fue eliminada) -> invalidar local
    if (licLocal.valida !== false) {
      licLocal.valida = false;
      guardarLicencia(licLocal);
      return true;
    }
    return false;
  }

  let cambios = false;

  // Comparar fecha de vencimiento
  const fechaSupabase = supabaseData.fecha_vencimiento ? new Date(supabaseData.fecha_vencimiento).getTime() : null;
  const fechaLocal = licLocal.expira || null;

  if (fechaSupabase !== fechaLocal) {
    licLocal.expira = fechaSupabase;
    cambios = true;
  }

  // Comparar estado activa
  const activaEnSupabase = supabaseData.activa === true;
  if (licLocal.valida !== activaEnSupabase) {
    licLocal.valida = activaEnSupabase;
    cambios = true;
  }

  // También podemos actualizar otros campos como plan, nombre, etc.
  if (supabaseData.plan && licLocal.plan !== supabaseData.plan) {
    licLocal.plan = supabaseData.plan;
    cambios = true;
  }

  if (cambios) {
    guardarLicencia(licLocal);
    ultimaSincronizacion = Date.now();
  }

  return cambios;
}

// Crear licencia temporal (solo para la primera vez que entra el admin)
function crearLicenciaTemporal() {
  const nuevaLic = {
    valida: true,
    expira: Date.now() + 15 * 24 * 60 * 60 * 1000,
    temporal: true,
    codigo: null, // aún sin código de Supabase, solo temporal local
    fechaInicio: new Date().toISOString()
  };
  guardarLicencia(nuevaLic);
  return nuevaLic;
}

// Verificar licencia actual (ya sincronizada)
// Esta función se llama cada vez que se necesita saber si la licencia es válida
async function verificarLicencia() {
  // Primero sincronizar con Supabase si es posible
  await sincronizarLicenciaConSupabase();

  let lic = obtenerLicenciaLocal();
  if (!lic) return false;

  const ahora = Date.now();
  if (!lic.valida || (lic.expira && ahora > lic.expira)) {
    if (lic.valida && lic.expira && ahora > lic.expira) {
      lic.valida = false;
      guardarLicencia(lic);
    }
    return false;
  }

  // Aviso si faltan 3 días o menos
  if (lic.expira) {
    const diasRest = (lic.expira - ahora) / (1000 * 3600 * 24);
    if (diasRest <= 3 && diasRest > 0) {
      mostrarAvisoLicencia(Math.ceil(diasRest));
    }
  }
  return true;
}

// Mostrar aviso flotante de vencimiento
function mostrarAvisoLicencia(dias) {
  // Evitar duplicados
  if (document.getElementById('avisoLicencia')) return;
  const divAviso = document.createElement('div');
  divAviso.id = 'avisoLicencia';
  divAviso.style.cssText = 'position:fixed; bottom:10px; left:10px; background:#FFA500; padding:10px; border-radius:8px; z-index:9999;';
  divAviso.innerHTML = `⚠️ Licencia por vencer en ${dias} días. Contacta a <a href="mailto:${PROVEEDOR_MAIL}">${PROVEEDOR_MAIL}</a> para renovar.`;
  document.body.appendChild(divAviso);
  setTimeout(() => {
    if (divAviso) divAviso.remove();
  }, 10000);
}

// Activar licencia ingresando código (se llama desde admin)
async function activarLicencia(codigo) {
  if (!codigo || codigo.length < 5) {
    alert("Código inválido. Debe tener al menos 5 caracteres.");
    return false;
  }

  // Consultar a Supabase si el código existe y está activo
  const supabaseData = await consultarLicenciaEnSupabase(codigo);
  if (!supabaseData || supabaseData.activa !== true) {
    alert("Código no válido o licencia inactiva. Contacte al proveedor.");
    return false;
  }

  // Calcular fecha de expiración desde Supabase (días restantes)
  let expira = null;
  if (supabaseData.fecha_vencimiento) {
    expira = new Date(supabaseData.fecha_vencimiento).getTime();
  } else {
    // Si no tiene fecha, asignar 60 días por defecto
    expira = Date.now() + 60 * 24 * 60 * 60 * 1000;
  }

  const nuevaLic = {
    valida: true,
    expira: expira,
    temporal: false,
    codigo: codigo,
    plan: supabaseData.plan || 'premium',
    negocio: supabaseData.nombre_negocio || supabaseData.cliente_nombre || '',
    email: supabaseData.correo_cliente || '',
    usuario: supabaseData.usuario_admin || '',
    pass: supabaseData.pass_admin || ''
  };
  guardarLicencia(nuevaLic);
  ultimaSincronizacion = Date.now();
  alert("¡Licencia activada correctamente!");
  return true;
}

// Mostrar información de licencia en footer (formato texto)
function mostrarInfoLicencia() {
  const lic = obtenerLicenciaLocal();
  const infoDiv = document.getElementById('licenciaInfo');
  if (!infoDiv) return;

  if (!lic) {
    infoDiv.innerHTML = `🔑 Sin licencia activa. <a href="mailto:${PROVEEDOR_MAIL}">Contactar proveedor</a>`;
  } else if (lic.temporal && lic.valida) {
    const diasRest = lic.expira ? Math.ceil((lic.expira - Date.now()) / (1000*3600*24)) : 0;
    infoDiv.innerHTML = `🔑 Licencia temporal: ${diasRest} días restantes. <a href="mailto:${PROVEEDOR_MAIL}">Contactar proveedor</a>`;
  } else if (!lic.valida) {
    infoDiv.innerHTML = `❌ Licencia vencida. Por favor contacte a <a href="mailto:${PROVEEDOR_MAIL}">${PROVEEDOR_MAIL}</a> para renovar.`;
  } else {
    // Licencia permanente
    let diasRest = '';
    if (lic.expira) {
      const dias = Math.ceil((lic.expira - Date.now()) / (1000*3600*24));
      diasRest = ` (${dias} días restantes)`;
    }
    infoDiv.innerHTML = `✅ Licencia activa${diasRest} | Última sincronización: ${formatearTiempoDesde(ultimaSincronizacion)}`;
  }
}

// Formatea el tiempo desde un timestamp en segundos/minutos
function formatearTiempoDesde(timestamp) {
  if (!timestamp) return 'nunca';
  const segundos = Math.floor((Date.now() - timestamp) / 1000);
  if (segundos < 60) return `hace ${segundos} seg`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

// Iniciar sincronización periódica (cada 30 segundos)
let intervaloId = null;
function iniciarSincronizacionPeriodica() {
  if (intervaloId) clearInterval(intervaloId);
  intervaloId = setInterval(async () => {
    const huboCambios = await sincronizarLicenciaConSupabase();
    if (huboCambios) {
      // Si hubo cambios, refrescar la interfaz (por ejemplo, volver a mostrar info y verificar)
      mostrarInfoLicencia();
      // Si estamos en el panel de admin, también podríamos recargar datos sensibles
      if (window.location.pathname.includes('admin.html')) {
        // Disparar evento personalizado para que admin.js pueda reaccionar
        window.dispatchEvent(new CustomEvent('licenciaActualizada'));
      }
    } else {
      // Aunque no haya cambios, actualizar el texto de última sincronización en el footer
      mostrarInfoLicencia();
    }
  }, 30000); // 30 segundos
}

// Detener sincronización (por ejemplo al cerrar sesión)
function detenerSincronizacionPeriodica() {
  if (intervaloId) {
    clearInterval(intervaloId);
    intervaloId = null;
  }
}

// Exponer funciones globales que se usan desde otros archivos
window.verificarLicencia = verificarLicencia;
window.activarLicencia = activarLicencia;
window.mostrarInfoLicencia = mostrarInfoLicencia;
window.iniciarSincronizacionPeriodica = iniciarSincronizacionPeriodica;
window.detenerSincronizacionPeriodica = detenerSincronizacionPeriodica;
window.sincronizarLicenciaConSupabase = sincronizarLicenciaConSupabase;

// Ejecutar al cargar la página (solo muestra info, no bloquea)
document.addEventListener('DOMContentLoaded', () => {
  mostrarInfoLicencia();
  // No iniciar el intervalo aquí porque puede que queramos controlarlo desde index.js o admin.js
});