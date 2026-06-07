/* ===== index.js — Dulzura del Hogar (página pública) ===== */

/* En modo tienda pública (?tienda=CODIGO) los datos salen de la nube,
   no del localStorage de quien mira. Así el cliente ve la tienda del inquilino. */
let _tiendaData = null;
let _tiendaCodigo = null;
let _pedidoActual = null;   // {productoId, producto, precio} — vale para productos y promos

function _dGet(key, def) {
  if (_tiendaData) {
    const v = _tiendaData[key];
    return (v !== undefined && v !== null) ? v : (def || '');
  }
  const v = localStorage.getItem(key);
  return (v !== null && v !== undefined) ? v : (def || '');
}
function _dProductos() {
  if (_tiendaData) { try { return JSON.parse(_tiendaData.productos || '[]'); } catch (e) { return []; } }
  return getProductos();
}
function _dPromos() {
  if (_tiendaData) { try { return JSON.parse(_tiendaData.promos || '[]'); } catch (e) { return []; } }
  return JSON.parse(localStorage.getItem('promos') || '[]');
}

async function cargarTiendaPublica(codigo) {
  _tiendaCodigo = codigo;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/dulzura_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    let rows = [];
    if (res.ok) rows = await res.json();
    _tiendaData = (rows && rows.length && rows[0].datos) ? rows[0].datos : {};
  } catch (e) { console.warn('tienda pública:', e); _tiendaData = {}; }
  // En modo público ocultamos el botón del dueño (Admin)
  ['btnLoginAdmin'].forEach(id => {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const codigoTienda = new URLSearchParams(location.search).get('tienda');
  if (codigoTienda) await cargarTiendaPublica(codigoTienda);
  aplicarApariencia();
  cargarProductos();
  cargarPromociones();
  cargarFooter();
  setupEventosPublicos();
});

