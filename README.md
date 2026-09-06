# 🎬 CineApp - TP1 Programación IV (2026 C2)

Sistema integral de gestión, venta de entradas y Candy Bar para complejo de cines.

- **Repositorio:** [https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2](https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2)
- **Deploy:** *En construcción (URL pendiente)*

---

## 🛠️ Stack Tecnológico

- **Frontend:** Angular 22 (Standalone Components, Signals)
- **Backend / DB:** Supabase (Auth, PostgreSQL, Realtime)
- **PWA:** `@angular/pwa`
- **Estilos:** CSS / SCSS personalizado

---

## 📋 Roadmap y Requerimientos

### Base (no ligado a un correo puntual)
- [x] Inicialización del proyecto con Angular 22
- [x] Conexión y configuración inicial con Supabase
- [ ] Configuración como Progressive Web App (PWA)

### Correo 1 — Propuesta inicial
- [x] Modelo de datos y RLS (películas, salas, funciones, perfiles, entradas)
- [x] Arquitectura de carpetas (`core/` + `features/`)
- [x] Servicios base (`Supabase`, `Peliculas`)
- [x] Cartelera: listado de películas en la home
- [x] Detalle de película (sinopsis + listado de funciones, navegación por slug)
- [x] ABM de funciones (horario, formato, idioma)
- [x] Selección de butacas (sala fija de 20 filas / bloques 4-20-4) con margen de 30 min entre funciones
- [ ] Registro de usuario + cupón 20% primera compra
- [ ] Compra anónima
- [ ] Generación de PDF con entrada + código QR

---

## 💻 Entorno de Desarrollo

1. **Instalar dependencias:**
   ```bash
   npm install
