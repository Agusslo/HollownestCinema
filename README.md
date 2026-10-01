# 🎬 CineApp - TP1 Programación IV (2026 C2)

Sistema integral de gestión, venta de entradas y Candy Bar para complejo de cines.

- **Repositorio:** [https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2](https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2)
- **Deploy:** [*Hollownest Cinema*](https://hollownestcinema.vercel.app/)

---

## 🛠️ Stack Tecnológico

- **Frontend:** Angular 22 (Standalone Components, Signals, Reactive Forms, control flow `@if` / `@for`)
- **Backend / DB:** Supabase (Auth con mail y Google, PostgreSQL con Row Level Security, Realtime)
- **PWA:** `@angular/service-worker` (manifest + service worker)
- **Deploy:** Vercel
- **Librerías:** `jspdf` (PDF de entradas y reportes), `qrcode` (QR de entradas y órdenes), `html5-qrcode` (lectura de QR con la cámara), `xlsx` (exportación a Excel), `blobatar` (avatares)
- **Estilos:** CSS propio con variables (`--hk-*`) para el modo claro y oscuro

---

## 🏛️ Arquitectura

La aplicación es una SPA en Angular conectada a Supabase, que provee la base de datos PostgreSQL, la autenticación y el control de acceso a los datos mediante Row Level Security (RLS).

```
src/app/
├── core/
│   ├── services/     → acceso a datos, un service por entidad (peliculas, funciones, entradas,
│   │                   ordenes, candy, combos, cupones, fidelizacion, reportes, avisos…)
│   ├── interfaces/   → tipos de cada tabla (IPelicula, IOrden, IAviso…)
│   ├── guards/       → rolGuard (admin / empleado) y perfilCompletoGuard
│   └── pipes/        → duracion (125 → "2h 5m")
├── features/         → una carpeta por área, cada pantalla con lazy loading
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

- **Servicios como única puerta a los datos:** los componentes acceden a Supabase siempre a través de un service de `core/services`. Cada consulta vive en un solo lugar y los componentes se ocupan de mostrar datos y responder al usuario.
- **Estado con signals:** cada componente maneja su estado con `signal()`, y todo lo que se deriva de otros datos (totales, estado de venta de una película, permisos para reseñar) se calcula con `computed()`, que se actualiza solo.
- **Roles:** `cliente`, `empleado` y `admin`, guardados en la tabla `perfiles`. Los guards controlan el acceso a cada pantalla y las políticas RLS validan cada operación directamente en la base de datos.

---

## 🧠 Decisiones técnicas

### Seguridad con RLS
Todas las tablas tienen RLS activado:
- **Catálogo** (películas, funciones, géneros, candy, combos, cupones): lectura pública; alta, modificación y baja exclusivas del admin.
- **Datos personales** (avisos, canjes, reseñas): cada usuario accede a sus propios registros (`usuario_id = auth.uid()`).
- **Compras:** se pueden realizar con cuenta o de forma anónima, como pide la consigna.
- **Validación en puerta:** empleados y admin marcan entradas como usadas y candy como entregado.
- **Perfiles:** cada usuario edita sus propios datos; los roles de empleado y admin se asignan desde Supabase.

### Próximamente y preventa
El estado de venta de cada película se calcula en el momento a partir de su fecha de estreno y de la fecha actual (`Peliculas.estadoVenta()`):

| Estado | Cuándo | Qué se ve |
|---|---|---|
| `proximamente` | Antes del estreno, con la venta todavía cerrada | Sección Próximamente con el botón "Avisame" |
| `preventa` | Antes del estreno, con la venta abierta por el admin | Compra al precio de preventa |
| `cartelera` | Desde el día del estreno | Compra al precio normal |

Al llegar la fecha de estreno, la película pasa automáticamente a cartelera con su precio normal.

Igual que en un cine real, **programar funciones y abrir la venta son pasos separados**: el admin carga las funciones con anticipación (desde el día del estreno en adelante), y a partir de 7 días antes del estreno abre la venta con el botón **"Abrir venta"** de la pantalla Preventas.

El precio de preventa se configura por película. En cada butaca se cobra el menor entre el precio de preventa y el precio normal del formato, y las butacas VIP suman su recargo.

### Alertas de "Avisame"
El botón "Avisame" registra el pedido en la tabla `avisos`. Cuando el usuario ingresa a la app, se buscan sus avisos de películas que ya abrieron la venta, se muestra un **toast** con un enlace directo para comprar y el aviso queda marcado como entregado (`avisado_en`).

### Manejo de fechas
Las fechas de calendario (estreno, días del reporte) se manejan como texto `'YYYY-MM-DD'`: se comparan directamente como texto, porque en ese formato el orden alfabético coincide con el cronológico, y se formatean separando el texto. De esta forma cada fecha se muestra igual en cualquier zona horaria.

### Butacas en tiempo real
La pantalla de butacas se suscribe con **Supabase Realtime** a las entradas nuevas de esa función: cuando otra persona compra una butaca, aparece ocupada al instante. La suscripción se cierra al salir de la pantalla.

### Compras, cancelaciones, crédito y puntos
- Cada compra genera una **orden**, con su QR para retirar el candy, y una **entrada por butaca**, cada una con su propio QR.
- **Cancelación:** disponible hasta 2 hs antes de la función mientras ninguna entrada se haya usado. El monto pagado se acredita como crédito y los puntos canjeados se devuelven.
- **Puntos:** 1 por cada peso pagado. El costo en puntos de la entrada gratis se configura en la pantalla Fidelización, y el de cada producto de candy al darlo de alta.
- **Cupones:** se aplica el de mayor porcentaje entre los que le correspondan al usuario.

### Reportes
Se calculan a partir de las órdenes vigentes (no canceladas), agrupando los datos con `Map`. Las películas más vistas se muestran en ventanas móviles de los últimos 7 y 30 días. La exportación a **PDF** (jsPDF) y **Excel** (SheetJS) toma los mismos datos que se ven en pantalla.

### Log de actividad
Cada acción del admin y del empleado queda registrada con usuario, fecha y hora: alta de películas, funciones, productos y combos; cambios de precios, cupones y puntos; apertura de preventas y validación de QR.

### PWA
La aplicación se puede instalar y su interfaz carga sin conexión gracias al service worker de Angular, que se activa en el build de producción.

---

## 📋 Roadmap

### Base
- [x] Inicialización del proyecto con Angular 22
- [x] Conexión y configuración inicial con Supabase
- [x] Configuración como Progressive Web App (PWA)
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
- [x] Asignación automática de sala al crear una función
- [x] Selector de fecha y hora con input nativo
- [x] Layout de butacas: sala de 20 filas en bloques 4/20/4, filas J y K de butacas accesibles (2/10/2) y filas R, S y T VIP con precio diferencial, cada una con su marca visual y aviso antes de pagar
- [x] Selección de butacas en tiempo real con Supabase Realtime
- [x] Restricción de edad por película (+13 / +18): bloqueo de la compra a menores y aviso en la entrada de que debe asistir acompañado de un adulto

### Compra y entradas
- [x] Selección de butacas + compra, con cuenta o anónima
- [x] PDF con los datos de la entrada + código QR
- [x] Cupón de descuento en la primera compra, con porcentaje configurable por el admin
- [x] Cupón exclusivo para usuarios mayores de 50 años, también configurable
- [x] Si un usuario califica para dos cupones, se aplica el de mayor porcentaje
- [x] Cancelación de una compra hasta 2 hs antes de la función, con el monto acreditado como crédito para compras futuras

### Candy bar
- [x] ABM de productos (nombre, precio, imagen, categoría)
- [x] Compra de candy junto con la entrada, en el mismo flujo de selección de butacas
- [x] Retiro de todo el pedido con el QR de la orden
- [x] Combos especiales configurables por el admin (entrada + pochoclos + bebida a precio fijo), destacados en la pantalla de compra

### Roles y validación en puerta
- [x] Rol admin: gestión de películas, funciones, candy bar, combos, cupones, fidelización, preventas y reportes (rutas protegidas con guard)
- [x] Rol empleado: validación de entradas y candy (rutas protegidas con guard)
- [x] Escaneo de QR por cámara para validar entradas y candy bar
- [x] Ingreso manual del código como alternativa al escaneo
- [x] Invalidación: cada código sirve una sola vez
- [x] Log de actividad: quién creó cada función, quién modificó un precio, quién validó un QR, con fecha y hora

### Fidelización
- [x] Acumulación de puntos por compra (1 punto por cada peso gastado)
- [x] Canje de puntos por entradas gratis o productos de candy bar, con el costo en puntos de cada recompensa configurable por el admin
- [x] Historial de puntos acumulados y canjes en el perfil del usuario
- [x] Puntos personales e intransferibles

### Próximamente y preventa
- [x] Sección "Próximamente" con películas que se estrenan en las próximas semanas
- [x] Alerta al usuario cuando se habilita la venta de entradas de una película que estaba en "Próximamente"
- [x] Preventa: entradas disponibles 7 días antes del estreno a un precio especial, configurable película por película, que vuelve al precio normal desde la fecha de estreno

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
3. **Build de producción:**
   ```bash
   ng build
   ```

La configuración de Supabase (URL y clave publicable) está en `src/environments/environment.ts`.