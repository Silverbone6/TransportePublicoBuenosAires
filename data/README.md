# Datos del proyecto

La app guarda automáticamente el proyecto completo en `proyecto.json` dentro de esta carpeta. El archivo se crea con el primer cambio o al migrar un guardado previo del navegador.

Incluye recorridos y sus coordenadas, nodos, nombres, notas, capas, colores personalizados, carpetas de líneas y visibilidad de capas, carpetas y elementos individuales. Cada guardado reemplaza el archivo mediante una escritura temporal y un cambio de nombre para evitar archivos incompletos.

`proyecto.json` está habilitado para versionarse con Git. No se agregan commits ni se envía información a servicios externos automáticamente. Los KML originales no se modifican; sus recorridos importados quedan incorporados a este archivo.

Al mover o clonar el repositorio con este archivo, la app carga los mismos datos. Para usar otra carpeta de almacenamiento se puede definir `TRAMA_DATA_DIR` al iniciar el servidor.
