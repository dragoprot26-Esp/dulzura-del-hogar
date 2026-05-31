/* ===== index.js — Dulzura del Hogar (página pública) ===== */
// ========== CONFIGURACIÓN DE SUPABASE (misma que en CyC Admin) ==========
const SB_URL = 'https://upoexzjltapiuijhszzk.supabase.co';
const SB_KEY = 'sb_publishable_Ll8-8exzAJBQYqC4YQdflg_7qvjjakP';

// Variables para control de sincronización
let intervaloSync = null;
let ultimaSincronizacion = 0;

document.addEventListener('DOMContentLoaded', () => {
  aplicarApariencia();
  cargarProductos();
  cargarPromociones();
  cargarFooter();
  setupEventosPublicos();

  // Iniciar sincronización periódica de la licencia con Supabase
  iniciarSincronizacionLicencia();
});

/* ── Sincronización de licencia con Supabase (polling cada 30 segundos) ── */
function iniciarSincronizacionLicencia() {
  if (intervaloSync) clearInterval(intervaloSync);
  // Ejecutar inmediatamente al cargar
  sincronizarLicenciaConSupabase();
  // Luego cada 30 segundos
  intervaloSync = setInterval(() => {
    sincronizarLicenciaConSupabase();
  }, 30000);
}

async function sincronizarLicenciaConSupabase() {
  // Obtener licencia actual desde localStorage
  const lic = obtenerLicencia(); // función existente en licencia.js
  if (!lic || !lic.codigo) {
    // Si no hay licencia guardada, no hacer nada
    actualizarTextoUltimaSync();
    return;
  }

  const codigo = lic.codigo;
  try {
    const response = await fetch(`${SB_URL}/rest/v1/licencias?codigo=eq.${encodeURIComponent(codigo)}`, {
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`
      }
    });
    if (!response.ok) {
      console.warn('Error al consultar Supabase:', response.status);
      actualizarTextoUltimaSync();
      return;
    }
    const data = await response.json();
    if (!data || data.length === 0) {
      console.warn('No se encontró licencia en Supabase para el código:', codigo);
      actualizarTextoUltimaSync();
      return;
    }
    const supabaseLic = data[0];
    // Comparar fecha de vencimiento y estado activo con los datos locales
    const localExpira = lic.expira || 0;
    const remoteExpira = supabaseLic.fecha_vencimiento ? new Date(supabaseLic.fecha_vencimiento).getTime() : 0;
    const localActiva = lic.valida === true;
    const remoteActiva = supabaseLic.activa === true;

    let cambios = false;
    if (localExpira !== remoteExpira) {
      lic.expira = remoteExpira;
      cambios = true;
    }
    if (localActiva !== remoteActiva) {
      lic.valida = remoteActiva;
      cambios = true;
    }
    // También podrías actualizar otros campos como plan, etc.
    if (cambios) {
      // Guardar licencia actualizada en localStorage
      localStorage.setItem('licencia_dulzura', JSON.stringify(lic));
      // Refrescar la interfaz para mostrar el nuevo estado
      mostrarInfoLicencia();    // función existente en licencia.js
      cargarFooter();           // para actualizar el texto de sincronización y posiblemente datos de contacto
      // Si hay un aviso de vencimiento visible, actualizarlo
      const aviso = document.getElementById('avisoLicencia');
      if (aviso) aviso.remove();
      if (lic.valida && lic.expira) {
        const diasRest = Math.ceil((lic.expira - Date.now()) / (1000*3600*24));
        if (diasRest <= 3 && diasRest > 0) {
          mostrarAvisoLicencia(diasRest);
        }
      }
      console.log('Licencia actualizada desde Supabase');
    }
  } catch (err) {
    console.error('Error en sincronización de licencia:', err);
  } finally {
    actualizarTextoUltimaSync();
  }
}

function actualizarTextoUltimaSync() {
  const syncSpan = document.getElementById('ultimaSyncTexto');
  if (!syncSpan) return;
  ultimaSincronizacion = Date.now();
  const segundos = Math.floor((ultimaSincronizacion - (window._ultimaSyncAnterior || ultimaSincronizacion)) / 1000);
  window._ultimaSyncAnterior = ultimaSincronizacion;
  syncSpan.textContent = `🔄 Última sincronización: hace ${segundos} segundos`;
  // También actualizar cada segundo aproximado (opcional)
  if (window._syncTimer) clearInterval(window._syncTimer);
  window._syncTimer = setInterval(() => {
    if (!syncSpan) return;
    const dif = Math.floor((Date.now() - ultimaSincronizacion) / 1000);
    syncSpan.textContent = `🔄 Última sincronización: hace ${dif} segundos`;
  }, 1000);
}

/* ── Footer dinámico (modificado para incluir estado de sincronización) ── */
function cargarFooter() {
  const tel   = localStorage.getItem('admin_telefono') || '5491112345678';
  const email = localStorage.getItem('admin_email')    || 'contacto@dulzurahogar.com';
  const linkWA   = document.getElementById('linkWA');
  const linkMail = document.getElementById('linkMail');
  if (linkWA)   linkWA.href   = `https://wa.me/${tel.replace(/\D/g,'')}`;
  if (linkMail) linkMail.href = `mailto:${email}`;

  // Agregar el texto de última sincronización si no existe
  let syncSpan = document.getElementById('ultimaSyncTexto');
  if (!syncSpan) {
    const footer = document.querySelector('footer');
    if (footer) {
      const div = document.createElement('div');
      div.className = 'text-muted mt-2';
      div.style.fontSize = '0.7rem';
      div.style.marginTop = '8px';
      div.style.opacity = '0.6';
      div.innerHTML = '<span id="ultimaSyncTexto">🔄 sincronizando...</span>';
      footer.appendChild(div);
      syncSpan = document.getElementById('ultimaSyncTexto');
    }
  }
  if (syncSpan) {
    if (ultimaSincronizacion === 0) {
      syncSpan.textContent = '🔄 sincronizando...';
    } else {
      const dif = Math.floor((Date.now() - ultimaSincronizacion) / 1000);
      syncSpan.textContent = `🔄 Última sincronización: hace ${dif} segundos`;
    }
  }
}

/* ── Apariencia (logo + nombre guardado por el admin) ── */
function aplicarApariencia() {
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  const emoji  = localStorage.getItem('app_emoji')  || '🍰';
  const logo   = localStorage.getItem('app_logo')   || '';

  // Navbar
  const nameEl  = document.getElementById('navNombreApp');
  const emojiEl = document.getElementById('navLogoEmoji');
  const imgEl   = document.getElementById('navLogoImg');
  if (nameEl) nameEl.textContent = nombre;
  if (logo) {
    if (emojiEl) emojiEl.style.display = 'none';
    if (imgEl)   { imgEl.src = logo; imgEl.style.display = 'block'; }
  } else {
    if (emojiEl) { emojiEl.textContent = emoji; emojiEl.style.display = 'inline'; }
    if (imgEl)   imgEl.style.display = 'none';
  }

  // Hero
  const heroLogo   = document.getElementById('heroLogo');
  const heroTitulo = document.getElementById('heroTitulo');
  if (heroTitulo) heroTitulo.textContent = nombre;
  if (heroLogo) {
    if (logo) {
      heroLogo.innerHTML = `<img src="${logo}" alt="Logo" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid rgba(255,255,255,0.3);">`;
    } else {
      heroLogo.textContent = emoji;
    }
  }

  // Título de pestaña
  document.title = nombre;
}

/* ── Render productos ── */
function cargarProductos() {
  const cont = document.getElementById('productos');
  if (!cont) return;
  const prods = getProductos();
  if (prods.length === 0) {
    cont.innerHTML = `<div class="text-center text-muted" style="padding:40px;grid-column:1/-1;">
      <div style="font-size:2.5rem;margin-bottom:8px;">🍰</div>
      <p>Aún no hay productos disponibles.</p></div>`;
    return;
  }
  cont.innerHTML = prods.map(p => `
    <div class="producto-card">
      ${p.imagen
        ? `<img src="${p.imagen}" alt="${p.nombre}" class="producto-img" onerror="this.outerHTML='<div class=\\'producto-img\\'>🍬</div>'">`
        : `<div class="producto-img">🍬</div>`}
      <div class="producto-body">
        <div class="producto-nombre">${p.nombre}</div>
        <div class="producto-detalle">${p.detalle || ''}</div>
        ${p.extras && Object.keys(p.extras).length
          ? `<div class="text-muted mb-2" style="font-size:0.78rem;">
              ${Object.entries(p.extras).map(([k,v]) => `<span style="margin-right:6px;">📌 <strong>${k}:</strong> ${v}</span>`).join('')}
            </div>` : ''}
        <div class="producto-precio">${formatPrecio(p.precio)}</div>
        <button class="btn btn-primary w-full btn-encargar" data-id="${p.id}" data-nombre="${p.nombre}">
          🛒 Encargar
        </button>
      </div>
    </div>
  `).join('');
}

/* ── Render promociones (con imagen, precio y botón WhatsApp) ── */
function cargarPromociones() {
  const cont = document.getElementById('contenidoPromos');
  if (!cont) return;

  const promos = JSON.parse(localStorage.getItem('promos') || '[]');
  const adminTel = (localStorage.getItem('admin_telefono') || '5491112345678').replace(/\D/g,'');

  if (promos.length > 0) {
    cont.innerHTML = promos.map(pr => `
      <div class="promo-card">
        ${pr.imagen ? `<img src="${pr.imagen}" style="width:100%;height:120px;object-fit:cover;border-radius:8px;margin-bottom:10px;" onerror="this.style.display='none'">` : ''}
        ${pr.badge ? `<span class="promo-badge">${pr.badge}</span>` : ''}
        <div class="promo-titulo">${pr.titulo}</div>
        ${pr.descripcion ? `<p style="font-size:0.83rem;color:var(--text2);">${pr.descripcion}</p>` : ''}
        ${pr.precio ? `<div style="font-weight:700;color:var(--primary);margin:6px 0;">${formatPrecio(pr.precio)}</div>` : ''}
        <a href="https://wa.me/${adminTel}?text=${encodeURIComponent('Hola! Me interesa la promoción: ' + pr.titulo)}" target="_blank" class="btn btn-ghost btn-sm w-full" style="text-decoration:none;">📩 Consultar</a>
      </div>`).join('');
  } else {
    // Default si no hay promos creadas
    cont.innerHTML = `
      <div class="promo-card">
        <span class="promo-badge">🎉 Especial</span>
        <div class="promo-titulo">Combo Familiar</div>
        <p style="font-size:0.83rem;color:var(--text2);">3 docenas de alfajores + 2 frascos de mermelada con <strong>20% OFF</strong>.</p>
      </div>
      <div class="promo-card">
        <span class="promo-badge">🚚 Envío</span>
        <div class="promo-titulo">Envío gratis</div>
        <p style="font-size:0.83rem;color:var(--text2);">Pedidos superiores a $5.000 dentro de la localidad.</p>
      </div>
      <div class="promo-card">
        <span class="promo-badge">📅 Reserva</span>
        <div class="promo-titulo">Encargos anticipados</div>
        <p style="font-size:0.83rem;color:var(--text2);">Reservá con 48 hs de anticipación para eventos.</p>
      </div>`;
  }
}

/* ── Eventos ── */
function setupEventosPublicos() {
  document.getElementById('btnLoginAdmin')?.addEventListener('click', () =>
    document.getElementById('modalLogin').classList.add('activo'));

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('activo'));
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('activo'); });
  });

  document.getElementById('loginBtn')?.addEventListener('click', intentarLogin);
  document.getElementById('loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') intentarLogin(); });

  document.getElementById('recuperarBtn')?.addEventListener('click', () => {
    const email = prompt('Ingresá el correo del administrador:');
    if (email) recuperarAdmin(email);
  });

  document.getElementById('productos')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-encargar');
    if (!btn) return;
    const prod = getProductos().find(p => p.id === btn.dataset.id);
    if (!prod) return;
    document.getElementById('pedidoProductoId').value    = prod.id;
    document.getElementById('pedidoProductoNombre').textContent = prod.nombre;
    document.getElementById('pedidoPrecio').textContent  = formatPrecio(prod.precio);
    ['pedidoNombre','pedidoTelefono','pedidoDireccion'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
    document.getElementById('pedidoCantidad').value = 1;
    document.getElementById('modalPedido').classList.add('activo');
  });

  document.getElementById('enviarPedido')?.addEventListener('click', enviarPedido);
}

