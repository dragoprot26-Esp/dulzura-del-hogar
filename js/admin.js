/* ===== admin.js — Dulzura del Hogar ===== */

// ─── Guard de sesión ───
(function() {
  if (!isAdminLogged()) { window.location.href = 'index.html'; return; }
  if (!verificarLicencia()) { alert('Tu licencia venció o no está activa. Activala desde la pantalla de inicio.'); logoutAdmin(); }
})();

/* ─── DOMContentLoaded ─── */
document.addEventListener('DOMContentLoaded', () => {
  aplicarTema();
  cargarApariencia();
  cargarDatosAdmin();
  cargarProductosAdmin();
  cargarPedidosAdmin();
  cargarPromosAdmin();
  sincronizarSelectorTema();
  configurarEventosAdmin();
  actualizarLicenciaUI();
  mostrarInfoLicencia();
  cargarLinkTienda();
  mostrarBienvenida();
  // Avisos de encargos en vivo: revisa la nube cada 20 s
  setTimeout(refrescarPedidosNube, 3000);
  setInterval(refrescarPedidosNube, 20000);
});

/* ─── Encargos nuevos desde la nube (campanita en vivo) ─── */
async function refrescarPedidosNube() {
  let codigo = '';
  try { codigo = (obtenerLicencia() || {}).codigo || ''; } catch (e) {}
  if (!codigo || codigo === 'TRIAL-15') return;
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/dulzura_backups?tenant_id=eq.${encodeURIComponent(codigo)}&select=datos&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (!rows || !rows.length || !rows[0].datos) return;
    let nube = [];
    try { nube = JSON.parse(rows[0].datos.pedidos || '[]'); } catch (e) { return; }
    const locales = getPedidos();
    const map = {};
    locales.forEach(p => { map[p.id] = p; });   // lo local manda para los que ya existen
    let nuevos = 0;
    nube.forEach(p => { if (!map[p.id]) { map[p.id] = p; nuevos++; } });
    if (nuevos > 0) {
      setPedidos(Object.values(map));
      cargarPedidosAdmin();
      try { toast(nuevos === 1 ? '🔔 ¡Nuevo encargo recibido!' : `🔔 ${nuevos} encargos nuevos`); } catch (e) {}
    }
  } catch (e) { /* silencio: reintenta en el próximo ciclo */ }
}

