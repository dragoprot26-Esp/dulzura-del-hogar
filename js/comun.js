/* ===== comun.js — Dulzura del Hogar ===== */

const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';    // ← reemplazar
const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';   // ← reemplazar
const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';     // ← reemplazar

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
  if (!localStorage.getItem('admin_user'))
    localStorage.setItem('admin_user', 'admin');
  if (!localStorage.getItem('admin_pass'))
    localStorage.setItem('admin_pass', btoa('1234'));
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
  const u = localStorage.getItem('admin_user');
  const p = atob(localStorage.getItem('admin_pass'));
  if (user === u && pass === p) {
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
  const pass = atob(localStorage.getItem('admin_pass'));

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
