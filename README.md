# Trama — Red de transporte de Buenos Aires

App web de despliegue local para importar KML, organizar capas de transporte, dividir y recortar recorridos, editar sus vértices y agregar nodos. Interfaz en español, adaptable a escritorio y celular. No requiere cuenta, backend ni claves de mapas.

## Ejecutar localmente

Requiere **Node.js 22.12 o posterior** y npm.

```bash
npm ci
npm start
```

Abrí **http://127.0.0.1:5173**. El servidor escucha únicamente en tu computadora. El puerto es fijo para mantener la misma dirección del guardado local; si está ocupado, detené la otra aplicación o elegí otro puerto explícitamente.

Para servir la versión compilada:

```bash
npm run build
npm run preview
```

Abrí **http://127.0.0.1:4173**. También podés servir `dist/` con cualquier servidor HTTP estático; no abras el HTML con `file://`.

Como alternativa con Docker:

```bash
docker compose up --build -d
```

Abrí **http://127.0.0.1:8080**. Para detenerlo, ejecutá `docker compose down`.

## Capas

Cada capa tiene su propio color y control de visibilidad:

1. Tren regional.
2. Tren urbano.
3. Subte.
4. Tranvía.
5. Colectivo troncal.
6. Colectivo local.
7. Nodos: trasbordo, combinación o destino.

El ojo muestra u oculta la capa en el mapa. Hacer clic en el nombre de una capa filtra la lista de elementos; **Ver toda la red** limpia ese filtro. La búsqueda funciona sobre nombres y archivos de origen. Podés elegir un recorrido desde la lista o directamente sobre el mapa.

## Flujo para separar tramos troncales y locales

1. Usá **Importar KML** para elegir o arrastrar uno o varios archivos. Elegí **Colectivo local** como capa inicial. Opcionalmente, la app reconoce carpetas KML con los nombres de las siete capas; los puntos siempre se importan en Nodos.
2. En **Editar red**, seleccioná una línea de colectivo.
3. Elegí **Recortar** y marcá dos puntos **A** y **B** sobre el recorrido. Los puntos se ajustan al segmento de la línea y se pueden arrastrar. El tramo seleccionado se resalta en verde claro.
4. Elegí **Colectivo troncal** como capa del tramo recortado y dejá marcada **Conservar los tramos restantes**.
5. Aplicá **Separar y clasificar**. Obtenés el tramo central en la capa troncal y hasta dos tramos restantes en la capa original, con extremos coincidentes.
6. Repetí para otros tramos o recorridos. En la lista del editor podés seleccionar varios recorridos y moverlos juntos a otra capa.

Si desmarcás **Conservar los tramos restantes**, se conserva únicamente el tramo entre A y B. **Dividir** crea dos recorridos independientes con un solo corte y mantiene ambos en la capa original. Los cortes deben dejar tramos de al menos un metro. Todas estas operaciones se pueden deshacer.

## Editar y agregar

- **Nombre, capa y notas:** se guardan al cambiar de campo.
- **Editar vértices:** arrastrá los puntos del recorrido. Los puntos intermedios permiten agregar vértices; el clic derecho elimina uno. Terminá con **Guardar geometría** o descartá con **Cancelar cambios**. Para recorridos extensos se muestran los 100 vértices más cercanos al cursor dentro del mapa visible.
- **Dibujar recorrido:** elegí el ícono de recorrido en la barra del editor, hacé clic para agregar puntos y doble clic para terminar. Después podés nombrarlo y clasificarlo.
- **Agregar nodo:** elegí el ícono de nodos, hacé clic en el mapa y completá nombre, tipo y notas. **Mover nodo** permite arrastrarlo y guardar su ubicación.
- **Deshacer / rehacer:** botones del mapa o `Ctrl+Z` / `Ctrl+Mayús+Z` (`⌘` en macOS). Se conservan hasta 25 estados durante la sesión; el historial se reinicia al recargar.
- **Cancelar herramienta:** `Esc`. **Buscar:** `/`.
- **Administrar proyecto:** ícono de carpeta al lado del título de la lista. Permite cambiar el nombre, abrir un respaldo, cargar el ejemplo o empezar de cero.

La red de ejemplo y `tests/fixtures/recorridos.kml` contienen geometrías simplificadas para probar el editor. **No son recorridos oficiales ni sirven para planificar viajes.**

## Guardado, respaldos y archivos

Los datos se guardan automáticamente en **IndexedDB del navegador**, bajo la misma dirección local, perfil y navegador. Los KML no se envían a ningún servidor. Hay un proyecto activo por dirección; no se escribe automáticamente en tus archivos originales.

**Exportar → Proyecto Trama (.json)** guarda un respaldo completo de recorridos, nodos, capas y visibilidad. Usá **Administrar proyecto → Abrir proyecto** para recuperarlo. Abrir otro proyecto o cargar el ejemplo reemplaza el actual, previa confirmación, y se puede deshacer durante la sesión.

**Exportar → Red completa (.kml)** genera una carpeta por capa e incluye todas las capas, incluso las ocultas. También podés exportar una sola capa. Se conservan nombres, notas, geometrías, clasificación y tipos de nodo. No se conservan estilos arbitrarios del KML original, carpetas ajenas a las capas, altitudes, marcas de tiempo ni geometrías que la app no edita.

Importación: `LineString`, `Point`, `MultiGeometry` (separa sus componentes) y `gx:Track` (como línea). La app no impone límites de tamaño de archivo, cantidad de elementos ni cantidad de vértices. La capacidad efectiva depende de la memoria y del almacenamiento disponibles en el navegador. Las geometrías inválidas o incompatibles se omiten con un aviso; un archivo sin elementos válidos no se importa. No se admiten KMZ, polígonos ni enlaces de red. Para KMZ, extraé primero el KML.

**Exportá respaldos regularmente.** Borrar los datos del sitio, cambiar de navegador o usar otra dirección/puerto crea un espacio de guardado diferente. Por ejemplo, `localhost:5173`, `127.0.0.1:5173`, la vista compilada y Docker tienen guardados separados; usá el JSON para trasladar el proyecto.

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

Tecnologías: Vite, JavaScript, Leaflet, Leaflet-Geoman y Lucide. El resultado de `npm run build` es una aplicación estática en `dist/`.
