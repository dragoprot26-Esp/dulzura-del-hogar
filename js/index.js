/* ===== index.js — Dulzura del Hogar (página pública) ===== */

document.addEventListener('DOMContentLoaded', async () => {
  await cargarPublicoSiCorresponde();
  aplicarApariencia();
  cargarProductos();
  cargarPromociones();
  cargarFooter();
  setupEventosPublicos();
  actualizarBadgeCarrito();
});

// Si la URL trae ?codigo=DULZ-..., mostramos esa tienda leyendo de la nube.
async function cargarPublicoSiCorresponde() {
  const params = new URLSearchParams(location.search);
  const codigo = (params.get('codigo') || '').trim().toUpperCase();
  if (!codigo) return;
  try {
    const data = await nubePublica(codigo);
    if (data && data.activa) {
      if (data.datos) aplicarSnapshot(data.datos);
      if (data.nombre_negocio) localStorage.setItem('app_nombre', data.nombre_negocio);
    }
  } catch (e) { console.warn('público:', e); }
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

/* ── Footer dinámico ── */
function cargarFooter() {
  const tel   = localStorage.getItem('admin_telefono') || '5491112345678';
  const email = localStorage.getItem('admin_email')    || 'contacto@dulzurahogar.com';
  const linkWA   = document.getElementById('linkWA');
  const linkMail = document.getElementById('linkMail');
  if (linkWA)   linkWA.href   = `https://wa.me/${tel.replace(/\D/g,'')}`;
  if (linkMail) linkMail.href = `mailto:${email}`;
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
        <button class="btn btn-primary w-full btn-agregar" data-id="${p.id}">
          🛒 Agregar al carrito
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
        <button class="btn btn-primary btn-sm w-full btn-agregar-promo" data-id="${pr.id}" style="margin-bottom:6px;">🛒 Agregar al carrito</button>
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
  document.getElementById('btnLoginAdmin')?.addEventListener('click', () => {
    document.getElementById('modalLogin').classList.add('activo');
    // Precargar código y usuario si ya se activó una licencia antes
    const lic = obtenerLicencia();
    const inpCod  = document.getElementById('loginCodigo');
    const inpUser = document.getElementById('loginUser');
    if (lic) {
      if (inpCod  && lic.codigo)  inpCod.value  = lic.codigo;
      if (inpUser && lic.usuario) inpUser.value = lic.usuario;
    }
    // Mostrar botón biometría solo si está disponible y registrado
    const sepEl  = document.getElementById('separadorBiometria');
    const btnBio = document.getElementById('btnBiometria');
    if (biometriaDisponible() && biometriaRegistrada()) {
      if (sepEl)  sepEl.style.display  = 'flex';
      if (btnBio) btnBio.style.display = 'block';
    } else {
      if (sepEl)  sepEl.style.display  = 'none';
      if (btnBio) btnBio.style.display = 'none';
    }
  });

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('activo'));
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('activo'); });
  });

  document.getElementById('loginBtn')?.addEventListener('click', intentarLogin);
  document.getElementById('loginPass')?.addEventListener('keydown', e => { if (e.key === 'Enter') intentarLogin(); });
  document.getElementById('btnBiometria')?.addEventListener('click', intentarLoginBiometrico);

  document.getElementById('recuperarBtn')?.addEventListener('click', () => {
    const email = prompt('Ingresá el correo del administrador:');
    if (email) recuperarAdmin(email);
  });

  // Agregar al carrito desde productos
  document.getElementById('productos')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-agregar');
    if (!btn) return;
    agregarAlCarrito(btn.dataset.id, 'producto');
  });

  // Agregar al carrito desde promociones
  document.getElementById('contenidoPromos')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-agregar-promo');
    if (!btn) return;
    agregarAlCarrito(btn.dataset.id, 'promo');
  });

  // Carrito y compartir
  document.getElementById('btnCarrito')?.addEventListener('click', abrirCarrito);
  document.getElementById('btnPedidoFooter')?.addEventListener('click', abrirCarrito);
  document.getElementById('enviarCarrito')?.addEventListener('click', enviarPedidoCarrito);
  document.getElementById('vaciarCarrito')?.addEventListener('click', () => { vaciarCarrito(); mostrarToast('Carrito vaciado'); });
  document.getElementById('btnCompartirWA')?.addEventListener('click', compartirAmigosWA);
  document.getElementById('btnCompartirMail')?.addEventListener('click', compartirAmigosMail);
}

