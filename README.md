# Trama — Red de transporte de Buenos Aires

App web de despliegue local para importar KML, organizar capas de transporte, dividir y recortar recorridos, editar sus vértices y agregar nodos. Interfaz en español, adaptable a escritorio y celular. Incluye un servidor local que guarda el trabajo automáticamente en el repositorio. No requiere cuenta ni claves de mapas.

## Ejecutar localmente

Requiere **Node.js 22.12 o posterior** y npm.

```bash
npm ci
npm start
```

Abrí **http://127.0.0.1:5173**. El servidor escucha únicamente en tu computadora. Los cambios se guardan automáticamente en **`data/proyecto.json`**. Si el puerto está ocupado, detené la otra aplicación o elegí otro puerto explícitamente.

Para servir la versión compilada:

```bash
npm run build
npm run serve
```

Abrí **http://127.0.0.1:8080**. Este servidor sirve `dist/` y el guardado en archivos sin depender de Vite. También podés usar `npm run preview` en **http://127.0.0.1:4173**, con el mismo guardado automático. No abras el HTML con `file://`.

Para guardar en el repositorio, usá uno de estos servidores incluidos. Un servidor estático ajeno a la app solo permite guardar en el navegador y la interfaz lo indica explícitamente.

Como alternativa con Docker:

```bash
docker compose up --build -d
```

Abrí **http://127.0.0.1:8080**. Docker monta `./data` del repositorio en el contenedor: los archivos permanecen en tu computadora al detenerlo o reconstruirlo. Para detenerlo, ejecutá `docker compose down`. La carpeta `data/` debe ser escribible por el usuario del contenedor (UID 1000).

## Capas

Cada capa tiene su propio color y control de visibilidad:

1. Tren regional.
2. Tren urbano.
3. Subte.
4. Tranvía.
5. Colectivo troncal.
6. Colectivo local.
7. Colectivos a suprimir.
8. Nodos: trasbordo, combinación o destino.

**Colectivos a suprimir** permite clasificar los recorridos propuestos para supresión. Está disponible al importar, editar, recortar y mover selecciones de recorridos, con carpetas por línea, visibilidad independiente, exportación KML y guardado automático.

El ojo muestra u oculta la capa en el mapa. Hacer clic en el nombre de una capa filtra la lista de elementos; **Ver toda la red** limpia ese filtro. La búsqueda funciona sobre nombres, líneas de colectivo y archivos de origen. Podés elegir un recorrido desde la lista o directamente sobre el mapa.

El círculo de color junto al ojo permite cambiar el color de cualquier capa, incluso Nodos. El cambio se aplica al mapa, íconos y referencias, se guarda automáticamente y se puede deshacer. Los colores personalizados también se conservan en los respaldos JSON y en los KML exportados por Trama.

Todas las capas con elementos tienen una flecha para desplegarlos. Trenes, subte y tranvía muestran sus recorridos; Nodos muestra sus puntos; colectivos conserva sus carpetas por línea. El ojo junto a cada elemento permite ocultarlo o volver a mostrarlo individualmente. Plegar una lista mantiene su visibilidad en el mapa. Las listas largas ofrecen **Mostrar más** hasta llegar a todos los elementos.

Al seleccionar un ramal, se resalta con un trazo fucsia continuo de borde blanco y oscuro, una etiqueta fija con su nombre y marcas de inicio y fin. Los demás recorridos se atenúan y la selección también se identifica en la lista y en su carpeta.

### Carpetas de líneas de colectivo

**Colectivo troncal**, **Colectivo local** y **Colectivos a suprimir** contienen carpetas por línea, por ejemplo **Línea 59** y **Línea 152**. El número se reconoce en las carpetas KML, los nombres de los recorridos y, como alternativa, el nombre del archivo. Los proyectos anteriores se adaptan automáticamente al abrirse. Los recorridos sin una línea reconocible aparecen en **Sin línea asignada**.

- La flecha junto a una capa despliega o contrae sus carpetas. La flecha de cada carpeta muestra sus recorridos; plegarla no los oculta del mapa.
- El ojo de una carpeta muestra u oculta todos sus recorridos. **Línea 59** puede estar oculta en local y visible en troncal. Apagar y encender una capa mantiene las preferencias de sus carpetas; **Mostrar todas** vuelve a activar toda la red.
- Hacer clic en el nombre de una carpeta filtra la lista de abajo por esa línea y capa. Seleccionar un recorrido oculto desde la lista vuelve a mostrar su carpeta.
- En **Editar red**, el campo **Línea / carpeta** permite asignar un recorrido a otra línea o crear una nueva carpeta. Se admiten números y nombres personalizados. Dejarlo vacío lo mueve a **Sin línea asignada**.
- Para agrupar varios recorridos, seleccionalos con las casillas de la lista, completá **Carpeta para los colectivos seleccionados** y elegí **Agrupar**. Solo se modifican los colectivos seleccionados.
- El lápiz de una carpeta permite cambiar su nombre para todos sus recorridos. Si el nombre coincide con otra carpeta de la misma capa, ambas se unen. La asignación y el cambio de nombre se pueden deshacer.

