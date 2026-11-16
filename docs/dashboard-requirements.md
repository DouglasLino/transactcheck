# Prompt para Codex — Rediseño integral del Dashboard de TransactCheck MVP1

Necesito mejorar significativamente el Dashboard actual de TransactCheck. La implementación existente funciona, pero la vista es demasiado básica: muestra algunos contadores, totales monetarios y distribuciones, sin permitir analizar, inspeccionar o investigar los resultados directamente desde el Dashboard.

Quiero transformar esta pantalla en un **Dashboard profesional, interactivo, detallado y orientado al análisis de transacciones financieras**, sin modificar el alcance funcional aprobado para el MVP1.

## 1. Reglas obligatorias

Antes de implementar:

1. Leer completamente `AGENTS.md` y respetar todas sus decisiones y restricciones.
2. Revisar la arquitectura existente, los componentes React, el motor Python/Pyodide, los modelos normalizados, los filtros, las métricas y los diagnósticos.
3. Reutilizar las funcionalidades existentes y evitar implementar lógica duplicada en JavaScript.
4. Mantener Python como responsable de los cálculos monetarios, filtros, agregaciones y análisis de transacciones.
5. Mantener la precisión con `Decimal`, transportando los importes como strings.
6. No introducir backend, base de datos, servicios externos ni procesamiento remoto.
7. No implementar exportaciones de ningún tipo.
8. Mantener compatibilidad con GitHub Pages.
9. Conservar PrimeReact y las tecnologías existentes.
10. No modificar `AGENTS.md`.
11. No realizar commits, push ni publicaciones.
12. No alterar las reglas de detección, normalización o validación únicamente para facilitar el rediseño visual.

## 2. Objetivo principal

Quiero que el Dashboard permita responder directamente a estas preguntas:

- ¿Cuántas transacciones fueron procesadas?
- ¿Cuántas son válidas, inválidas o no identificadas?
- ¿Por qué una transacción fue considerada inválida?
- ¿Qué registros tienen advertencias?
- ¿Cuáles son los errores más frecuentes?
- ¿Qué valores originales fueron normalizados?
- ¿Cuántas transacciones tienen montos positivos, negativos o cero?
- ¿Cuáles son los importes totales por moneda?
- ¿Cuántas transacciones corresponden a cada estado?
- ¿Qué tipos de transacciones existen?
- ¿Cuántas operaciones provienen de cada archivo?
- ¿Existen posibles duplicados?
- ¿Qué registros tienen campos incompletos?
- ¿Qué registros requieren revisión?
- ¿Cómo cambian las métricas al aplicar filtros?
- ¿Puedo localizar y examinar una transacción sin abandonar esta pantalla?

El objetivo no es únicamente mostrar más información, sino permitir investigar los datos.

## 3. Rediseño visual y estructural

Rediseñar completamente la distribución del Dashboard para aprovechar mejor el espacio horizontal y vertical.

Diseñar una interfaz moderna de análisis de datos, similar a herramientas empresariales de observabilidad y analítica financiera.

Requisitos visuales:

- Diseño limpio y profesional.
- Interfaz completamente en español.
- Compatible con modo claro y oscuro.
- Diseño responsive.
- Jerarquía visual clara.
- Tarjetas compactas, pero informativas.
- Espaciado consistente.
- Tipografía legible.
- Tablas con buen aprovechamiento del espacio.
- Gráficos interactivos donde realmente aporten información.
- Colores coherentes y consistentes.
- Indicadores positivos, negativos y neutrales.
- Tooltips para explicar métricas y conceptos.
- Estados vacíos bien diseñados.
- Evitar grandes espacios desperdiciados.
- Evitar barras de progreso innecesarias.
- Evitar gráficos decorativos sin valor analítico.
- No saturar la pantalla con tarjetas gigantes.

Organizar el Dashboard por secciones claramente identificadas.

## 4. Barra superior de análisis

Crear una cabecera con:

- Título Dashboard.
- Descripción breve de la vista.
- Cantidad de archivos activos.
- Cantidad de registros procesados.
- Indicador de diagnósticos disponibles.
- Botón para restablecer filtros del Dashboard.

Debajo, crear una barra de filtros compacta que incluya, utilizando únicamente criterios soportados por el motor:

- Archivo de origen.
- Estado normalizado.
- Tipo de transacción.
- Moneda.
- Validez de la transacción.
- Rango de fechas.
- Búsqueda por identificador o referencia.

Los filtros deben poder combinarse.

Al cambiar un filtro, deben actualizarse los indicadores, tablas, gráficos y distribuciones que correspondan al conjunto filtrado.

