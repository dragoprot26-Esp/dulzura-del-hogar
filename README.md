# 🍰 Dulzura del Hogar — PWA

Aplicación web progresiva (PWA) para vender artesanías y comidas caseras.

---

## 📁 Estructura

```
dulzura-hogar/
├── index.html          ← Página pública (productos, pedidos)
├── admin.html          ← Panel de administración
├── manifest.json       ← PWA manifest
├── css/
│   └── estilos.css     ← Estilos + 4 temas visuales
├── js/
│   ├── comun.js        ← Funciones compartidas (auth, datos, helpers)
│   ├── licencia.js     ← Sistema de licencias (local + Supabase CyC Admin)
│   ├── index.js        ← Lógica página pública
│   └── admin.js        ← Lógica panel admin
└── img/                ← Iconos PWA (agregar icon-192.png y icon-512.png)
```

---

## 🚀 Configuración inicial

### 1. EmailJS (recuperación de contraseña)
1. Registrarse en [emailjs.com](https://emailjs.com)
2. Crear servicio (Gmail/Outlook)
3. Crear plantilla con variables: `{{to_email}}` y `{{message}}`
4. En `js/comun.js`, reemplazar:
   ```js
   const EMAILJS_SERVICE_ID  = 'TU_SERVICE_ID';
   const EMAILJS_TEMPLATE_ID = 'TU_TEMPLATE_ID';
   const EMAILJS_PUBLIC_KEY  = 'TU_PUBLIC_KEY';
   ```

### 2. Licencias (CyC Admin)
El sistema de licencias se conecta automáticamente al backend Supabase de CyC Admin.
- Los códigos de licencia se generan desde el panel CyC Admin
- Prefijo configurado: `DULZ`
- Sin conexión: cualquier código de más de 5 caracteres activa licencia local

### 3. Iconos PWA
Agregar en la carpeta `img/`:
- `icon-192.png` (192×192 px)
- `icon-512.png` (512×512 px)

---

## 🔐 Credenciales por defecto

| Campo | Valor |
|-------|-------|
| Usuario | `admin` |
| Contraseña | `1234` |

**Cambiar desde el panel: Sección "Mi cuenta" → Cambiar contraseña**

---

## 🎨 Temas disponibles

- ☀️ **Claro** — Cálido, tonos naranja y crema
- 🌙 **Oscuro** — Elegante, fondo oscuro con toques naranjas
- 🎄 **Navidad** — Rojo y verde festivo
- 🌸 **Floral** — Lila y rosa delicado

---

## 🌐 Despliegue en Vercel / Netlify

1. Subir la carpeta `dulzura-hogar/` a GitHub
2. Conectar el repositorio a Vercel o Netlify
3. Deploy automático ✅

---

## 📋 Funciones del panel admin

- **Productos**: agregar, editar, eliminar con campos extra dinámicos
- **Promociones**: gestión de ofertas especiales
- **Pedidos**: ver pendientes, marcar como completados, notificación campanita
- **Temas**: cambio visual en tiempo real
- **Licencia**: activar códigos del proveedor CyC Admin
- **Mi cuenta**: editar datos, cambiar contraseña
- **Compartir app**: enviar por WhatsApp o copiar link

---

## ⚙️ Sistema de licencias

| Tipo | Duración | Activación |
|------|----------|-----------|
| Prueba | 15 días | Automática al primer login |
| Código CyC Admin | 15–300 días | Manual desde panel |

Proveedor: [dragoprot26@gmail.com](mailto:dragoprot26@gmail.com)