Los recortes, las divisiones y los cambios entre capas conservan la línea del recorrido. Los respaldos JSON conservan la agrupación y la visibilidad; el KML exportado contiene subcarpetas por línea dentro de cada capa de colectivos y conserva sus nombres y visibilidad al reimportarlo.

## Flujo para separar tramos troncales y locales

1. Usá **Importar KML** para elegir o arrastrar uno o varios archivos. Elegí **Colectivo local** como capa inicial. Opcionalmente, la app reconoce carpetas KML con los nombres de las capas; los puntos siempre se importan en Nodos.
2. En **Editar red**, seleccioná una línea de colectivo.
3. Elegí **Recortar** y marcá dos puntos **A** y **B** sobre el recorrido. Los puntos se ajustan al segmento de la línea y se pueden arrastrar. El tramo seleccionado se resalta en verde claro.
4. Elegí **Colectivo troncal** como capa del tramo recortado y dejá marcada **Conservar los tramos restantes**.
5. Aplicá **Separar y clasificar**. Obtenés el tramo central en la capa troncal y hasta dos tramos restantes en la capa original, con extremos coincidentes.
6. Repetí para otros tramos o recorridos. En la lista del editor podés seleccionar varios recorridos y moverlos juntos a otra capa.

Si desmarcás **Conservar los tramos restantes**, se conserva únicamente el tramo entre A y B. **Dividir** crea dos recorridos independientes con un solo corte y mantiene ambos en la capa original. Los cortes deben dejar tramos de al menos un metro. Todas estas operaciones se pueden deshacer.

## Editar y agregar

- **Nombre, capa, línea y notas:** se guardan al cambiar de campo.
- **Editar vértices:** arrastrá los puntos del recorrido. Los puntos intermedios permiten agregar vértices; el clic derecho elimina uno. Terminá con **Guardar geometría** o descartá con **Cancelar cambios**. Para recorridos extensos se muestran los 100 vértices más cercanos al cursor dentro del mapa visible.
- **Dibujar recorrido:** elegí el ícono de recorrido en la barra del editor, hacé clic para agregar puntos y doble clic para terminar. Después podés nombrarlo y clasificarlo.
- **Agregar nodo:** elegí el ícono de nodos, hacé clic en el mapa y completá nombre, tipo y notas. **Mover nodo** permite arrastrarlo y guardar su ubicación.
- **Deshacer / rehacer:** botones del mapa o `Ctrl+Z` / `Ctrl+Mayús+Z` (`⌘` en macOS). Se conservan hasta 25 estados durante la sesión; el historial se reinicia al recargar.
- **Cancelar herramienta:** `Esc`. **Buscar:** `/`.
- **Administrar proyecto:** ícono de carpeta al lado del título de la lista. Permite cambiar el nombre, abrir un respaldo, cargar el ejemplo o empezar de cero.

La red de ejemplo y `tests/fixtures/recorridos.kml` contienen geometrías simplificadas para probar el editor. **No son recorridos oficiales ni sirven para planificar viajes.**

## Guardado, respaldos y archivos

Cada importación, recorte, división, edición guardada, cambio de carpeta, nodo, nombre, nota, color de capa y cambio de visibilidad se guarda automáticamente en **`data/proyecto.json`**, dentro del repositorio. El servidor local valida el proyecto y reemplaza el archivo mediante una escritura temporal y un cambio de nombre, para evitar dejarlo incompleto. El indicador **Guardado en el repositorio** aparece cuando termina la escritura. Si falla, muestra **Pendiente de guardar** y permite reintentar.

El archivo incluye todas las coordenadas y propiedades de los recorridos, nodos, capas y carpetas. Está habilitado para versionarse con Git; la app no crea commits ni hace push automáticamente. Los KML originales no se modifican: los recorridos importados quedan incorporados al JSON. Al reiniciar el servidor, cambiar de navegador o clonar el repositorio con el archivo, se recupera el mismo proyecto. Hay un proyecto activo por carpeta de datos.