Mostrar claramente cuándo los resultados están filtrados.

Distinguir los totales globales de los totales filtrados.

No representar como resultados globales los valores de un subconjunto filtrado.

## 5. Tarjetas principales de indicadores

Crear una sección superior con indicadores claros.

### Procesamiento

- Transacciones procesadas.
- Transacciones válidas.
- Transacciones inválidas.
- Porcentaje de transacciones válidas.
- Objetos no identificados.

### Calidad

- Registros con advertencias.
- Registros con errores.
- Total de diagnósticos.
- Posibles duplicados.

No confundir cantidad de diagnósticos con cantidad de registros afectados: una transacción puede generar varios diagnósticos.

Cada tarjeta debe incorporar:

- Título.
- Valor principal.
- Descripción breve.
- Tooltip explicativo.
- Indicador visual apropiado.
- Acción para consultar el detalle correspondiente.

Por ejemplo, seleccionar la tarjeta "Inválidas" debe mostrar directamente las transacciones inválidas dentro de la sección de exploración.

No utilizar tarjetas únicamente decorativas.

## 6. Análisis monetario avanzado

Mejorar completamente la sección "Totales por moneda".

Mostrar una tabla detallada con:

- Moneda.
- Cantidad de operaciones válidas.
- Cantidad de operaciones positivas.
- Cantidad de operaciones negativas.
- Cantidad de operaciones con monto cero.
- Suma de positivos.
- Suma de negativos.
- Total neto.

Reglas:

- No sumar monedas diferentes entre sí.
- No convertir monedas.
- No utilizar operaciones monetarias de JavaScript para recalcular resultados.
- Usar exclusivamente valores calculados por Python con `Decimal`.
- Los montos negativos son válidos cuando cumplen las reglas de validación.
- No tratar un importe cero como inválido automáticamente.
- Respetar las reglas existentes sobre importes ambiguos.

Agregar una visualización comparativa por moneda, apropiada para cantidades positivas y negativas.

Permitir seleccionar una moneda y consultar las transacciones que componen sus resultados.

Agregar una opción para alternar entre visualización gráfica y tabular cuando sea útil.

## 7. Distribución por estados

Reemplazar la presentación actual de barras simples por una sección más informativa.

Mostrar:

- Estado normalizado.
- Cantidad de transacciones.
- Porcentaje respecto al conjunto correspondiente.
- Representación visual de la distribución.

Estados como `APPROVED`, `PENDING`, `REJECTED`, `FAILED`, `CANCELLED`, `REFUNDED` y `UNKNOWN` deben respetar el catálogo existente.

No crear estados nuevos sin justificación.

Al seleccionar un estado, filtrar o abrir los registros correspondientes.

Los estados con cero operaciones no deben ocupar espacio excesivo. Pueden mostrarse dentro de un apartado secundario.

## 8. Distribución por tipos

Crear una sección para analizar las transacciones según su tipo.

Mostrar:

- Tipo normalizado.
- Cantidad.
- Porcentaje.
- Registros asociados.

Dar tratamiento visible a `SIN_TIPO`, sin interpretarlo automáticamente como una transacción inválida.

Permitir consultar las operaciones de cada categoría.

## 9. Análisis por archivo de origen

La sección actual "Por fuente" es demasiado limitada.

Reemplazarla por una tabla de análisis por archivo.

Mostrar, según los datos disponibles:

- Nombre del archivo.
- Fuente declarada en el JSON.
- Transacciones detectadas.
- Transacciones válidas.
- Transacciones inválidas.
- Objetos no identificados.
- Diagnósticos.
- Posibles duplicados.

Distinguir el nombre físico del archivo del campo `source`, ya que no necesariamente representan lo mismo.

Permitir seleccionar un archivo para examinar exclusivamente sus registros y diagnósticos.

No combinar archivos diferentes solo porque compartan el mismo valor de `source`.

## 10. Explorador de transacciones dentro del Dashboard

Esta es una de las mejoras más importantes.

Agregar una sección denominada "Explorador de transacciones".

Debe contener una tabla interactiva con los registros procesados.

Columnas sugeridas:

- Identificador.
- Fecha.
- Tipo.
- Estado.
- Monto.
- Moneda.
- Validez.
- Diagnósticos.
- Archivo de origen.
- Acciones.

Adaptar las columnas a los nueve campos del modelo normalizado existente y a los metadatos disponibles.

No inventar atributos adicionales.

Funciones necesarias:

- Buscar transacciones.
- Filtrar.
- Ordenar.
- Paginar.
- Seleccionar registros.
- Identificar rápidamente los inválidos.
- Mostrar advertencias.
- Ver detalle completo.
- Consultar la trazabilidad.