function intentarLogin() {
  const user  = document.getElementById('loginUser').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  if (!user || !pass) { mostrarError(errEl, 'Completá usuario y contraseña.'); return; }
  if (loginAdmin(user, pass)) {
    if (!obtenerLicencia()) { crearLicenciaTemporal(); alert('🎉 ¡Período de prueba de 15 días activado!'); }
    document.getElementById('modalLogin').classList.remove('activo');
    window.location.href = 'admin.html';
  } else {
    mostrarError(errEl, '⚠️ Usuario o contraseña incorrectos.');
    document.getElementById('loginPass').value = '';
  }
}

function enviarPedido() {
  const nombre   = document.getElementById('pedidoNombre').value.trim();
  const telefono = document.getElementById('pedidoTelefono').value.trim();
  const direccion = document.getElementById('pedidoDireccion').value.trim();
  const cantidad = parseInt(document.getElementById('pedidoCantidad').value) || 1;
  const prodId   = document.getElementById('pedidoProductoId').value;
  const errEl    = document.getElementById('pedidoError');

  if (!nombre || !telefono) { mostrarError(errEl, 'Nombre y teléfono son obligatorios.'); return; }

  const prod = getProductos().find(p => p.id === prodId);
  if (!prod) return;

  const pedido = {
    id: uid(), productoId: prodId, producto: prod.nombre,
    precio: prod.precio, cantidad, total: prod.precio * cantidad,
    comprador: nombre, telefono, direccion, fecha: Date.now(), estado: 'pendiente'
  };
  const pedidos = getPedidos();
  pedidos.push(pedido);
  setPedidos(pedidos);

  document.getElementById('modalPedido').classList.remove('activo');

  // Notificar al admin por WhatsApp si hay teléfono configurado
  const adminTel = localStorage.getItem('admin_telefono');
  const appNombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  if (adminTel) {
    const msg = `🍰 *Nuevo encargo — ${appNombre}*\n\n👤 *Cliente:* ${nombre}\n📱 *Teléfono:* ${telefono}\n🛍️ *Producto:* ${prod.nombre} × ${cantidad}\n💰 *Total:* ${formatPrecio(prod.precio * cantidad)}${direccion ? '\n📍 *Dirección:* ' + direccion : ''}`;
    window.open(`https://wa.me/${adminTel.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  mostrarToast(`✅ ¡Encargo enviado! Te contactaremos pronto, ${nombre.split(' ')[0]} 🎉`);
}

function mostrarError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function mostrarToast(msg) {
  let t = document.getElementById('toastPublico');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toastPublico';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--primary);color:#fff;padding:14px 24px;border-radius:50px;font-weight:700;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);font-size:0.9rem;text-align:center;max-width:90vw;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 5000);
}