**Migración del guardado anterior:** si todavía no existe `data/proyecto.json`, al abrir la app desde el navegador y la dirección donde trabajabas se traslada automáticamente el proyecto de IndexedDB al repositorio. Si el archivo ya existe, se carga como versión principal. IndexedDB sigue funcionando como copia de recuperación; su disponibilidad no es necesaria para guardar en el repositorio. Los datos se envían únicamente al servidor local de Trama.

Si una escritura falla, los cambios quedan pendientes y se reintentan al volver a abrir la app, siempre que no haya otra versión más nueva del archivo. Si dos pestañas editan versiones distintas, la app conserva los cambios y ofrece **Resolver**: abrir la versión del repositorio, guardar los cambios actuales o descargar un respaldo. Un archivo corrupto en disco se informa y no se sobrescribe automáticamente.

Por defecto se usa `data/` de este checkout. Para elegir otra carpeta, iniciá con `TRAMA_DATA_DIR=/ruta/a/datos npm start` (también aplica a `npm run preview` y `npm run serve`). El servidor de la versión compilada admite `PORT` y `HOST`; por defecto escucha en `127.0.0.1:8080`.

**Exportar → Proyecto Trama (.json)** guarda un respaldo completo de recorridos, nodos, capas y visibilidad. Usá **Administrar proyecto → Abrir proyecto** para recuperarlo. Abrir otro proyecto o cargar el ejemplo reemplaza el actual, previa confirmación, y se puede deshacer durante la sesión.

**Exportar → Red completa (.kml)** genera una carpeta por capa y subcarpetas por línea en las capas de colectivos; incluye también las capas y líneas ocultas. También podés exportar una sola capa. Se conservan nombres, notas, geometrías, clasificación, líneas de colectivo, colores personalizados, visibilidad individual y tipos de nodo. Los KML exportados por Trama recuperan los colores y los elementos ocultos al reimportarlos. No se conservan otros estilos arbitrarios del KML original, carpetas ajenas a esta organización, altitudes, marcas de tiempo ni geometrías que la app no edita.

Importación: `LineString`, `Point`, `MultiGeometry` (separa sus componentes) y `gx:Track` (como línea). La app no impone límites de tamaño de archivo, cantidad de elementos ni cantidad de vértices. La capacidad efectiva depende de la memoria y del almacenamiento disponibles en el navegador. Las geometrías inválidas o incompatibles se omiten con un aviso; un archivo sin elementos válidos no se importa. No se admiten KMZ, polígonos ni enlaces de red. Para KMZ, extraé primero el KML.

**Exportá respaldos regularmente o versioná `data/proyecto.json` con Git.** Borrar los datos del navegador ya no elimina el proyecto del repositorio. Desarrollo, vista previa y Docker comparten el proyecto si apuntan a la misma carpeta `data/`. Un guardado previo que todavía exista solo en el navegador requiere abrir primero su dirección y perfil originales para migrarlo.

## Mapas y conexión

El mapa inicia en Buenos Aires y usa teselas de [OpenStreetMap](https://www.openstreetmap.org/copyright). **Mapa claro** reduce el color del fondo para destacar la red; **Calles** muestra el estilo original. Las teselas requieren conexión y están sujetas a la [política de uso de OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/). No se descargan áreas para uso sin conexión.

Una vez instalada y servida localmente, la app no necesita internet para importar, editar, guardar y exportar. Elegí **Sin mapa base** para trabajar con tus geometrías sobre una cuadrícula. No hay dependencias de fuentes, scripts o estilos cargados desde CDN.

## Verificación

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Las pruebas de geometría verifican continuidad y conservación de longitudes después de cortes, recortes en ambos sentidos y casos inválidos. También verifican importación/exportación KML y validación de respaldos. Las pruebas en Chromium cubren el flujo real de importación, clasificación, recorte, división, edición, nodos, deshacer/rehacer, guardado al recargar, exportación, restauración JSON y navegación móvil. Las pruebas de navegador sustituyen las teselas externas para no depender de la red ni consumir servidores de mapas públicos.

Las pruebas de persistencia verifican escritura y recuperación desde archivos, conservación de datos inválidos o en conflicto, migración del guardado anterior, recuperación después de fallos y carga desde un navegador sin almacenamiento previo. Las pruebas usan carpetas temporales y el puerto 5174; no escriben en los datos reales del repositorio.

Tecnologías: Vite, JavaScript, Node.js, Leaflet, Leaflet-Geoman y Lucide. La interfaz compilada está en `dist/`; el servidor local y la API de archivos están en `server/`.
