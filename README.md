# 🎬 CineApp - TP1 Programación IV (2026 C2)

Sistema integral de gestión, venta de entradas y Candy Bar para complejo de cines.

- **Repositorio:** [https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2](https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2)
- **Deploy:** [*Hollownest Cinema*](https://hollownestcinema.vercel.app/)

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
- [x] Configuración como Progressive Web App (PWA)

### Correo 1 — Propuesta inicial
- [x] Modelo de datos y RLS (películas, salas, funciones, perfiles, entradas)
- [x] Arquitectura de carpetas (`core/` + `features/`)
- [x] Servicios base (`Supabase`, `Peliculas`)
- [x] Cartelera: listado de películas en la home
- [x] Detalle de película (sinopsis + listado de funciones, navegación por slug)
- [x] ABM de funciones (horario, formato, idioma)
- [x] Selección de butacas (sala fija de 20 filas / bloques 4-20-4) con margen de 30 min entre funciones
- [x] Registro y login de usuario
- [x] Compra con cupón 20% primera compra (registrado)
- [x] Compra anónima
- [x] Generación de PDF con entrada + código QR

---

### Correo 2 — Reseñas y mejoras a la cartelera
- [x] Sistema de reseñas: calificación con estrellas + comentario corto, visible antes de comprar
- [x] Puntuación promedio de la película
- [x] Home: mostrar primero las 3 películas más vendidas
- [x] Buscador en el listado de películas

### Correo 3 — Buscador por género
- [x] Buscador debe filtrar por género (una película puede tener varios géneros)

### Correo 4 — Cupones configurables y Candy bar
- [x] Cupón de primera compra: el admin puede configurar el porcentaje de descuento
- [x] Cupones exclusivos para usuarios mayores de 50 años
- [ ] Candy bar: ABM de productos (nombre, precio, imagen)
- [ ] Categorías para los productos del candy bar
- [ ] Compra de productos del candy bar junto con la entrada
- [ ] Retiro de candy bar con el mismo QR de la entrada

## 💻 Entorno de Desarrollo

1. **Instalar dependencias:**
   ```bash
   npm install
