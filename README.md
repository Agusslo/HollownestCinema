# 🎬 CineApp - TP1 Programación IV (2026 C2)

Sistema integral de gestión, venta de entradas y Candy Bar para complejo de cines.

- **Repositorio:** [https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2](https://github.com/Agusslo/Agustin-Lopez-tp1-prog4-2026-c2)
- **Deploy:** [*Hollownest Cinema*](https://hollownestcinema.vercel.app/)

---

## 🛠️ Stack Tecnológico

- **Frontend:** Angular 22 (Standalone Components, Signals, Reactive Forms, control flow `@if` / `@for`)
- **Backend / DB:** Supabase (Auth con mail y Google, PostgreSQL con Row Level Security, Realtime, Storage, Edge Functions y Database Webhooks)
- **PWA:** `@angular/service-worker` (manifest, service worker y notificaciones push con `SwPush`)
- **Deploy:** Vercel
- **Librerías:** `jspdf` (PDF de entradas y reportes), `qrcode` (QR de entradas y órdenes), `html5-qrcode` (lectura de QR con la cámara), `xlsx` (exportación a Excel), `blobatar` (avatares)
- **Estilos:** CSS propio con variables (`--hk-*`) para el modo claro y oscuro

---

## 🏛️ Arquitectura

La aplicación es una SPA en Angular conectada a Supabase, que provee la base de datos PostgreSQL, la autenticación, el almacenamiento de archivos y el control de acceso a los datos mediante Row Level Security (RLS). Las notificaciones push se envían desde una Edge Function de Supabase.

```
src/app/
├── core/
│   ├── services/     → acceso a datos, un service por entidad (peliculas, funciones, entradas,
│   │                   ordenes, candy, combos, cupones, fidelizacion, reportes, avisos…),
│   │                   archivos (Storage), notificaciones (push) y modo invitado
│   ├── interfaces/   → tipos de cada tabla (IPelicula, IOrden, IAviso…)
│   ├── guards/       → rolGuard, sesionGuard, invitadoGuard, perfilCompletoGuard
│   │                   y perfilPendienteGuard
│   └── pipes/        → duracion (125 → "2h 5m")
├── features/         → una carpeta por área, cada pantalla con lazy loading
│   ├── home/           cartelera, Top 3 y sección Próximamente
│   ├── peliculas/      detalle de película y reseñas
│   ├── funciones/      selección de butacas, candy y compra
│   ├── perfil/         mis compras, mis películas, mis puntos
│   ├── auth/           login, registro, completar perfil
│   ├── empleado/       validación de QR en puerta
│   └── admin/          películas (mostrar / ocultar), funciones, productos, altas,
│                       cupones, fidelización, preventas, log de actividad, reportes
└── shared/
    ├── components/   → poster-card (tarjeta de la cartelera), loading, toast, blobatar
    └── directives/   → appGlowHover (brillo al pasar el mouse)

supabase/functions/avisar-preventa/  → Edge Function que envía las notificaciones push
scripts/generar-claves-vapid.mjs     → genera las claves VAPID de las notificaciones
```

- **Servicios como única puerta a los datos:** los componentes acceden a Supabase siempre a través de un service de `core/services`. Cada consulta vive en un solo lugar y los componentes se ocupan de mostrar datos y responder al usuario.
- **Estado con signals:** cada componente maneja su estado con `signal()`, y todo lo que se deriva de otros datos (totales, estado de venta de una película, permisos para reseñar) se calcula con `computed()`, que se actualiza solo.
- **Componentes reutilizables:** la tarjeta de póster (`PosterCard`) recibe la película con `input()` y se usa en la cartelera y en la vista previa del alta de películas. Las reseñas avisan al detalle de la película el nuevo promedio con `output()`.
- **Roles:** `cliente`, `empleado` y `admin`, guardados en la tabla `perfiles`. Los guards controlan el acceso a cada pantalla y las políticas RLS validan cada operación directamente en la base de datos.

**Guards en todas las rutas:**

| Guard | Dónde | Qué hace |
|---|---|---|
| `rolGuard([...])` | Pantallas de admin y de empleado | Sin sesión manda al login; con otro rol, a la cartelera |
| `sesionGuard` | Mis compras, Mis puntos, Mis películas | Sin sesión manda al login |
| `invitadoGuard` | Login y registro | Con sesión iniciada manda a la cartelera |
| `perfilCompletoGuard` | Todas las pantallas, menos login, registro y completar perfil | Con el perfil incompleto (ingreso con Google) manda a completarlo |
| `perfilPendienteGuard` | Completar perfil | Sin sesión, o con el perfil ya completo, sale de esa pantalla |

Una URL inexistente vuelve a la cartelera.

---

## 🧠 Decisiones técnicas

### Seguridad con RLS
Todas las tablas tienen RLS activado:
- **Catálogo** (películas, funciones, géneros, candy, combos, cupones): lectura pública; alta, modificación y baja exclusivas del admin.
- **Datos personales** (avisos, canjes, reseñas): cada usuario accede a sus propios registros (`usuario_id = auth.uid()`).
- **Compras:** se pueden realizar con cuenta o como invitado, como pide la consigna.
- **Validación en puerta:** empleados y admin marcan entradas como usadas y candy como entregado.
- **Perfiles:** cada usuario edita sus propios datos; los roles de empleado y admin se asignan desde Supabase.

### Qué películas aparecen en la página
Cada película tiene la columna `visible`. Desde la pantalla de admin **Películas**, el admin la muestra u oculta con un botón: una película oculta no aparece en la cartelera, el Top 3, Próximamente ni el buscador. Es una baja lógica: sus funciones, entradas y reseñas se mantienen, su página de detalle sigue funcionando para quien llega desde "Mis compras" o "Mis películas", y se puede volver a mostrar en cualquier momento. Cada cambio queda en el log de actividad.

### Funciones y salas
- **Asignación automática:** al crear una función, el sistema prueba las salas en orden y la asigna a la primera libre en ese horario, contando la duración de la película y 30 minutos de margen.
- **Funciones repetidas:** en Nueva función se elige entre **una sola vez** o **varios días de la semana** (por ejemplo, lunes, martes y viernes a las 18 hs, entre dos fechas). Una vista previa muestra todas las funciones que se van a crear. Se crean de a una, para que cada sala se elija teniendo en cuenta las funciones recién creadas; si algún día no hay sala libre, se informa y el resto se crea igual.
- **Baja de funciones:** la pantalla de admin **Funciones** lista las funciones programadas con la cantidad de entradas de cada una. Las que no tienen entradas se pueden borrar (con confirmación), por ejemplo si se cargaron con un horario equivocado. Las que tienen entradas no: la pantalla no lo ofrece y además la base lo impide por la clave foránea entre entradas y funciones.
- **Sala:** 19 filas en bloques de 4, 20 y 4 butacas. Las filas J y K del medio se reemplazaron por una única fila J de butacas accesibles (bloques de 2, 10 y 2, más grandes y marcadas con su ícono), y las filas R, S y T son VIP.

### Productos del candy bar
La pantalla de admin **Productos** permite modificar el precio y los puntos de canje de cada producto, y sacarlo de la venta o volver a ponerlo (columna `activo`). Es una baja lógica: el producto deja de aparecer para comprar y para armar combos, pero sigue en las compras, los canjes y los reportes donde ya figura. Cada cambio de precio queda en el log de actividad.

### Compra con cuenta o como invitado
Comprar sin cuenta es una opción que el usuario elige. Sin sesión se puede recorrer la cartelera, ver el detalle y las reseñas; al llegar a la selección de butacas, la página ofrece **iniciar sesión**, **registrarse** o **continuar como invitado**. El modo invitado lo maneja el service `ModoInvitado` con un signal guardado en `sessionStorage`: dura mientras la pestaña está abierta y se desactiva al iniciar sesión. Iniciando sesión desde la pantalla de butacas, el login devuelve al usuario a la misma función.

El invitado compra entradas y candy y se lleva el PDF con el QR. Los puntos, los cupones, el crédito y "Mis compras" son beneficios de la cuenta; las películas con restricción de edad piden iniciar sesión para verificarla.

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
El botón "Avisame" registra el pedido en la tabla `avisos` y el usuario recibe la alerta por dos canales:

- **Notificación push:** al tocar "Avisame", el navegador pide permiso para mostrar notificaciones (`SwPush`) y la suscripción se guarda en `push_subscriptions`. Cuando el admin abre la venta, un **Database Webhook** sobre `peliculas` llama a la **Edge Function** `avisar-preventa`, que busca a los usuarios que pidieron aviso y les envía la notificación firmada con las claves **VAPID**. La notificación llega aunque la app esté cerrada y al tocarla abre la página de la película.
- **Toast dentro de la app:** cuando el usuario ingresa, se buscan sus avisos de películas que ya abrieron la venta, se muestra un toast con un enlace directo para comprar y el aviso queda marcado como entregado (`avisado_en`).

La clave pública VAPID está en el environment de Angular y la privada se guarda como secreto de Supabase, disponible solo para la Edge Function.

### Pósters con Supabase Storage
En el alta de películas el admin sube el póster como archivo. La imagen se guarda en el bucket público `posters` de **Supabase Storage** y en la tabla se registra su URL pública. El bucket acepta imágenes JPG, PNG y WEBP de hasta 5 MB, y sus políticas RLS permiten subir y borrar solo al admin.

Mientras completa el formulario, el admin ve una **vista previa en vivo** con el mismo componente de la cartelera: el formulario se convierte en signal con `toSignal` y la imagen se muestra antes de subirla con `URL.createObjectURL`.

### Manejo de fechas
Las fechas de calendario (estreno, días del reporte) se manejan como texto `'YYYY-MM-DD'`: se comparan directamente como texto, porque en ese formato el orden alfabético coincide con el cronológico, y se formatean separando el texto. De esta forma cada fecha se muestra igual en cualquier zona horaria.

### Butacas en tiempo real
La pantalla de butacas se suscribe con **Supabase Realtime** a las entradas nuevas de esa función: cuando otra persona compra una butaca, aparece ocupada al instante. La suscripción se cierra al salir de la pantalla.

### Compras, cancelaciones, crédito y puntos
- Cada compra genera una **orden** con **un único QR** que equivale a todo: las entradas de todas las butacas y el candy bar. El PDF trae ese solo código.
- **Cancelación:** disponible hasta 2 hs antes de la función mientras ninguna entrada se haya usado. El monto pagado se acredita como crédito y los puntos canjeados se devuelven. Las butacas vuelven a quedar libres: un trigger de la base marca las entradas de la compra como canceladas (`entradas.cancelada`), y la regla de una entrada por butaca es un índice único parcial que solo cuenta las vigentes. Las entradas canceladas se conservan para el historial de "Mis compras".
- **Límite:** hasta 6 butacas por persona y por función, sumando todas sus compras de esa función. Se controla en la pantalla y se vuelve a verificar al comprar.
- **Puntos:** 1 por cada peso pagado. El costo en puntos de la entrada gratis se configura en la pantalla Fidelización, y el de cada producto de candy al darlo de alta.
- **Cupones:** se aplica el de mayor porcentaje entre los que le correspondan al usuario.

### Reportes
Se calculan a partir de las órdenes vigentes (no canceladas), agrupando los datos con `Map`. Las películas más vistas se muestran en ventanas móviles de los últimos 7 y 30 días. La exportación a **PDF** (jsPDF) y **Excel** (SheetJS) toma los mismos datos que se ven en pantalla.

### Log de actividad
Cada acción del admin y del empleado queda registrada con usuario, fecha y hora: alta de películas, funciones (una entrada por función), productos y combos; películas mostradas u ocultadas; funciones borradas; productos sacados de la venta; cambios de precios, cupones y puntos; apertura de preventas y validación de QR.

### PWA
La aplicación se puede instalar y funciona sin conexión gracias al service worker de Angular, que se activa en el build de producción (configurado en `ngsw-config.json`):

- **Interfaz:** el código, los estilos, las fuentes y las imágenes de la app se guardan al instalarla.
- **Cartelera sin conexión:** las consultas de películas, funciones, géneros, reseñas y ventas (para el Top 3) se guardan con la estrategia `freshness`: con conexión siempre se piden datos nuevos, y sin conexión se muestra lo último guardado. Los pósters se guardan la primera vez que se ven.
- **Aviso:** sin conexión aparece una franja que avisa que se está viendo información guardada y que para comprar hace falta internet. Las compras, el login y los datos personales siempre van a la red.

El mismo service worker recibe y muestra las notificaciones push.

---

## 📋 Requerimientos

### Base
- [x] Inicialización del proyecto con Angular 22
- [x] Conexión y configuración inicial con Supabase
- [x] Configuración como Progressive Web App (PWA): instalable, con la cartelera disponible sin conexión
- [x] Identidad visual propia y producida ("Hollownest Cinema"), con modo claro/oscuro

### Catálogo de películas
- [x] Cartelera (home) con listado de películas
- [x] El admin elige qué películas aparecen en la página (mostrar / ocultar)
- [x] Alta de películas con póster subido a Supabase Storage y vista previa de cómo se verá en la cartelera
- [x] Detalle de película (sinopsis, navegación por slug en la URL)
- [x] Buscador de texto + filtro por género (una película puede tener varios géneros)
- [x] Top 3 películas más vendidas destacadas primero en la home
- [x] Reseñas: calificación con estrellas + comentario corto, visibles antes de sacar entradas, con promedio

### Funciones y salas
- [x] Alta de funciones: película, horario, formato (2D/3D/4D/5D) e idioma (castellano o subtitulada)
- [x] Baja de funciones que todavía no tienen entradas vendidas
- [x] Funciones repetidas: varios días de la semana a la misma hora, entre dos fechas, de una sola vez
- [x] Margen obligatorio de 30 min entre funciones de una misma sala
- [x] Asignación automática de sala al crear cada función, sin superposiciones
- [x] Selector de fecha y hora con input nativo
- [x] Layout de butacas: sala de 19 filas en bloques 4/20/4, con las filas J y K reemplazadas por una única fila J de butacas accesibles (2/10/2) y filas R, S y T VIP con precio diferencial, cada una con su marca visual y aviso antes de pagar
- [x] Selección de butacas en tiempo real con Supabase Realtime
- [x] Restricción de edad por película (+13 / +18): bloqueo de la compra a menores y aviso en la entrada de que debe asistir acompañado de un adulto

### Compra y entradas
- [x] Selección de butacas + compra, con cuenta o como invitado (opción que el usuario elige)
- [x] Límite de 6 butacas por usuario y por función (sumando todas sus compras de esa función)
- [x] PDF con los datos de la compra + un único código QR para todas las entradas y el candy
- [x] Cupón de descuento en la primera compra, con porcentaje configurable por el admin
- [x] Cupón exclusivo para usuarios mayores de 50 años, también configurable
- [x] Si un usuario califica para dos cupones, se aplica el de mayor porcentaje
- [x] Cancelación de una compra hasta 2 hs antes de la función, con el monto acreditado como crédito para compras futuras y las butacas liberadas
- [x] Mensaje de agradecimiento al terminar la compra; después lleva a "Mis compras" (con cuenta) o a la cartelera (invitado)

### Candy bar
- [x] Alta de productos (nombre, precio, imagen, categoría y costo en puntos)
- [x] Modificación del precio y de los puntos de canje, y baja lógica (sacar de la venta) de cada producto
- [x] Compra de candy junto con la entrada, en el mismo flujo de selección de butacas
- [x] Retiro de todo el pedido con el mismo QR de la compra
- [x] Combos especiales configurables por el admin (entrada + pochoclos + bebida a precio fijo), destacados en la pantalla de compra

### Roles y validación en puerta
- [x] Rol admin: gestión de películas (alta y visibilidad), funciones (alta y baja), productos (alta, modificación y baja lógica), candy bar, combos, cupones, fidelización, preventas y reportes (rutas protegidas con guard)
- [x] Rol empleado: validación de entradas y candy (rutas protegidas con guard)
- [x] Escaneo de QR por cámara: un solo código muestra la compra completa y permite validar las entradas y entregar el candy
- [x] Ingreso manual del código como alternativa al escaneo
- [x] Invalidación: las entradas y el candy de cada código se usan una sola vez
- [x] Log de actividad: quién creó cada función, quién modificó un precio, quién validó un QR, con fecha y hora
- [x] Guards en todas las rutas: pantallas personales solo con sesión, login y registro solo sin sesión, perfil completo obligatorio

### Fidelización
- [x] Acumulación de puntos por compra (1 punto por cada peso gastado)
- [x] Canje de puntos por entradas gratis o productos de candy bar, con el costo en puntos de cada recompensa configurable por el admin
- [x] Historial de puntos acumulados y canjes en el perfil del usuario
- [x] Puntos personales e intransferibles

### Próximamente y preventa
- [x] Sección "Próximamente" con películas que se estrenan en las próximas semanas
- [x] Alerta al usuario cuando se habilita la venta de entradas de una película que estaba en "Próximamente", con notificación push y aviso dentro de la app
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

La configuración de Supabase (URL y clave publicable) y la clave pública VAPID están en `src/environments/environment.ts`.

### Notificaciones push
1. Generar las claves VAPID (una sola vez):
   ```bash
   node scripts/generar-claves-vapid.mjs
   ```
2. Copiar la clave pública en `VAPID_PUBLIC_KEY` de los environments.
3. En Supabase:
   - Guardar el JSON con las dos claves como secreto `VAPID_KEYS` (Edge Functions → Secrets).
   - Publicar la Edge Function `supabase/functions/avisar-preventa/index.ts`.
   - Crear un Database Webhook sobre `peliculas` (evento Update) que llame a esa función.

Las notificaciones se prueban en el build de producción (por ejemplo, en el deploy de Vercel), donde el service worker está activo.