# 🎬 CineApp - TP1 Programación IV (2026 C2)

Sistema integral de gestión, venta de entradas y Candy Bar para complejo de cines.

- **Repositorio:** [https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2](https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2)
- **Deploy:** [*Hollownest Cinema*](https://hollownestcinema.vercel.app/)

---

## 🛠️ Stack Tecnológico

- **Frontend:** Angular 22 (Standalone Components, Signals, Reactive Forms, nuevo control flow `@if` / `@for`)
- **Backend / DB:** Supabase (Auth con mail y Google, PostgreSQL con Row Level Security, Realtime)
- **PWA:** `@angular/service-worker` (manifest + service worker)
- **Deploy:** Vercel
- **Librerías:** `jspdf` (PDF de entradas y reportes), `qrcode` (QR de entradas y órdenes), `html5-qrcode` (lectura de QR con la cámara), `xlsx` (exportación a Excel), `blobatar` (avatares)
- **Estilos:** CSS propio, con variables (`--hk-*`) para el modo claro/oscuro

---

## 🏛️ Arquitectura

La app es una SPA en Angular que habla directamente con Supabase. No hay un backend propio: la base de datos, la autenticación y los permisos los resuelve Supabase, y la seguridad de los datos está en las políticas de **Row Level Security (RLS)** de cada tabla.

```
src/app/
├── core/
│   ├── services/     → todo el acceso a datos (un service por entidad: peliculas, funciones,
│   │                   entradas, ordenes, candy, combos, cupones, fidelizacion, reportes, avisos…)
│   ├── interfaces/   → los tipos de cada tabla (IPelicula, IOrden, IAviso…)
│   ├── guards/       → rolGuard (admin / empleado) y perfilCompletoGuard
│   └── pipes/        → duracion (125 → "2h 5m")
├── features/         → una carpeta por área, cada pantalla cargada con lazy loading
│   ├── home/           cartelera, Top 3 y sección Próximamente
│   ├── peliculas/      detalle de película y reseñas
│   ├── funciones/      selección de butacas, candy y compra
│   ├── perfil/         mis compras, mis películas, mis puntos
│   ├── auth/           login, registro, completar perfil
│   ├── empleado/       validación de QR en puerta
│   └── admin/          altas, cupones, fidelización, preventas, log de actividad, reportes
└── shared/
    ├── components/   → loading, toast (avisos flotantes), blobatar
    └── directives/   → appGlowHover (brillo al pasar el mouse)
```

**Regla general:** los componentes nunca consultan Supabase directamente; siempre pasan por un service de `core/services`. Así cada consulta está en un solo lugar y los componentes sólo se ocupan de mostrar datos y reaccionar al usuario.

**Estado:** se maneja con **signals** y **computed** en cada componente. Lo que se deriva de otros datos (totales, estado de venta de una película, si se puede reseñar…) se calcula con `computed()` en vez de guardarse aparte, así nunca queda desactualizado.

**Roles:** `cliente`, `empleado` y `admin`, guardados en la tabla `perfiles`. Los **guards** controlan a qué pantallas se puede entrar, pero la protección real está en **RLS**: aunque alguien se saltee un guard o llame a Supabase desde la consola del navegador, la base rechaza lo que su rol no puede hacer.

---

## 🧠 Decisiones técnicas

### Seguridad con RLS
Cada tabla tiene RLS activado. En resumen:
- **Catálogo** (películas, funciones, géneros, candy, combos, cupones): lectura pública; crear, modificar y borrar, sólo admin.
- **Datos de cada usuario** (avisos, canjes, reseñas, suscripciones): cada uno ve y modifica sólo lo suyo (`usuario_id = auth.uid()`).
- **Compras anónimas:** la consigna permite comprar sin cuenta, así que alguien sin sesión puede crear órdenes, entradas y candy, siempre sin usuario asociado.
- **Validación en puerta:** empleados y admin pueden marcar entradas como usadas y candy como entregado.
- **Perfiles:** un usuario no puede cambiarse el rol a sí mismo; los roles de empleado y admin se asignan desde Supabase.

### Próximamente y preventa sin cron
El estado de venta de una película **no se guarda: se calcula** cada vez que se consulta (`Peliculas.estadoVenta()`), comparando su fecha de estreno con la fecha de hoy:

| Estado | Cuándo | Qué se ve |
|---|---|---|
| `proximamente` | Todavía no se estrenó y la venta no está abierta | Sección Próximamente con botón "Avisame"; no se puede comprar |
| `preventa` | Todavía no se estrenó y el admin abrió la venta | Se compra al precio de preventa |
| `cartelera` | Ya se estrenó (o no tiene fecha de estreno) | Venta normal |

Como el estado depende del día de hoy y no de un dato guardado, **no hace falta un cron** que cambie precios a medianoche: el día del estreno la película pasa sola a cartelera y vuelve al precio normal.

Como en un cine real, **programar funciones y abrir la venta son pasos separados**: el admin puede cargar funciones con anticipación (nunca antes del estreno), y desde 7 días antes del estreno puede apretar **"Abrir venta"** en la pantalla Preventas, que guarda `venta_abierta_en`.

El precio de preventa es **fijo por película**. En cada butaca se cobra el **menor** entre el precio de preventa y el normal del formato (la preventa nunca sale más cara), y el recargo VIP se aplica encima.

### Alertas de "Avisame"
Al tocar "Avisame" se guarda una fila en la tabla `avisos`. Cuando el usuario entra a la app, se buscan sus avisos pendientes de películas que ya abrieron la venta, se muestra un **toast** con un enlace para comprar, y se marca `avisado_en` para no repetirlo.

### Fechas sin corrimiento de zona horaria
Las fechas sin hora (estreno, días del reporte) se manejan como texto `'YYYY-MM-DD'`: se comparan como texto (en ese formato el orden alfabético coincide con el del calendario) y se formatean partiendo el string, sin `new Date()`. Así se evita que en Argentina (UTC-3) una fecha se muestre un día antes.

### Butacas en tiempo real
La pantalla de butacas se suscribe con **Supabase Realtime** a las entradas nuevas de esa función: si otra persona compra una butaca mientras elegís, aparece ocupada al instante. La suscripción se cierra al salir de la pantalla.

### Compras, cancelaciones, crédito y puntos
- La compra genera una **orden** (con su QR para el candy) y una **entrada por butaca** (cada una con su QR).
- **Cancelación:** hasta 2 hs antes de la función y si ninguna entrada se usó. No se devuelve dinero: lo pagado se acredita como crédito, y los puntos canjeados se devuelven.
- **Puntos:** 1 por cada peso pagado (no se suman puntos por lo pagado con crédito). El costo en puntos de la entrada gratis se configura en la pantalla Fidelización, y el de cada producto de candy al cargarlo.
- Los **cupones** no se acumulan: se aplica el mayor que corresponda.

### Reportes
Se calculan en el cliente a partir de las órdenes **no canceladas**, agrupando con `Map`. Las películas más vistas usan ventanas móviles de 7 y 30 días hacia atrás (no semana/mes calendario, para que el reporte no "se reinicie" el día 1). La exportación a **PDF** (jsPDF) y **Excel** (SheetJS) usa los mismos datos que ya están en pantalla.

### Log de actividad
Cada acción del admin y del empleado (crear película, función, producto o combo; modificar un precio o un cupón; abrir una preventa; validar un QR) queda registrada con usuario, fecha y hora.

### PWA
El service worker está activo sólo en el build de producción (`enabled: !isDevMode()`), así que el modo offline y la instalación se prueban sobre el deploy de Vercel, no con `ng serve`. Offline funciona el "shell" de la app; los datos de Supabase necesitan conexión.

### Limitaciones conocidas
- La lógica de negocio (precios, crédito, puntos, cancelaciones) corre en el navegador y Supabase guarda el resultado. RLS limita **quién** puede escribir cada dato, pero un usuario técnico podría modificar sus propios valores desde la consola. En producción esa lógica iría en funciones del servidor (funciones de Postgres o Edge Functions).
- La librería `xlsx` de npm tiene una vulnerabilidad conocida al **leer** archivos Excel ajenos; la app sólo la usa para **generar** archivos propios, así que esa parte no se ejecuta.

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
- [x] Reseñas: calificación con estrellas + comentario corto, visibles antes de sacar entradas, con promedio

### Funciones y salas
- [x] ABM de funciones: película, horario, formato (2D/3D/4D/5D), idioma
- [x] Margen obligatorio de 30 min entre funciones de una misma sala
- [x] Asignación automática de sala al crear una función (nunca dos funciones se pisan en sala + horario)
- [x] Selector de fecha/hora con input nativo, sin el calendario de scroll infinito que se pidió evitar
- [x] **Layout final de butacas** (combina las tres vueltas que dio la consigna): sala de 20 filas, bloques 4/20/4; las filas J y K son butacas accesibles (2/10/2) resaltadas visualmente, y las últimas 3 filas (R, S, T) son VIP con precio más alto, marca visual propia y aviso antes de pagar
- [x] Selección de butacas en tiempo real (Supabase Realtime): se ve al instante qué butacas compra otro usuario mientras elegís las tuyas
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
- [x] Alerta/notificación al usuario cuando se habilite la venta de entradas de una película que estaba en "Próximamente"
- [x] Preventa: entradas disponibles 7 días antes del estreno a un precio especial, configurable película por película, que vuelve solo al precio normal pasada la fecha de estreno

### Perfil del usuario
- [x] Registro con mail, nombre, apellido, fecha de nacimiento, tipo de sangre, color de ojos y días de vacaciones por año
- [x] Sección "Mis películas": historial visual (pósters, fechas, calificación propia) de todo lo que el usuario vio

### Reportes de administración
- [x] Reporte de facturación diaria (monto facturado y cantidad de entradas vendidas por día)
- [x] Gráfico de películas más vistas por semana y por mes
- [x] Producto de candy bar más vendido
- [x] Exportación de los reportes a PDF y a Excel

---

## 💻 Entorno de Desarrollo

1. **Instalar dependencias:**
   ```bash
   npm install
   ```
2. **Levantar en modo desarrollo** (en `http://localhost:4200`):
   ```bash
   ng serve
   ```
3. **Build de producción** (con el service worker de la PWA activo):
   ```bash
   ng build
   ```

Las credenciales públicas de Supabase (URL y clave publicable) están en `src/environments/environment.ts`.