/* ─── Bienvenida al nuevo inquilino ─── */
function mostrarBienvenida() {
  const cliente = sessionStorage.getItem('dulzura_bienvenida');
  if (!cliente) return;
  sessionStorage.removeItem('dulzura_bienvenida');
  const negocio = localStorage.getItem('app_nombre') || 'tu tienda';
  const nombre = (cliente && cliente !== '1') ? cliente.split(' ')[0] : '';
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:99999;padding:20px;';
  ov.innerHTML = `
    <div style="background:#fff;max-width:420px;width:100%;border-radius:24px;padding:32px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
      <div style="font-size:3rem;margin-bottom:6px;">🎂✨</div>
      <h2 style="margin:0 0 10px;color:#7a3b1f;font-size:1.5rem;">¡Bienvenido/a${nombre ? ', ' + nombre : ''}!</h2>
      <p style="color:#555;font-size:0.95rem;line-height:1.5;margin:0 0 8px;">Tu tienda <strong>${negocio}</strong> ya está activa y lista. 🧁</p>
      <p style="color:#777;font-size:0.85rem;line-height:1.5;margin:0 0 22px;">Cargá tus productos desde <strong>📦 Productos</strong>, dale tu estilo en <strong>🎨 Apariencia</strong>, y compartí tu tienda con el <strong>QR</strong> desde <strong>👤 Mi cuenta</strong>. ¡A endulzar el mundo!</p>
      <button id="btnBienvenidaOk" style="background:#c0633b;color:#fff;border:none;padding:13px 28px;border-radius:14px;font-weight:700;font-size:0.95rem;cursor:pointer;">Empezar 🚀</button>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => ov.remove();
  ov.addEventListener('click', e => { if (e.target === ov) cerrar(); });
  ov.querySelector('#btnBienvenidaOk')?.addEventListener('click', cerrar);
}

/* ─── Navegación sidebar ─── */
function irSeccion(id) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('activo'));
  document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('activo'));
  document.getElementById(id)?.classList.add('activo');
  const link = document.querySelector(`.sidebar-menu [data-sec="${id}"]`);
  if (link) link.closest('li').classList.add('activo');
}

/* ══════════════════════════════════════════
   APARIENCIA — Logo y nombre
══════════════════════════════════════════ */
let logoBase64 = ''; // imagen subida como base64

function cargarApariencia() {
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  const emoji  = localStorage.getItem('app_emoji')  || '🍰';
  const logo   = localStorage.getItem('app_logo')   || '';

  // Inputs
  const inpNombre = document.getElementById('inputNombreApp');
  if (inpNombre) inpNombre.value = nombre;

  // Marcar emoji activo
  document.querySelectorAll('.emoji-opt').forEach(e => {
    e.classList.toggle('seleccionado', e.dataset.e === emoji);
  });

  // Preview barra nav
  actualizarNavBrand(nombre, emoji, logo);
  actualizarPreviewApariencia(nombre, emoji, logo);

  logoBase64 = logo;
}

function actualizarNavBrand(nombre, emoji, logo) {
  const emojiEl = document.getElementById('navLogoEmoji');
  const imgEl   = document.getElementById('navLogoImg');
  const nameEl  = document.getElementById('navNombreApp');

  if (nameEl) nameEl.textContent = nombre;

  if (logo) {
    if (emojiEl) emojiEl.style.display = 'none';
    if (imgEl)   { imgEl.src = logo; imgEl.style.display = 'block'; }
  } else {
    if (emojiEl) { emojiEl.textContent = emoji; emojiEl.style.display = 'inline'; }
    if (imgEl)   imgEl.style.display = 'none';
  }
}

function actualizarPreviewApariencia(nombre, emoji, logo) {
  const wrap   = document.getElementById('logoPreviewWrap');
  const preview = document.getElementById('nombrePreview');
  if (preview) preview.textContent = nombre;
  if (!wrap) return;
  if (logo) {
    wrap.innerHTML = `<img src="${logo}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;">`;
  } else {
    wrap.textContent = emoji;
    wrap.style.fontSize = '2rem';
  }
}

function guardarApariencia() {
  const nombre = document.getElementById('inputNombreApp')?.value.trim() || 'Dulzura del Hogar';
  const emoji  = document.querySelector('.emoji-opt.seleccionado')?.dataset.e || '🍰';
  const logo   = logoBase64;

  localStorage.setItem('app_nombre', nombre);
  localStorage.setItem('app_emoji',  emoji);
  localStorage.setItem('app_logo',   logo);

  actualizarNavBrand(nombre, emoji, logo);
  actualizarPreviewApariencia(nombre, emoji, logo);

  // Actualizar título de la pestaña
  document.title = 'Panel Admin — ' + nombre;

  toast('✅ Logo y nombre guardados');
}

function quitarLogoImagen() {
  logoBase64 = '';
  document.getElementById('prodImagenPreviewLogo') && (document.getElementById('prodImagenPreviewLogo').src = '');
  document.getElementById('logoFileNombre') && (document.getElementById('logoFileNombre').textContent = '');
  // Restaurar preview con emoji
  const emoji = document.querySelector('.emoji-opt.seleccionado')?.dataset.e || '🍰';
  const nombre = document.getElementById('inputNombreApp')?.value.trim() || 'Dulzura del Hogar';
  actualizarPreviewApariencia(nombre, emoji, '');
  toast('Logo eliminado — se usará el emoji');
}

/* ══════════════════════════════════════════
   DATOS ADMIN
══════════════════════════════════════════ */
function cargarDatosAdmin() {
  const nombre = localStorage.getItem('admin_nombre') || 'Administradora';
  const email  = localStorage.getItem('admin_email')  || '';
  const tel    = localStorage.getItem('admin_telefono') || '';

  if (document.getElementById('adminNombre'))   document.getElementById('adminNombre').value = nombre;
  if (document.getElementById('adminEmail'))    document.getElementById('adminEmail').value  = email;
  if (document.getElementById('adminTelefono')) document.getElementById('adminTelefono').value = tel;

  const saludo = document.getElementById('saludoAdmin');
  if (saludo) saludo.textContent = `¡Hola, ${nombre.split(' ')[0]}! 👋`;
  actualizarStats();
}

function guardarDatosAdmin() {
  const n = document.getElementById('adminNombre')?.value.trim();
  const e = document.getElementById('adminEmail')?.value.trim();
  const t = document.getElementById('adminTelefono')?.value.trim();
  if (n) localStorage.setItem('admin_nombre', n);
  if (e) localStorage.setItem('admin_email', e);
  if (t) localStorage.setItem('admin_telefono', t);
  const saludo = document.getElementById('saludoAdmin');
  if (saludo) saludo.textContent = `¡Hola, ${(n||'').split(' ')[0]}! 👋`;
  cargarLinkTienda();
  toast('✅ Datos guardados');
}

function actualizarStats() {
  const prods   = getProductos();
  const pedidos = getPedidos();
  const pend    = pedidos.filter(p => p.estado === 'pendiente').length;
  const comp    = pedidos.filter(p => p.estado === 'completado').length;
  setText('statProductos', prods.length);
  setText('statPedidosPend', pend);
  setText('statPedidosComp', comp);
  actualizarBadgeBell(pend);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

/* ══════════════════════════════════════════
   CAMPANITA — Badge con texto
══════════════════════════════════════════ */
function actualizarBadgeBell(n) {
  const badge = document.getElementById('bellBadge');
  if (!badge) return;
  if (n <= 0) {
    badge.classList.remove('visible');
    badge.style.display = 'none';
    return;
  }
  badge.style.display = 'inline-block';
  badge.classList.add('visible');
  badge.textContent = n === 1 ? '1 Encargo' : `${n} Encargos`;
}

/* ══════════════════════════════════════════
   PRODUCTOS
══════════════════════════════════════════ */
let editandoProductoId = null;
let imagenProductoActual = ''; // base64 o URL

function cargarProductosAdmin() {
  const cont = document.getElementById('listaProductosAdmin');
  if (!cont) return;
  const prods = getProductos();
  if (prods.length === 0) {
    cont.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:28px;">No hay productos aún. ¡Agregá el primero!</td></tr>`;
    return;
  }
  cont.innerHTML = prods.map(p => `
    <tr>
      <td>
        ${p.imagen
          ? `<img src="${p.imagen}" style="width:46px;height:46px;object-fit:cover;border-radius:8px;" onerror="this.style.display='none'">`
          : `<span style="font-size:1.6rem;">🍬</span>`}
      </td>
      <td><strong>${p.nombre}</strong></td>
      <td>${formatPrecio(p.precio)}</td>
      <td class="text-muted" style="font-size:0.81rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.detalle || '—'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" onclick="editarProducto('${p.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarProducto('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
  actualizarStats();
}

function abrirModalProducto() {
  editandoProductoId  = null;
  imagenProductoActual = '';
  document.getElementById('modalProdTitulo').textContent = '➕ Agregar producto';
  document.getElementById('prodNombre').value   = '';
  document.getElementById('prodPrecio').value   = '';
  document.getElementById('prodImagen').value   = '';
  document.getElementById('prodDetalle').value  = '';
  document.getElementById('camposExtraContainer').innerHTML = '';
  document.getElementById('urlImagenWrap').style.display   = 'none';
  resetPreviewProducto();
  document.getElementById('modalProducto').classList.add('activo');
}

function editarProducto(id) {
  const prod = getProductos().find(p => p.id === id);
  if (!prod) return;
  editandoProductoId   = id;
  imagenProductoActual = prod.imagen || '';
  document.getElementById('modalProdTitulo').textContent = '✏️ Editar producto';
  document.getElementById('prodNombre').value   = prod.nombre;
  document.getElementById('prodPrecio').value   = prod.precio;
  document.getElementById('prodImagen').value   = prod.imagen || '';
  document.getElementById('prodDetalle').value  = prod.detalle || '';
  document.getElementById('urlImagenWrap').style.display = 'none';

  // Preview de imagen
  const prev = document.getElementById('prodImagenPreview');
  if (prod.imagen) {
    prev.innerHTML = `<img src="${prod.imagen}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    resetPreviewProducto();
  }

  // Campos extra
  const cont = document.getElementById('camposExtraContainer');
  cont.innerHTML = '';
  if (prod.extras) Object.entries(prod.extras).forEach(([k, v]) => agregarCampoExtra(k, v));

  document.getElementById('modalProducto').classList.add('activo');
}

