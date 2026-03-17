# Plan: Modo Calendario para To Done

## Resumen
Agregar un modo de gestión "Calendario" como alternativa al modo "Simple" (hoy/después). El usuario elige en settings cuál usar. En modo calendario, las tareas se organizan por día usando el campo `dueDate` existente, con un mini-calendario desplegable para navegar entre días y un banner interactivo para tareas vencidas.

## Decisiones de diseño
- **Overdue**: Banner interactivo "Tenés X tareas vencidas" con opciones por tarea
- **Modelo de datos**: Reusar `dueDate` (YYYY-MM-DD) como fecha planificada
- **UX**: Toggle en settings → modo Simple vs modo Calendario

---

## Pasos de implementación

### Paso 1: Estado y persistencia del modo
**Archivo**: `todone.jsx`

- Agregar estado `viewMode` con valores `"simple"` | `"calendar"` (default: `"simple"`)
- Persistir en `localStorage` con key `todone_viewMode`
- Agregar toggle en el menú de cuenta/settings existente
- Agregar traducciones i18n para las nuevas strings (AR, ES, EN)

### Paso 2: Componente CalendarStrip (navegación por semana)
**Archivo**: `todone.jsx`

- Componente inline que muestra la semana actual (L M M J V S D) con fecha
- Día actual resaltado (similar a la referencia de Todoist)
- Click en un día → selecciona ese día como `selectedDate`
- Flechas ← → para navegar semana anterior/siguiente
- Dropdown expandible a vista mensual (reusar/adaptar `MiniCalendar` existente)
- Indicadores visuales (puntos) en días que tienen tareas asignadas
- Estado: `selectedDate` (default: hoy)

### Paso 3: Vista de tareas por día
**Archivo**: `todone.jsx`

- Cuando `viewMode === "calendar"`:
  - Reemplazar las secciones "Hoy" / "Deferred" por una sola sección del día seleccionado
  - Filtrar tareas donde `dueDate === selectedDate` (formato YYYY-MM-DD)
  - Mostrar tareas sin dueDate en una sección colapsable "Sin fecha" abajo
  - Mantener la sección "Completadas" existente (filtrada por día seleccionado)
  - Título dinámico: "Hoy", "Mañana", "Ayer", o la fecha formateada

### Paso 4: Banner de tareas vencidas (overdue)
**Archivo**: `todone.jsx`

- Al montar el componente (y al cambiar de modo), calcular tareas overdue:
  - `dueDate < hoy` AND `done === false`
- Mostrar banner arriba de la lista: "Tenés X tareas vencidas"
- Click en el banner → modal/panel con lista de tareas overdue
- Por cada tarea, opciones:
  - "Mover a hoy" → actualiza `dueDate` al día actual
  - "Reprogramar" → abre MiniCalendar para elegir nueva fecha
  - "Descartar" → elimina `dueDate` (va a "Sin fecha")
- El banner se oculta cuando no quedan tareas overdue
- Funciona en ambos modos (simple y calendario)

### Paso 5: Ajustes al crear/editar tareas
**Archivo**: `todone.jsx`

- En modo calendario, al crear una tarea nueva:
  - Asignar automáticamente `dueDate = selectedDate`
  - Asignar `scheduledFor = "hoy"` si selectedDate es hoy, `"semana"` si es futuro
- En el AddTaskPanel, mostrar la fecha seleccionada como contexto
- Permitir cambiar la fecha desde el TaskItem (ya existe el date picker)

### Paso 6: Traducciones i18n
**Archivo**: `todone.jsx`

Agregar strings para los tres locales (AR, ES, EN):
- "Modo de vista" / "View mode"
- "Simple" / "Calendario" / "Calendar"
- "Tareas vencidas" / "Overdue tasks"
- "Mover a hoy" / "Move to today"
- "Reprogramar" / "Reschedule"
- "Sin fecha" / "No date"
- "Descartar" / "Dismiss"
- Días de la semana abreviados
- Nombres de meses

### Paso 7: Estilos y responsive
**Archivo**: `todone.jsx`

- CalendarStrip: diseño horizontal responsive (scroll en mobile si es necesario)
- Banner overdue: colores de advertencia (naranja/rojo), consistente con el theme dark/light
- Indicadores de día con tareas: puntos pequeños debajo del número
- Día actual: círculo rojo (como en la referencia de Todoist)
- Día seleccionado: círculo outline o fondo suave
- Transiciones suaves al cambiar de día

---

## No incluido en este alcance
- Drag & drop entre días del calendario
- Vista semanal/mensual completa con timeline
- Integración con Google Calendar
- Tareas recurrentes