/* ── Apariencia (logo + nombre guardado por el admin) ── */
function aplicarApariencia() {
  const nombre = _dGet('app_nombre', 'Dulzura del Hogar');
  const emoji  = _dGet('app_emoji', '🍰');
  const logo   = _dGet('app_logo', '');

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

/* ── Footer dinámico ── */
function cargarFooter() {
  const tel   = _dGet('admin_telefono', '5491112345678');
  const email = _dGet('admin_email', 'contacto@dulzurahogar.com');
  const linkWA   = document.getElementById('linkWA');
  const linkMail = document.getElementById('linkMail');
  if (linkWA)   linkWA.href   = `https://wa.me/${tel.replace(/\D/g,'')}`;
  if (linkMail) linkMail.href = `mailto:${email}`;
}

/* ── Render productos ── */
function cargarProductos() {
  const cont = document.getElementById('productos');
  if (!cont) return;
  const prods = _dProductos();
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

/* ── Render promociones ── */
function cargarPromociones() {
  const cont = document.getElementById('contenidoPromos');
  if (!cont) return;

  // Promos del inquilino (nube en modo público, localStorage en el dueño)
  const promos = _dPromos();

  if (promos.length > 0) {
    cont.innerHTML = promos.map(pr => `
      <div class="promo-card">
        ${pr.imagen ? `<img src="${pr.imagen}" alt="" style="width:100%;height:80px;object-fit:cover;border-radius:10px;margin-bottom:8px;">` : ''}
        ${pr.badge ? `<span class="promo-badge">${pr.badge}</span>` : ''}
        <div class="promo-titulo">${pr.titulo}</div>
        ${pr.descripcion ? `<p style="font-size:0.83rem;color:var(--text2);">${pr.descripcion}</p>` : ''}
        ${pr.precio ? `<div style="font-weight:700;color:var(--primary-dark);margin-top:4px;">${formatPrecio(pr.precio)}</div>` : ''}
        <button class="btn btn-primary promo-encargar" data-id="${pr.id}" data-titulo="${pr.titulo}" data-precio="${pr.precio || 0}" style="margin-top:8px;width:100%;font-size:0.85rem;padding:8px;">🛒 Encargar</button>
      </div>`).join('');
  } else if (_tiendaData) {
    // Tienda pública sin promos: no mostramos las genéricas
    cont.innerHTML = '';
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

  // Enlace "Primera vez" dentro del login: abre la activación de licencia
  document.getElementById('linkActivarLic')?.addEventListener('click', () => {
    document.getElementById('modalLogin')?.classList.remove('activo');
    document.getElementById('modalLicencia')?.classList.add('activo');
  });
  document.getElementById('activarLicenciaBtn')?.addEventListener('click', activarLicenciaPublica);
  document.getElementById('inputCodigoPub')?.addEventListener('keydown', e => { if (e.key === 'Enter') activarLicenciaPublica(); });

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
    const prod = _dProductos().find(p => p.id === btn.dataset.id);
    if (!prod) return;
    abrirPedidoItem(prod.id, prod.nombre, prod.precio);
  });

  document.getElementById('contenidoPromos')?.addEventListener('click', e => {
    const btn = e.target.closest('.promo-encargar');
    if (!btn) return;
    abrirPedidoItem('promo-' + btn.dataset.id, '🎁 ' + btn.dataset.titulo, parseFloat(btn.dataset.precio) || 0);
  });

  document.getElementById('enviarPedido')?.addEventListener('click', enviarPedido);
}

function abrirPedidoItem(id, nombre, precio) {
  _pedidoActual = { productoId: id, producto: nombre, precio: precio || 0 };
  document.getElementById('pedidoProductoId').value = id;
  document.getElementById('pedidoProductoNombre').textContent = nombre;
  document.getElementById('pedidoPrecio').textContent = precio ? formatPrecio(precio) : 'A coordinar';
  ['pedidoNombre','pedidoTelefono','pedidoDireccion'].forEach(i => {
    const el = document.getElementById(i); if (el) el.value = '';
  });
  document.getElementById('pedidoCantidad').value = 1;
  document.getElementById('modalPedido').classList.add('activo');
}

function intentarLogin() {
  const user  = document.getElementById('loginUser').value.trim();
  const pass  = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  if (!user || !pass) { mostrarError(errEl, 'Completá usuario y contraseña.'); return; }
  if (loginAdmin(user, pass)) {
    document.getElementById('modalLogin').classList.remove('activo');
    window.location.href = 'admin.html';
  } else {
    mostrarError(errEl, '⚠️ Usuario o contraseña incorrectos.');
    document.getElementById('loginPass').value = '';
  }
}

async function activarLicenciaPublica() {
  const codigo = (document.getElementById('inputCodigoPub')?.value || '').trim().toUpperCase();
  const msg = document.getElementById('licenciaMsg');
  const mostrar = (texto, ok) => {
    if (!msg) return;
    msg.textContent = texto;
    msg.style.display = 'block';
    msg.style.background = ok ? '#dcfce7' : '#fee2e2';
    msg.style.color = ok ? '#166534' : '#991b1b';
  };
  if (!codigo || codigo.length < 5) { mostrar('\u26a0\ufe0f Ingresá un código válido.', false); return; }
  mostrar('\ud83d\udd04 Validando código...', true);
  const ok = await activarLicencia(codigo);
  if (ok) {
    sessionStorage.removeItem('admin_logged'); // cerrar sesión: que entre con sus credenciales
    let usuario = '';
    try { usuario = (obtenerLicencia() || {}).usuario || ''; } catch (e) {}
    const cred = usuario
      ? '\u2705 ¡Licencia activada! Te llevamos al ingreso. Entrá con tu usuario \u00ab' + usuario + '\u00bb y tu contraseña.'
      : '\u2705 ¡Licencia activada! Entrá en \ud83d\udd10 Admin con las credenciales de tu licencia.';
    mostrar(cred, true);
    setTimeout(() => {
      document.getElementById('modalLicencia')?.classList.remove('activo');
      const lu = document.getElementById('loginUser'); if (lu && usuario) lu.value = usuario;
      document.getElementById('modalLogin')?.classList.add('activo');
      document.getElementById('loginPass')?.focus();
    }, 2200);
  } else {
    mostrar('\u274c Código inválido o no encontrado.', false);
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

  const item = _pedidoActual;
  if (!item) return;
  const precio = item.precio || 0;

  const pedido = {
    id: uid(), productoId: item.productoId, producto: item.producto,
    precio: precio, cantidad, total: precio * cantidad,
    comprador: nombre, telefono, direccion, fecha: Date.now(), estado: 'pendiente'
  };
  // Solo guardamos el pedido localmente cuando es el propio dueño (no en la tienda pública)
  if (!_tiendaData) {
    const pedidos = getPedidos();
    pedidos.push(pedido);
    setPedidos(pedidos);
  } else {
    // Cliente en la tienda pública: el encargo va a la nube del inquilino (lo verá en Pedidos)
    guardarPedidoEnNube(pedido);
  }

  document.getElementById('modalPedido').classList.remove('activo');

  // Avisar por WhatsApp al teléfono del inquilino
  const adminTel = _dGet('admin_telefono', '');
  const appNombre = _dGet('app_nombre', 'Dulzura del Hogar');
  if (adminTel) {
    const totalTxt = precio ? formatPrecio(precio * cantidad) : 'a coordinar';
    const msg = `🍰 *Nuevo encargo — ${appNombre}*\n\n👤 *Cliente:* ${nombre}\n📱 *Teléfono:* ${telefono}\n🛍️ *Pedido:* ${item.producto} × ${cantidad}\n💰 *Total:* ${totalTxt}${direccion ? '\n📍 *Dirección:* ' + direccion : ''}`;
    window.open(`https://wa.me/${adminTel.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  mostrarToast(`✅ ¡Encargo enviado! Te contactaremos pronto, ${nombre.split(' ')[0]} 🎉`);
}

/* Guarda el encargo del cliente en la nube del inquilino (lee, agrega y reescribe) */
async function guardarPedidoEnNube(pedido) {
  if (!_tiendaCodigo) return;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/dulzura_backups?tenant_id=eq.${encodeURIComponent(_tiendaCodigo)}&select=datos&limit=1&_ts=${Date.now()}`,
      { cache: 'no-store', headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Cache-Control': 'no-cache' } }
    );
    let datos = {};
    if (res.ok) { const rows = await res.json(); if (rows && rows.length && rows[0].datos) datos = rows[0].datos; }
    let pedidos = [];
    try { pedidos = JSON.parse(datos.pedidos || '[]'); } catch (e) { pedidos = []; }
    pedidos.push(pedido);
    datos.pedidos = JSON.stringify(pedidos);
    await fetch(`${SB_URL}/rest/v1/dulzura_backups?on_conflict=tenant_id`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ tenant_id: _tiendaCodigo, datos, updated_at: new Date().toISOString() })
    });
  } catch (e) { console.warn('guardar pedido nube:', e); }
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
