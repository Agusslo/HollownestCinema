# 🎬 CineApp - TP1 Programación IV (2026 C2)

Sistema integral de gestión, venta de entradas y Candy Bar para complejo de cines.

- **Repositorio:** [https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2](https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2)
- **Deploy:** [*Hollownest Cinema*](https://hollownestcinema.vercel.app/)

---

## 🛠️ Stack Tecnológico

- **Frontend:** Angular 22 (Standalone Components, Signals)
- **Backend / DB:** Supabase (Auth, PostgreSQL, Realtime)
- **PWA:** `@angular/pwa`
- **Estilos:** CSS

---

## 📋 Roadmap

### Base
- [x] Inicialización del proyecto con Angular 22
- [x] Conexión y configuración inicial con Supabase
- [x] Configuración como Progressive Web App (PWA), funcionando offline (el shell de la app; los datos de Supabase requieren conexión, es lo esperable)
- [x] Identidad visual propia y producida ("Hollownest Cinema"), con modo claro/oscuro

### Catálogo de películas
- [x] Cartelera (home) con listado de películas
- [x] Detalle de película (sinopsis, navegación por slug en la URL)
- [x] Buscador de texto + filtro por género (una película puede tener varios géneros)
- [x] Top 3 películas más vendidas destacadas primero en la home
- [x] hs: calificación con estrellas + comentario corto, visibles antes de sacar entradas, con promedio

### Funciones y salas
- [x] ABM de funciones: película, horario, formato (2D/3D/4D/5D), idioma
- [x] Margen obligatorio de 30 min entre funciones de una misma sala
- [x] Asignación automática de sala al crear una función (nunca dos funciones se pisan en sala + horario)
- [x] Selector de fecha/hora con input nativo, sin el calendario de scroll infinito que se pidió evitar 
- [x] **Layout final de butacas** (combina las tres vueltas que dio la consigna): sala de 20 filas, bloques 4/20/4, **pero** las filas J y K dejan de ser butacas comunes y pasan a ser una fila de butacas accesibles (2/10/2) resaltada visualmente distinto, **y además** las últimas 3 filas (R, S, T) son butacas VIP con precio más alto y marca visual propia, con aviso claro antes de pagar. Hoy el layout sigue siendo el original de correo 1 (20 filas parejas, sin accesibles ni VIP)
- [x] Selección de butacas en tiempo real: ver en el momento qué butacas está ocupando otro usuario mientras elegís las tuyas. Hoy se consultan una vez al entrar a la pantalla y se refrescan recién después de tu propia compra — falta la suscripción en vivo (Supabase Realtime)
- [x] Restricción de edad por película (13 o 18 años según la película, o sin restricción): bloquear la compra a menores de esa edad, y aclarar en la entrada que debe ir acompañado de un adulto

### Compra y entradas
- [x] Selección de butacas + compra, registrado o anónimo
- [x] PDF con los datos de la entrada + código QR
- [x] Cupón de descuento en la primera compra, con porcentaje configurable por el admin (ya no fijo en 20%)
- [x] Cupón exclusivo para usuarios mayores de 50 años, también configurable
- [x] Si un usuario califica para dos cupones a la vez, se aplica el mayor — nunca se suman
- [x] Cancelación de una compra hasta 2 hs antes de la función: no se devuelve dinero, se acredita como crédito en la cuenta del usuario, usable junto con otros medios de pago en compras futuras

### Candy bar
- [x] ABM de productos (nombre, precio, imagen, categoría)
- [x] Compra de candy junto con la entrada, en el mismo flujo de selección de butacas
- [x] Retiro de todo el pedido con el QR de la orden (distinto del QR de cada entrada individual)
- [x] Combos especiales configurables por el admin (ej. entrada + pochoclos + bebida a precio fijo), destacados en la pantalla de compra

### Roles y validación en puerta
- [x] Rol admin: acceso a ABM de salas, funciones, distribución de butacas y candy bar (rutas protegidas con guard)
- [x] Rol empleado: acceso a la pantalla de validación de entradas y candy (rutas protegidas con guard)
- [x] Escaneo de QR por cámara para validar entradas (cine) y candy bar
- [x] Ingreso manual del código como alternativa al escaneo, por si el lector falla
- [x] Invalidación: una vez que una entrada se valida o se entrega su candy, ese código deja de servir
- [x] Log de actividad del admin: quién creó qué función, quién modificó un precio, quién validó un QR — todo con fecha y hora

### Fidelización
- [x] Acumulación de puntos por compra (1 punto por cada peso gastado)
- [x] Canje de puntos por entradas gratis o productos de candy bar, con el costo en puntos de cada recompensa configurable por el admin
- [x] Historial de puntos acumulados y canjes, visible en el perfil del usuario
- [x] Los puntos no se transfieren entre usuarios

### Próximamente y preventa
- [x] Sección "Próximamente" con películas que se estrenan en las próximas semanas
- [ ] Alerta/notificación al usuario cuando se habilite la venta de entradas de una película que estaba en "Próximamente"
- [x] Preventa: entradas disponibles 7 días antes del estreno a un precio especial, configurable película por película, que vuelve solo al precio normal pasada la fecha de estreno

### Perfil del usuario
- [x] Registro con mail, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año
- [x] Sección "Mis películas": historial visual (pósters, fechas, calificación propia) de todo lo que el usuario vio

### Reportes de administración
- [x] Reporte de facturación diaria (monto facturado y cantidad de entradas vendidas por día)
- [x] Gráfico de películas más vistas por semana y por mes
- [x] Producto de candy bar más vendido
- [x] Exportación de los reportes a PDF y a Excel

## 💻 Entorno de Desarrollo

1. **Instalar dependencias:**
   ```bash
   npm install