La paginación debe ubicarse debajo de la tabla.

Los filtros y la paginación deben utilizar el motor Python existente.

No cargar o renderizar innecesariamente miles de filas en el navegador.

## 11. Inspector detallado de transacciones

Al seleccionar una transacción, abrir un panel lateral amplio o un diálogo de detalle.

Preferiblemente usar un Drawer de PrimeReact, si resulta compatible con la arquitectura actual.

El inspector debe mostrar:

### Información general

- Identificador de la transacción.
- Archivo de origen.
- Ruta del objeto dentro del JSON original.
- Estado de validez.
- Tipo.
- Estado normalizado.
- Fecha.
- Monto.
- Moneda.

### Datos originales

Mostrar el objeto JSON original de esa transacción, exclusivamente para consulta.

Presentarlo con formato legible y estructura expandible.

### Datos normalizados

Mostrar los nueve campos del modelo normalizado.

Distinguir los valores disponibles de los ausentes.

### Transformaciones

Cuando exista trazabilidad, mostrar:

- Campo original.
- Valor original.
- Campo normalizado.
- Valor resultante.
- Regla o transformación aplicada, si está registrada.

No inventar transformaciones que no estén disponibles.

### Diagnósticos

Mostrar todos los diagnósticos asociados al registro:

- Severidad.
- Código.
- Mensaje.
- Campo afectado, si existe.
- Información adicional disponible.

Distinguir errores de advertencias.

### Posibles duplicados

Cuando corresponda, mostrar las relaciones de posibles duplicados existentes y permitir consultar los registros relacionados.

No marcar automáticamente como duplicado confirmado un registro que solo sea sospechoso.

## 12. Centro de diagnósticos

Agregar una sección denominada "Diagnósticos y calidad de datos".

El Dashboard actual muestra únicamente:

- WARNING.
- ERROR.

Esto es insuficiente.

Quiero poder inspeccionar los diagnósticos reales.

Incluir:

- Total de diagnósticos.
- Cantidad por severidad.
- Cantidad por código.
- Diagnósticos más frecuentes.
- Registros afectados.
- Archivos afectados.

Agregar una tabla con:

- Severidad.
- Código.
- Mensaje.
- Alcance `FILE` o `RECORD`.
- Archivo.
- Transacción relacionada, cuando exista.
- Campo afectado, cuando esté disponible.
- Acción para inspeccionar.

Permitir filtrar por severidad, alcance, archivo y código.

Cada diagnóstico debe permitir llegar al registro relacionado cuando exista.

Los diagnósticos de nivel `FILE` deben mostrarse incluso cuando no tengan una transacción asociada.

No ocultar errores de archivos rechazados en las vistas que correspondan.

## 13. Objetos no identificados

Actualmente el Dashboard muestra un contador de objetos no identificados, pero no permite saber cuáles son.

Agregar una sección para revisar estos objetos.

Mostrar:

- Archivo de origen.
- Ruta dentro del JSON.
- Motivo de no identificación, cuando esté disponible.
- Vista del objeto original.
- Diagnósticos asociados, si existen.

Al seleccionar un objeto, mostrar su contenido y trazabilidad.

No convertir automáticamente estos objetos en transacciones.

No incluirlos en totales monetarios ni tratarlos como transacciones inválidas.

## 14. Análisis de posibles duplicados

Incorporar una sección específica para los posibles duplicados.

Mostrar:

- Cantidad de registros involucrados.
- Grupos o relaciones de posibles duplicados.
- Identificadores afectados.
- Archivos de origen.
- Criterios existentes utilizados para la detección, cuando estén disponibles.

Permitir consultar los registros involucrados desde el inspector.

Respetar las reglas existentes del motor.

No introducir eliminación automática ni consolidación de transacciones.

## 15. Análisis temporal

Si existen fechas normalizadas válidas, incorporar una visualización temporal.

Mostrar:

- Distribución de transacciones por fecha.
- Cantidad de operaciones por período.
- Estados por período, cuando resulte útil.

Permitir cambiar el nivel de agrupación si el motor y los datos lo admiten.

No interpretar fechas inválidas como válidas.

No utilizar la fecha de carga como sustituto de una fecha transaccional inexistente.

Cuando no existan suficientes fechas válidas, mostrar un estado vacío informativo.

## 16. Interactividad entre secciones

El Dashboard debe comportarse como una herramienta de exploración de datos, no como una colección de gráficos independientes.

Ejemplos esperados:

- Seleccionar "Inválidas" muestra las transacciones inválidas.
- Seleccionar `EUR` muestra las transacciones en EUR.
- Seleccionar `PENDING` muestra las transacciones pendientes.
- Seleccionar un archivo limita el análisis a ese archivo.
- Seleccionar un diagnóstico permite revisar el registro afectado.
- Seleccionar una operación abre su inspector.
- Seleccionar un posible duplicado permite revisar los registros relacionados.

Los filtros deben mantenerse sincronizados y poder restablecerse.

Mostrar los filtros activos mediante etiquetas removibles.

No crear comportamientos inconsistentes entre tarjetas, gráficos y tablas.

## 17. Rendimiento y arquitectura

El Dashboard debe funcionar correctamente con los límites de carga establecidos para MVP1.

Consideraciones:

- Evitar recalcular todos los indicadores en cada render de React.
- Evitar recorrer grandes cantidades de registros repetidamente en JavaScript.
- Reutilizar el motor Python para consultas y agregaciones.
- Utilizar paginación para tablas extensas.
- Evitar transferir innecesariamente todo el conjunto normalizado entre Python y JavaScript.
- Mantener un estado consistente de filtros y selecciones.
- Implementar estados de carga apropiados.
- Evitar bloquear la interfaz durante el análisis.
- Conservar precisión monetaria.
- Mantener compatibilidad con Pyodide.

Si se requieren funciones nuevas de consulta en Python, implementarlas de forma modular y acompañarlas de pruebas.

No duplicar responsabilidades entre Python y React.

## 18. Experiencia de usuario

Agregar estados y comportamientos claros para:

- Ningún archivo cargado.
- Archivos válidos sin transacciones.
- Transacciones detectadas sin importes válidos.
- Ausencia de diagnósticos.
- Ausencia de posibles duplicados.
- Filtros sin coincidencias.
- Transacciones sin identificador.
- Fechas no disponibles.
- Monedas desconocidas.
- Archivos rechazados.

Los mensajes deben explicar lo ocurrido sin mostrar errores técnicos innecesarios.

El diseño debe funcionar tanto en pantallas grandes como en resoluciones menores.

No sacrificar legibilidad para mostrar más información.

## 19. Pruebas obligatorias

Agregar o actualizar pruebas para verificar:

1. Consistencia entre métricas globales y filtradas.
2. Separación correcta de monedas.
3. Montos positivos, negativos y cero.
4. Registros con importes o monedas inválidos.
5. Estados desconocidos.
6. Registros sin tipo.
7. Objetos no identificados.
8. Diagnósticos `FILE` y `RECORD`.
9. Múltiples diagnósticos asociados a un mismo registro.
10. Detección y visualización de posibles duplicados.
11. Filtros combinados.
12. Ordenamiento y paginación.
13. Navegación desde indicadores hacia registros.
14. Inspección de originales y normalizados.
15. Conservación de datos tras rechazar un archivo malformado.
16. Comportamiento cuando no existen datos.
17. Integración entre React y Pyodide.
18. Compilación de producción.

Verificar que las métricas no dupliquen transacciones, no mezclen monedas y no confundan objetos no identificados con transacciones inválidas.

## 20. Resultado esperado

Al finalizar, quiero un Dashboard donde pueda:

1. Comprender el estado general de las transacciones.
2. Identificar rápidamente problemas de calidad.
3. Analizar importes por moneda.
4. Explorar los registros procesados.
5. Investigar por qué una transacción fue declarada inválida.
6. Examinar sus valores originales y normalizados.
7. Consultar diagnósticos y trazabilidad.
8. Revisar posibles duplicados.
9. Aplicar filtros y ver métricas actualizadas.
10. Realizar todo lo anterior desde el mismo Dashboard sin navegar innecesariamente a otras pantallas.

La experiencia debe sentirse como una herramienta real de análisis transaccional, no como una página de estadísticas básicas.

## 21. Entrega y validación

Implementar las mejoras completas, no limitarse a generar una propuesta visual o componentes simulados.

Reutilizar las cinco vistas existentes y sus funcionalidades, evitando duplicación innecesaria y manteniendo la navegación actual.

Ejecutar las pruebas disponibles y la compilación de producción.

Al finalizar, entregar un resumen que indique:

- Archivos creados.
- Archivos modificados.
- Componentes nuevos.
- Funciones Python nuevas o modificadas.
- Funcionalidades interactivas implementadas.
- Pruebas ejecutadas y sus resultados.
- Limitaciones reales que permanezcan.

No modificar `AGENTS.md`.

No realizar commits, push ni despliegues.

**Prioridad final: funcionalidad real, trazabilidad, precisión monetaria, interactividad, legibilidad y consistencia con MVP1.**
