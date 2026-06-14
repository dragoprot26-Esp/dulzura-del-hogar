# ✅ Verificación final — Dulzura del Hogar

Clave pública (anon) para los chequeos REST:
`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjeGxoZ2RweGZ1eWJ6ZnNxdWVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA2MDIyOTQsImV4cCI6MjA5NjE3ODI5NH0.HJWpFO8TkRsmUx15GtSsUusjvVEhUsi5b_QGoPoPU00`

---

## A) Tablas cerradas (anónimo NO baja datos → debe dar `[]`)

Pegá cada link en el navegador (cambiá `<ANON>` por la clave de arriba):

```
https://pcxlhgdpxfuybzfsquem.supabase.co/rest/v1/licencias?select=*&limit=3&apikey=<ANON>
https://pcxlhgdpxfuybzfsquem.supabase.co/rest/v1/usuarios?select=*&limit=3&apikey=<ANON>
https://pcxlhgdpxfuybzfsquem.supabase.co/rest/v1/dulzura_backups?select=*&limit=3&apikey=<ANON>
https://pcxlhgdpxfuybzfsquem.supabase.co/rest/v1/dulzura_miembros?select=*&limit=3&apikey=<ANON>
```

- [ ] `licencias` → `[]`
- [ ] `usuarios` → `[]`
- [ ] `dulzura_backups` → `[]`
- [ ] `dulzura_miembros` → `[]`

Si alguna muestra datos → avisar para cerrarla con el DO-block de la guía.

---

## B) Prueba punta a punta

- [ ] Crear licencia DULZ en el panel CyC.
- [ ] Activar en la app con **login Dueño** (código + usuario + clave 6+).
- [ ] Cargar un producto y una promo → recargar el panel → siguen ahí (vienen de la nube).
- [ ] Abrir la página pública con `?codigo=DULZ-...` → se ven productos y promos.
- [ ] Agregar al carrito (producto y promo) → **🛒 Mi pedido** → enviar → abre WhatsApp con la lista y total.
- [ ] El pedido aparece solo en la 🔔 (~20s) y en **📊 Entregas**.
- [ ] Marcar "Completado" → en Entregas figura "Atendido por: [vos] (Dueño)".
- [ ] **Colaborador**: entrar en otro navegador (👥 Colaborador, mismo código) → completar otro pedido → en el resumen de Entregas aparecen los dos nombres.
- [ ] Vencer/renovar la licencia desde el panel y confirmar el aviso en la app.

---

## Requisitos para que todo funcione (ya hechos)

- SQL `sql/01_dulzura_backend.sql` corrido (tablas + RLS + funciones). ✅
- SQL `sql/02_dulzura_pedidos.sql` corrido (pedidos del carrito al panel). ✅
- `apps.ts` con Dulzura + URL `dulzura-hogar.vercel.app` subido al panel cyc-admin-v2.
- Archivos de la app subidos al repo de Dulzura (última versión, `?v=7`).
- En Supabase: **"Confirm email" desactivado** (las cuentas usan mail interno `@tiendalibre.app`).

---

## Estado del plan (molde Tienda Libre)

1. ✅ Supabase compartida
2. ✅ Registrar app en el panel (apps.ts)
3. ✅ Activación segura (validar_licencia)
4. ✅ Login + cuenta segura (Supabase Auth)
5. ✅ Tablas propias + RLS por miembro
6. ✅ Función pública por código
7. ✅ Sync robusto (token refresh + retry + pull-before-write)
8. ✅ Multi-usuario (colaboradores)
9. ✅ Pulido (tope 40 imágenes, inicio limpio, ojo+cerrar, compartir, bloque promo, EmailJS, ?v)
10. ⏳ Cerrar tablas y verificar (esta checklist)
11. ⏳ Prueba punta a punta (esta checklist)

**Extras agregados:** carrito de compras, dashboard de entregas con "atendido por", auto-actualización de la campanita, compartir a amigos.