function resetPreviewProducto() {
  const prev = document.getElementById('prodImagenPreview');
  if (prev) prev.innerHTML = '<span style="font-size:3rem;">🍬</span>';
}

function toggleUrlImagen() {
  const wrap = document.getElementById('urlImagenWrap');
  wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

function previsualizarUrlImagen(url) {
  if (!url) { resetPreviewProducto(); imagenProductoActual = ''; return; }
  imagenProductoActual = url;
  const prev = document.getElementById('prodImagenPreview');
  prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size:2rem;color:var(--danger);\\'>❌ URL inválida</span>'">`;
}

function quitarImagenProducto() {
  imagenProductoActual = '';
  document.getElementById('prodImagen').value = '';
  document.getElementById('inputImgGaleria').value = '';
  document.getElementById('inputImgCamara').value  = '';
  document.getElementById('urlImagenWrap').style.display = 'none';
  resetPreviewProducto();
}

function procesarArchivoImagen(file) {
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    toast('⚠️ La imagen es muy grande (máximo 3 MB). Intentá con una más pequeña.');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    imagenProductoActual = e.target.result;
    const prev = document.getElementById('prodImagenPreview');
    prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
    toast('✅ Imagen cargada');
  };
  reader.readAsDataURL(file);
}

function guardarProducto() {
  const nombre  = document.getElementById('prodNombre').value.trim();
  const precio  = parseFloat(document.getElementById('prodPrecio').value);
  const detalle = document.getElementById('prodDetalle').value.trim();

  if (!nombre || isNaN(precio)) { toast('⚠️ Nombre y precio son obligatorios'); return; }

  const extras = {};
  const keys = document.querySelectorAll('.campo-extra-key');
  const vals = document.querySelectorAll('.campo-extra-val');
  keys.forEach((inp, i) => {
    if (inp.value.trim()) extras[inp.value.trim()] = vals[i]?.value.trim() || '';
  });

  let prods = getProductos();
  if (editandoProductoId) {
    prods = prods.map(p => p.id === editandoProductoId
      ? { ...p, nombre, precio, imagen: imagenProductoActual, detalle, extras } : p);
    toast('✅ Producto actualizado');
  } else {
    prods.push({ id: uid(), nombre, precio, imagen: imagenProductoActual, detalle, extras });
    toast('✅ Producto agregado');
  }
  setProductos(prods);
  cargarProductosAdmin();
  document.getElementById('modalProducto').classList.remove('activo');
}