async function intentarLogin() {
  const errEl  = document.getElementById('loginError');
  const lic    = obtenerLicencia();
  const codigo = (document.getElementById('loginCodigo')?.value.trim()) || (lic && lic.codigo) || '';
  const user   = document.getElementById('loginUser').value.trim();
  const pass   = document.getElementById('loginPass').value;

  if (!codigo) { mostrarError(errEl, 'Ingresá el código de licencia.'); return; }
  if (!pass)   { mostrarError(errEl, 'Ingresá la contraseña.'); return; }

  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Ingresando...'; }

  const res = await loginDueno(codigo, user, pass);

  if (btn) { btn.disabled = false; btn.textContent = 'Ingresar →'; }

  if (res.ok) {
    document.getElementById('modalLogin').classList.remove('activo');
    window.location.href = 'admin.html';
  } else {
    mostrarError(errEl, '⚠️ ' + (res.error || 'No se pudo ingresar.'));
    document.getElementById('loginPass').value = '';
  }
}

async function intentarLoginBiometrico() {
  const errEl = document.getElementById('loginError');
  if (!biometriaDisponible()) {
    mostrarError(errEl, '⚠️ Tu dispositivo no soporta autenticación biométrica.');
    return;
  }
  if (!biometriaRegistrada()) {
    mostrarError(errEl, '⚠️ No hay biometría registrada. Ingresá una vez con contraseña y activala desde el panel.');
    return;
  }
  // La biometría es un atajo local: requiere una sesión segura ya creada antes.
  if (!sbObtenerSesion()) {
    mostrarError(errEl, '⚠️ Por seguridad, ingresá una vez con contraseña. Después podés usar la huella.');
    return;
  }
  try {
    const ok = await verificarBiometria();
    if (ok) {
      sessionStorage.setItem('admin_logged', 'true');
      document.getElementById('modalLogin').classList.remove('activo');
      window.location.href = 'admin.html';
    } else {
      mostrarError(errEl, '⚠️ No se pudo verificar tu identidad. Intentá de nuevo.');
    }
  } catch (e) {
    mostrarError(errEl, '⚠️ Autenticación cancelada.');
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

/* ═════════════════════════════════════════════
   CARRITO
═════════════════════════════════════════════ */
function getCarrito() {
  try { return JSON.parse(sessionStorage.getItem('carrito') || '[]'); }
  catch (e) { return []; }
}
function setCarrito(c) {
  sessionStorage.setItem('carrito', JSON.stringify(c));
  actualizarBadgeCarrito();
}
function actualizarBadgeCarrito() {
  const n = getCarrito().reduce((s, i) => s + i.cantidad, 0);
  const b = document.getElementById('cartBadge');
  if (b) { b.textContent = n; b.style.display = n > 0 ? 'inline-block' : 'none'; }
}
function buscarItem(id, tipo) {
  if (tipo === 'promo') return JSON.parse(localStorage.getItem('promos') || '[]').find(p => p.id === id);
  return getProductos().find(p => p.id === id);
}
function agregarAlCarrito(id, tipo) {
  const it = buscarItem(id, tipo);
  if (!it) return;
  const c = getCarrito();
  const linea = c.find(x => x.id === id && x.tipo === tipo);
  if (linea) linea.cantidad++;
  else c.push({ id, tipo, nombre: it.titulo || it.nombre, precio: Number(it.precio) || 0, cantidad: 1 });
  setCarrito(c);
  mostrarToast('🛒 Agregado al carrito');
}
function cambiarCantidad(id, tipo, delta) {
  const c = getCarrito();
  const l = c.find(x => x.id === id && x.tipo === tipo);
  if (!l) return;
  l.cantidad += delta;
  if (l.cantidad <= 0) c.splice(c.indexOf(l), 1);
  setCarrito(c);
  renderCarrito();
}
function vaciarCarrito() { setCarrito([]); renderCarrito(); }
function abrirCarrito() {
  renderCarrito();
  document.getElementById('modalCarrito').classList.add('activo');
}
function renderCarrito() {
  const cont = document.getElementById('carritoItems');
  if (!cont) return;
  const c = getCarrito();
  if (!c.length) {
    cont.innerHTML = '<p class="text-muted" style="text-align:center;padding:16px;">Tu carrito está vacío. Agregá productos o promos 🛒</p>';
  } else {
    cont.innerHTML = c.map(l => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border,#e5d5c5);">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;">${l.nombre}</div>
          <div style="font-size:0.8rem;color:var(--text2);">${formatPrecio(l.precio)} c/u</div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="cambiarCantidad('${l.id}','${l.tipo}',-1)">−</button>
        <span style="min-width:22px;text-align:center;font-weight:700;">${l.cantidad}</span>
        <button class="btn btn-ghost btn-sm" onclick="cambiarCantidad('${l.id}','${l.tipo}',1)">+</button>
        <div style="min-width:72px;text-align:right;font-weight:700;">${formatPrecio(l.precio * l.cantidad)}</div>
      </div>`).join('');
  }
  const total = c.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const tEl = document.getElementById('carritoTotal');
  if (tEl) tEl.textContent = formatPrecio(total);
}
async function enviarPedidoCarrito() {
  const errEl = document.getElementById('carritoError');
  const c = getCarrito();
  if (!c.length) { mostrarError(errEl, 'El carrito está vacío.'); return; }
  const nombre = document.getElementById('cartNombre').value.trim();
  const tel    = document.getElementById('cartTelefono').value.trim();
  const dir    = document.getElementById('cartDireccion').value.trim();
  if (!nombre || !tel) { mostrarError(errEl, 'Nombre y teléfono son obligatorios.'); return; }

  const total = c.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const appNombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';

  // Registrar el pedido en la nube del negocio (si está la función disponible)
  const codigo = (new URLSearchParams(location.search).get('codigo') || '').trim().toUpperCase();
  if (codigo) {
    const pedido = { id: uid(), items: c, total, comprador: nombre, telefono: tel, direccion: dir, fecha: Date.now(), estado: 'pendiente' };
    try { await sbRPC('dulzura_nuevo_pedido', { p_codigo: codigo, p_pedido: pedido }, { conAuth: false }); } catch (e) { /* sigue por WhatsApp igual */ }
  }

  // Armar el mensaje de WhatsApp al negocio
  const lineas = c.map(i => `• ${i.nombre} × ${i.cantidad} — ${formatPrecio(i.precio * i.cantidad)}`).join('\n');
  const msg = `🛒 *Nuevo pedido — ${appNombre}*\n\n👤 *Cliente:* ${nombre}\n📱 *Teléfono:* ${tel}${dir ? '\n📍 *Dirección:* ' + dir : ''}\n\n${lineas}\n\n*Total: ${formatPrecio(total)}*`;
  const adminTel = (localStorage.getItem('admin_telefono') || '').replace(/\D/g, '');
  if (adminTel) window.open(`https://wa.me/${adminTel}?text=${encodeURIComponent(msg)}`, '_blank');

  vaciarCarrito();
  document.getElementById('modalCarrito').classList.remove('activo');
  mostrarToast(`✅ ¡Pedido enviado! Gracias, ${nombre.split(' ')[0]} 🎉`);
}

/* ═════════════════════════════════════════════
   COMPARTIR A AMIGOS (página pública)
═════════════════════════════════════════════ */
function compartirAmigosWA() {
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  const texto = `🍰 Mirá la tienda de *${nombre}*:\n${location.href}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}
function compartirAmigosMail() {
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  const asunto = `Te comparto ${nombre}`;
  const cuerpo = `¡Hola!\nMirá la tienda de ${nombre}:\n${location.href}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
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