function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  setProductos(getProductos().filter(p => p.id !== id));
  cargarProductosAdmin();
  toast('🗑️ Producto eliminado');
}

function agregarCampoExtra(key = '', val = '') {
  const cont = document.getElementById('camposExtraContainer');
  const row  = document.createElement('div');
  row.className = 'campos-extra-container';
  row.innerHTML = `
    <div class="campo-extra-row">
      <input class="campo-extra-key" placeholder="Nombre del campo" value="${key}">
      <input class="campo-extra-val" placeholder="Valor" value="${val}">
      <button type="button" class="btn-remove-campo" onclick="this.closest('.campos-extra-container').remove()">✕</button>
    </div>`;
  cont.appendChild(row);
}

/* ══════════════════════════════════════════
   PROMOCIONES (con imagen y precio)
══════════════════════════════════════════ */
let editandoPromoId = null;
let imagenPromoActual = '';

function getPromos() { return JSON.parse(localStorage.getItem('promos') || '[]'); }
function setPromos(arr) { localStorage.setItem('promos', JSON.stringify(arr)); }

function cargarPromosAdmin() {
  const cont = document.getElementById('listaPromosAdmin');
  if (!cont) return;
  const promos = getPromos();
  if (!promos.length) {
    cont.innerHTML = `<tr><td colspan="5" class="text-center text-muted" style="padding:24px;">No hay promociones.</td></tr>`;
    return;
  }
  cont.innerHTML = promos.map(pr => `
    <tr>
      <td>
        ${pr.imagen
          ? `<img src="${pr.imagen}" style="width:46px;height:46px;object-fit:cover;border-radius:8px;" onerror="this.style.display='none'">`
          : `<span style="font-size:1.6rem;">🎁</span>`}
      </td>
      <td><strong>${pr.titulo}</strong></td>
      <td>${pr.precio ? formatPrecio(pr.precio) : '—'}</td>
      <td class="text-muted" style="font-size:0.82rem;">${pr.descripcion || ''}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" onclick="editarPromo('${pr.id}')">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarPromo('${pr.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function abrirModalPromo() {
  editandoPromoId = null;
  imagenPromoActual = '';
  document.getElementById('modalPromoTitulo').textContent = '➕ Agregar promoción';
  document.getElementById('promoTitulo').value = '';
  document.getElementById('promoDesc').value   = '';
  document.getElementById('promoBadge').value  = '';
  document.getElementById('promoPrecio').value = '';
  document.getElementById('promoImagenPreview').innerHTML = '<span style="font-size:3rem;">🎁</span>';
  document.getElementById('modalPromo').classList.add('activo');
}

function editarPromo(id) {
  const pr = getPromos().find(p => p.id === id);
  if (!pr) return;
  editandoPromoId = id;
  imagenPromoActual = pr.imagen || '';
  document.getElementById('modalPromoTitulo').textContent = '✏️ Editar promoción';
  document.getElementById('promoTitulo').value = pr.titulo || '';
  document.getElementById('promoDesc').value   = pr.descripcion || '';
  document.getElementById('promoBadge').value  = pr.badge || '';
  document.getElementById('promoPrecio').value = pr.precio || '';
  const prev = document.getElementById('promoImagenPreview');
  if (pr.imagen) {
    prev.innerHTML = `<img src="${pr.imagen}" style="width:100%;height:100%;object-fit:cover;">`;
  } else {
    prev.innerHTML = '<span style="font-size:3rem;">🎁</span>';
  }
  document.getElementById('modalPromo').classList.add('activo');
}

function guardarPromo() {
  const titulo = document.getElementById('promoTitulo').value.trim();
  const desc   = document.getElementById('promoDesc').value.trim();
  const badge  = document.getElementById('promoBadge').value.trim();
  const precio = parseFloat(document.getElementById('promoPrecio').value) || 0;
  if (!titulo) { toast('⚠️ El título es obligatorio'); return; }
  let promos = getPromos();
  const nueva = {
    id: editandoPromoId || uid(),
    titulo,
    descripcion: desc,
    badge,
    imagen: imagenPromoActual,
    precio
  };
  if (editandoPromoId) {
    promos = promos.map(p => p.id === editandoPromoId ? nueva : p);
    toast('✅ Promoción actualizada');
  } else {
    promos.push(nueva);
    toast('✅ Promoción agregada');
  }
  setPromos(promos);
  cargarPromosAdmin();
  document.getElementById('modalPromo').classList.remove('activo');
}

function eliminarPromo(id) {
  if (!confirm('¿Eliminar esta promoción?')) return;
  setPromos(getPromos().filter(p => p.id !== id));
  cargarPromosAdmin();
}

function quitarImagenPromo() {
  imagenPromoActual = '';
  document.getElementById('inputImgPromoGaleria').value = '';
  document.getElementById('inputImgPromoCamara').value  = '';
  const prev = document.getElementById('promoImagenPreview');
  if (prev) prev.innerHTML = '<span style="font-size:3rem;">🎁</span>';
}

function procesarArchivoPromo(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    toast('⚠️ Imagen muy grande (máx 2 MB)');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    imagenPromoActual = e.target.result;
    const prev = document.getElementById('promoImagenPreview');
    prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
}

/* ══════════════════════════════════════════
   PEDIDOS
══════════════════════════════════════════ */
function cargarPedidosAdmin() {
  const pedidos = getPedidos();
  const pend    = pedidos.filter(p => p.estado === 'pendiente').sort((a,b) => b.fecha - a.fecha);
  const comp    = pedidos.filter(p => p.estado === 'completado').sort((a,b) => b.fecha - a.fecha);

  actualizarBadgeBell(pend.length);

  const pendEl = document.getElementById('listaPedidosPend');
  const compEl = document.getElementById('listaPedidosComp');
  const drawerEl = document.getElementById('drawerPedidosCont');

  const renderPend = pend.length === 0
    ? `<div class="text-center text-muted" style="padding:24px;">🎉 Sin encargos pendientes</div>`
    : pend.map(renderPedido).join('');

  if (pendEl)   pendEl.innerHTML   = renderPend;
  if (drawerEl) drawerEl.innerHTML = renderPend;
  if (compEl)   compEl.innerHTML   = comp.length === 0
    ? `<div class="text-center text-muted" style="padding:24px;">Sin encargos completados aún.</div>`
    : comp.map(renderPedido).join('');

  actualizarStats();
}

function renderPedido(p) {
  return `
    <div class="pedido-item">
      <div class="pedido-header">
        <div>
          <div class="pedido-nombre">👤 ${p.comprador}</div>
          <div class="pedido-fecha">${formatFecha(p.fecha)}</div>
        </div>
        <span class="estado-badge estado-${p.estado}">${p.estado}</span>
      </div>
      <div class="pedido-info">
        🛍️ <strong>${p.producto}</strong> × ${p.cantidad} — ${formatPrecio((p.precio||0) * p.cantidad)}<br>
        📱 ${p.telefono}${p.direccion ? ' · 📍 ' + p.direccion : ''}
      </div>
      ${p.estado === 'pendiente'
        ? `<div style="display:flex;gap:8px;margin-top:10px;">
            <button class="btn btn-primary btn-sm" onclick="completarPedido('${p.id}')">✅ Completado</button>
            <a href="https://wa.me/${(p.telefono||'').replace(/\D/g,'')}" target="_blank" class="btn btn-ghost btn-sm">📱 WhatsApp</a>
           </div>` : ''}
    </div>`;
}

function completarPedido(id) {
  const pedidos = getPedidos().map(p => p.id === id ? { ...p, estado: 'completado' } : p);
  setPedidos(pedidos);
  cargarPedidosAdmin();
  toast('✅ Encargo marcado como completado');
}

function abrirDrawerPedidos() {
  cargarPedidosAdmin();
  const panel = document.getElementById('drawerPedidos');
  panel?.classList.add('abierto');
  // Cierre automático a los 3 segundos
  clearTimeout(panel._cierreAuto);
  panel._cierreAuto = setTimeout(() => {
    panel?.classList.remove('abierto');
  }, 3000);
}

function cerrarDrawerPedidos() {
  const panel = document.getElementById('drawerPedidos');
  panel?.classList.remove('abierto');
  clearTimeout(panel._cierreAuto);
}

/* ══════════════════════════════════════════
   TEMAS
══════════════════════════════════════════ */
function sincronizarSelectorTema() {
  const tema = localStorage.getItem('tema') || 'claro';
  document.querySelectorAll('.tema-opcion').forEach(opt => {
    opt.classList.toggle('seleccionado', opt.dataset.tema === tema);
  });
}

function seleccionarTema(tema) {
  document.querySelectorAll('.tema-opcion').forEach(opt => {
    opt.classList.toggle('seleccionado', opt.dataset.tema === tema);
  });
  localStorage.setItem('tema', tema);
  aplicarTema();
  toast('🎨 Tema aplicado: ' + tema);
}

/* ══════════════════════════════════════════
   COMPARTIR
══════════════════════════════════════════ */
function getLinkTienda() {
  const base = window.location.href.replace('admin.html', 'index.html').split('?')[0].split('#')[0];
  let codigo = '';
  try { codigo = (obtenerLicencia() || {}).codigo || ''; } catch (e) {}
  // El link de la tienda lleva el código del inquilino para que cargue SUS productos desde la nube
  return codigo ? (base + '?tienda=' + encodeURIComponent(codigo)) : base;
}

function cargarLinkTienda() {
  const el = document.getElementById('linkTienda');
  if (el) el.value = getLinkTienda();
  generarQRTienda();
}

function generarQRTienda() {
  const wrap = document.getElementById('qrTiendaWrap');
  const img  = document.getElementById('qrTiendaImg');
  const link = getLinkTienda();
  if (!wrap || !img) return;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(link)}`;
  img.src = qrUrl;
  img.onload = () => { wrap.style.display = 'block'; };
  img.onerror = () => { wrap.style.display = 'none'; };
}

function descargarQR() {
  const link   = getLinkTienda();
  const nombre = (localStorage.getItem('app_nombre') || 'tienda').replace(/\s+/g, '-').toLowerCase();
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=20&data=${encodeURIComponent(link)}`;
  const a = document.createElement('a');
  a.href     = qrUrl;
  a.target   = '_blank';
  a.download = `qr-${nombre}.png`;
  a.click();
}

function compartirQRWhatsApp() {
  const link   = getLinkTienda();
  const nombre = localStorage.getItem('app_nombre') || 'mi tienda';
  const texto  = `👗 *${nombre}*\n\nEscaneá este QR para ver todos los productos:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

function copiarLinkTienda() {
  const el = document.getElementById('linkTienda');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => toast('📋 Link copiado'));
}

function compartirWhatsApp() {
  const link   = getLinkTienda();
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  const texto  = `🍰 *${nombre}*\nArtesanías y comidas caseras elaboradas con amor 💕\n\n👉 Mirá nuestros productos:\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}

function compartirEmail() {
  const link   = getLinkTienda();
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  const asunto = `${nombre} — Tienda online`;
  const cuerpo = `¡Hola!\nTe comparto ${nombre} 🍰\n\nLink: ${link}`;
  window.location.href = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}

function compartirNativo() {
  const link   = getLinkTienda();
  const nombre = localStorage.getItem('app_nombre') || 'Dulzura del Hogar';
  if (navigator.share) {
    navigator.share({ title: nombre, text: nombre, url: link });
  } else {
    navigator.clipboard.writeText(link).then(() => toast('📋 Link copiado'));
  }
}

/* ══════════════════════════════════════════
   LICENCIA
══════════════════════════════════════════ */
function actualizarLicenciaUI() {
  const lic  = obtenerLicencia();
  const cont = document.getElementById('licenciaEstado');
  if (!cont) return;
  if (!lic || !lic.valida) {
    cont.className = 'licencia-estado licencia-error';
    cont.innerHTML = '❌ Sin licencia válida — <a href="mailto:dragoprot26@gmail.com" style="color:inherit;font-weight:700;">Contactar proveedor</a>';
    return;
  }
  const d = lic.expira ? Math.ceil((lic.expira - Date.now()) / 86400000) : 999;
  if (d <= 4) {
    cont.className = 'licencia-estado licencia-warning';
    cont.innerHTML = `⏳ Licencia de prueba — ${d} día${d!==1?'s':''} restante${d!==1?'s':''}`;
  } else {
    cont.className = 'licencia-estado licencia-ok';
    cont.innerHTML = `✅ Licencia <strong>${lic.plan || 'premium'}</strong> activa — ${d} días restantes`;
  }
}

async function activarCodigoLicencia() {
  const codigo = document.getElementById('inputCodigo')?.value.trim();
  if (!codigo) { toast('⚠️ Ingresá un código'); return; }
  toast('🔄 Validando código...');
  const ok = await activarLicencia(codigo);
  if (ok) { toast('✅ ¡Licencia activada!'); actualizarLicenciaUI(); mostrarInfoLicencia(); }
  else toast('❌ Código inválido o no encontrado');
}

/* ══════════════════════════════════════════
   CAMBIAR CONTRASEÑA
══════════════════════════════════════════ */
function cambiarContrasena() {
  const actual  = document.getElementById('passActual')?.value;
  const nueva   = document.getElementById('passNueva')?.value;
  const rep     = document.getElementById('passRepetir')?.value;
  const guardada = atob(localStorage.getItem('admin_pass') || btoa('1234'));
  if (actual !== guardada) { toast('⚠️ Contraseña actual incorrecta'); return; }
  if (!nueva || nueva.length < 4) { toast('⚠️ Mínimo 4 caracteres'); return; }
  if (nueva !== rep) { toast('⚠️ Las contraseñas no coinciden'); return; }
  localStorage.setItem('admin_pass', btoa(nueva));
  ['passActual','passNueva','passRepetir'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
  toast('✅ Contraseña cambiada');
}

/* ══════════════════════════════════════════
   EVENTOS
══════════════════════════════════════════ */
function configurarEventosAdmin() {
  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    if (confirm('¿Cerrar sesión?')) logoutAdmin();
  });

  // Apariencia — logo y nombre
  document.getElementById('btnGuardarApariencia')?.addEventListener('click', guardarApariencia);

  // Logo file input — galería
  document.getElementById('inputLogoFile')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast('⚠️ Imagen muy grande (máx 2 MB)'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      logoBase64 = ev.target.result;
      const nombre = document.getElementById('inputNombreApp')?.value.trim() || 'Dulzura del Hogar';
      const wrap   = document.getElementById('logoPreviewWrap');
      if (wrap) wrap.innerHTML = `<img src="${ev.target.result}" style="width:44px;height:44px;border-radius:10px;object-fit:cover;">`;
      const fileNombre = document.getElementById('logoFileNombre');
      if (fileNombre) fileNombre.textContent = file.name;
      actualizarNavBrand(nombre, '', ev.target.result);
      toast('✅ Logo cargado');
    };
    reader.readAsDataURL(file);
  });

  // Emoji picker
  document.querySelectorAll('.emoji-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('seleccionado'));
      opt.classList.add('seleccionado');
      logoBase64 = ''; // quitar imagen si se elige emoji
      const nombre = document.getElementById('inputNombreApp')?.value.trim() || 'Dulzura del Hogar';
      actualizarPreviewApariencia(nombre, opt.dataset.e, '');
      actualizarNavBrand(nombre, opt.dataset.e, '');
    });
  });

  // Preview nombre en tiempo real
  document.getElementById('inputNombreApp')?.addEventListener('input', e => {
    const emoji  = document.querySelector('.emoji-opt.seleccionado')?.dataset.e || '🍰';
    const prev   = document.getElementById('nombrePreview');
    if (prev) prev.textContent = e.target.value || 'Dulzura del Hogar';
    actualizarNavBrand(e.target.value || 'Dulzura del Hogar', emoji, logoBase64);
  });

  // Datos admin
  document.getElementById('btnGuardarAdmin')?.addEventListener('click', guardarDatosAdmin);

  // Productos
  document.getElementById('btnNuevoProducto')?.addEventListener('click', abrirModalProducto);
  document.getElementById('btnGuardarProducto')?.addEventListener('click', guardarProducto);
  document.getElementById('btnAgregarCampo')?.addEventListener('click', () => agregarCampoExtra());

  // Imagen desde galería
  document.getElementById('inputImgGaleria')?.addEventListener('change', e => {
    procesarArchivoImagen(e.target.files[0]);
  });
  // Imagen desde cámara
  document.getElementById('inputImgCamara')?.addEventListener('change', e => {
    procesarArchivoImagen(e.target.files[0]);
  });

  // Promos
  document.getElementById('btnNuevaPromo')?.addEventListener('click', abrirModalPromo);
  document.getElementById('btnGuardarPromo')?.addEventListener('click', guardarPromo);

  // Imagen de promo
  document.getElementById('inputImgPromoGaleria')?.addEventListener('change', e => {
    procesarArchivoPromo(e.target.files[0]);
  });
  document.getElementById('inputImgPromoCamara')?.addEventListener('change', e => {
    procesarArchivoPromo(e.target.files[0]);
  });

  // Pedidos / Drawer
  document.getElementById('bellBtn')?.addEventListener('click', abrirDrawerPedidos);
  document.getElementById('btnCerrarDrawer')?.addEventListener('click', cerrarDrawerPedidos);

  // Sidebar
  document.querySelectorAll('.sidebar-menu [data-sec]').forEach(link => {
    link.addEventListener('click', e => { e.preventDefault(); irSeccion(link.dataset.sec); });
  });

  // Vista de página: abre la tienda tal como la ve el cliente
  document.getElementById('navVistaPagina')?.addEventListener('click', e => {
    e.preventDefault();
    const url = getLinkTienda();
    window.open(url, '_blank');
  });

  // Temas
  document.querySelectorAll('.tema-opcion').forEach(opt => {
    opt.addEventListener('click', () => seleccionarTema(opt.dataset.tema));
  });

  // Licencia
  document.getElementById('btnActivarLicencia')?.addEventListener('click', activarCodigoLicencia);

  // Cambiar contraseña
  document.getElementById('btnCambiarPass')?.addEventListener('click', cambiarContrasena);

  // Cerrar modales
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay').classList.remove('activo'));
  });
  document.querySelectorAll('.modal-overlay').forEach(ov => {
    ov.addEventListener('click', e => { if (e.target === ov) ov.classList.remove('activo'); });
  });
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */
function toast(msg) {
  let t = document.getElementById('adminToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'adminToast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--nav-bg);color:var(--nav-text);padding:11px 22px;border-radius:50px;font-weight:700;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-size:0.88rem;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}
