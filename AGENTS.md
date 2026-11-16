1. Identidad y objetivo
- Proyecto: TransactCheck.
- Repositorio: transactcheck.
- Objetivo MVP1: aplicación web para cargar transacciones heterogéneas desde JSON, identificar posibles registros transaccionales, normalizarlos al modelo común, validarlos, explorar los resultados y visualizar métricas y diagnósticos.
- Objetivo MVP2 (fuera de alcance): admitir XML como formato adicional reutilizando el motor de normalización.
- Idioma de interfaz y documentación: español. Código y nombres técnicos: inglés. Las claves del JSON normalizado son camelCase.
- El trabajo está sujeto a una rúbrica académica: la IA es apoyo técnico. El usuario ya tomó las decisiones funcionales recogidas aquí; Codex no debe modificarlas ni inventar reglas de negocio.
2. Stack y arquitectura
- Frontend: React 19, TypeScript, Vite, PrimeReact y PrimeIcons.
- Motor de procesamiento: Python ejecutado en el navegador mediante Pyodide, preferiblemente en un Web Worker para evitar bloquear la interfaz.
- Similitud de nombres: alias y comparación aproximada; evaluar RapidFuzz solo si es compatible con la versión fijada de Pyodide. Si no, usar una alternativa Python pura (por ejemplo, difflib). Una similitud alta no demuestra equivalencia semántica.
- Pruebas iniciales: pytest para la lógica Python; pruebas visuales y ampliación de pruebas en etapas posteriores.
- CI/CD: GitHub Actions, con pruebas básicas y compilación obligatorias antes de desplegar automáticamente desde main a GitHub Pages.
- Hosting: GitHub Pages. GitHub Actions compila y publica; no actúa como servidor Python permanente. Pyodide ejecuta Python localmente en el navegador.
- Almacenamiento: sin base de datos, sin persistencia permanente de archivos o resultados. Mantenerlos durante la sesión de la página.
- No usar FastAPI, servidores externos, servicios de pago ni IA remota para el MVP1. No añadir dependencia de red para procesar transacciones; Pyodide y sus paquetes pueden requerir descarga inicial de recursos estáticos.
- Comprobar la compatibilidad real entre paquetes, versiones y Pyodide antes de adoptarlos; evitar bibliotecas innecesarias.
3. Alcance y límites de carga
- MVP1 admite únicamente archivos .json. XML queda exclusivamente documentado para MVP2; no desarrollar lector XML ahora.
- Permitir hasta 3 archivos cargados progresivamente durante la misma sesión.
- Máximo por archivo: 5 MiB = 5,242,880 bytes.
- Máximo acumulado: 15 MiB = 15,728,640 bytes.
- Validar cantidad, tamaño y extensión antes de procesar; rechazar el archivo que incumpla los límites sin perder resultados anteriores.
- Validación JSON completa y obligatoria: antes de detectar, normalizar o contabilizar transacciones, leer y parsear el contenido completo del archivo y confirmar que es JSON sintácticamente válido. No procesar parcialmente un archivo malformado ni intentar recuperar fragmentos.
- Si falla la validación sintáctica, descartar ese archivo de la carga activa, informar al usuario en español qué archivo fue rechazado y la causa comprensible (incluyendo ubicación del error solo cuando el parser la proporcione de forma confiable). Registrar un diagnóstico de alcance FILE; no incorporar sus objetos, transacciones ni montos a las métricas. Los archivos válidos cargados antes deben permanecer intactos. Un archivo rechazado no consume uno de los tres cupos de archivos cargados ni suma al límite acumulado.
- Solo después de superar esta validación completa, iniciar detección, normalización, validación de transacciones y cálculo de métricas.
- Procesar un archivo a la vez y consolidar resultados; si falla un archivo, no perder el resto.
- Permitir retirar un archivo individualmente y recalcular métricas, diagnósticos y coincidencias entre archivos. Mantener siempre la procedencia de cada registro.
- No asumir que cada línea física equivale a una transacción. Analizar objetos JSON completos, aunque ocupen varias líneas o un archivo esté minificado. La validación sintáctica se realiza sobre todo el documento antes del análisis de cualquier transacción; un error de parseo rechaza el archivo completo sin bloquear la aplicación.
- Admitir objetos anidados y arrays sin exigir una ruta o contenedor único; distinguir posibles transacciones de metadatos y otros objetos, evitando contar objetos contenedores y sus elementos dos veces. Si el reconocimiento es inseguro, separar como no identificado y registrar alertas. Conservar la ruta del elemento en el JSON, por ejemplo $.transactions[4].
- No usar confirmación humana ni un asistente de mapeo interactivo en el proceso: la detección y normalización serán automáticas y conservadoras.
4. Modelo normalizado aprobado
El resultado de una transacción tendrá exactamente estos nueve campos de negocio, con nombres JSON en inglés y camelCase:
Campo	Tipo lógico	Descripción
transactionId	string o null	Identificador de origen, si se reconoce
source	string	Fuente reconocida o UNKNOWN
amount	decimal representado como string, o null	Importe sin pérdida de precisión
currency	string	Código ISO 4217 en mayúsculas o UNKNOWN
status	string	Estado común o UNKNOWN
transactionDate	string ISO 8601 o null	Fecha, o fecha/hora cuando está disponible
transactionType	string o null	Tipo reconocido, sin inferirlo del signo del monto
referenceId	string o null	Referencia identificada
description	string o null	Descripción disponible


- Solo amount y currency normalizados y válidos son obligatorios para que una transacción reconocida sea VALID. No se exige transactionId, source, status, transactionDate, transactionType, referenceId ni description.
- La ausencia de atributos opcionales no invalida la transacción; se puede mostrar una advertencia útil.
- Mantener los datos originales, la ruta de origen, el archivo y los diagnósticos en un contenedor de resultados separado, sin alterar los nueve campos de negocio.
- No inventar IDs, fechas, fuentes, estados, monedas ni valores.
5. Detección de transacciones, campos y fuentes
5.1. Identificación de objetos
- Inspeccionar el documento sintácticamente, recorriendo objetos y colecciones sin depender de la indentación ni los saltos de línea.
- Identificar posibles transacciones usando evidencias de contenido. La presencia de campos equivalentes a monto y moneda es evidencia mínima suficiente de registro transaccional para este MVP si el contexto no indica claramente lo contrario.
- No clasificar automáticamente como transacción un resumen, un subtotal, una línea de producto u otro objeto no transaccional cuando el contexto lo haga evidente.
- Distinguir UNIDENTIFIED (no hay evidencia suficiente de que sea una transacción) de INVALID (es reconocible como transacción, pero falla la validación). Para registros evidentemente transaccionales con monto o moneda faltantes, registrar INVALID, no ocultarlos como UNIDENTIFIED.
- No contabilizar varias veces el mismo objeto por recorrer estructuras anidadas. La regla exacta de identificación debe ser explícita, comprobable y conservadora.
5.2. Reconocimiento de campos
Aplicar, según corresponda, las siguientes evidencias:
1. Nombre exacto / alias configurado (incluyendo español e inglés: monto/`amount`, moneda/`currency`, importe/`divisa`, etc.).
2. Similitud léxica del nombre, sin aceptar correspondencias solo por una puntuación semejante.
3. Tipo de dato y formato real del valor.
4. Contexto del objeto y campos vecinos.
5. Configuraciones verificadas de la fuente cuando existan.
   - Si dos posibles asignaciones son ambiguas, no asignar arbitrariamente; usar null o UNKNOWN, conservar el valor original y emitir diagnóstico.
   - No mapear un nombre mediante similitud si implica confundir conceptos distintos (por ejemplo, unitPrice con el total de una transacción).
   - Los alias, patrones y reglas deben estar en archivos de configuración versionados y ser inspeccionables en la vista Reglas; no inventar equivalencias de estado, monedas o tipo de transacción.
5.3. Detección de fuente
Priorizar: (1) campo explícito, (2) metadatos del registro o contenedor, (3) patrones específicos conocidos, (4) UNKNOWN si no existe evidencia suficiente.

El nombre de un archivo por sí solo no confirma la fuente. Una fuente desconocida no invalida por sí sola la transacción.
6. Reglas de normalización
6.1. Montos (amount)
- Utilizar decimal.Decimal, nunca float para cálculos monetarios.
- Aceptar montos positivos, negativos y cero. El signo no determina transactionType ni status.
- Aceptar enteros y decimales numéricos, así como cadenas numéricas en formatos reconocibles. No exigir centavos ni dos decimales.
- Interpretar separadores decimales y de millares mediante reglas y evidencia contextual de la fuente o del archivo.
- Casos como "1,500" pueden representar 1500 o 1.500: elegir solo si existe evidencia suficiente; de lo contrario, amount: null y diagnóstico AMBIGUOUS_AMOUNT con severidad ERROR.
- No deducir formato numérico exclusivamente por la moneda. No redondear ni alterar precisión sin una regla aprobada.
- Montos ausentes o imposibles de interpretar: amount: null, diagnóstico de error; transacción inválida.
- Representar el decimal normalizado como string JSON, no como número en punto flotante.
6.2. Monedas (currency)
- Emplear un catálogo ISO 4217 reconocido por el sistema, con alias versionados y códigos en mayúsculas.
- Reconocer alias inequívocos como usd y US$ cuando estén definidos.
- Símbolos ambiguos como $ requieren evidencia contextual confiable; no asumir USD.
- Si no se puede determinar una moneda admitida, usar UNKNOWN y diagnóstico ERROR (MISSING_CURRENCY/`UNKNOWN_CURRENCY`), por lo que la transacción será inválida.
- No convertir divisas ni sumar monedas diferentes.
- Verificar que el catálogo ISO elegido esté disponible/embebido y sea compatible con Pyodide; no introducir una dependencia incompatible para satisfacerlo.
6.3. Estados (status)
Catálogo normalizado cerrado para MVP1:

APPROVED, REJECTED, PENDING, FAILED, CANCELLED, REFUNDED, UNKNOWN.
- Guardar equivalencias conocidas en un archivo de configuración. SUCCESS, PAID, COMPLETED, PROCESSING y otros términos no son universalmente intercambiables: mapear únicamente cuando su significado esté definido con suficiente certeza.
- No decidir el estado exclusivamente por similitud léxica o por signo del monto.
- Si el estado es desconocido, asignar UNKNOWN y advertir; no invalidar por ello.
6.4. Fechas (transactionDate)
- Normalizar a ISO 8601, sin inventar hora ni zona horaria cuando no aparezcan en el origen.
- Reconocer formatos inequívocos y patrones regionales configurados; timestamps Unix solo cuando se identifiquen de manera confiable.
- Para fechas con patrón XX/YY/YYYY, evaluar tanto DD/MM/YYYY como MM/DD/YYYY:
  - Si solo una interpretación produce fecha de calendario válida, usarla (30/04/2026 → 2026-04-30; 04/30/2026 → 2026-04-30).
  - Si ambas producen la misma fecha, usarla (04/04/2026 → 2026-04-04).
  - Si ambas son válidas pero distintas, utilizar solo configuración/contexto confiable; si no, null y AMBIGUOUS_DATE.
  - Si ninguna es válida, null y INVALID_DATE.
- Validar días reales del mes, años bisiestos y fechas imposibles.
- Una fecha inválida o ambigua no invalida por sí sola una transacción; generar WARNING.
6.5. Demás campos
- Para transactionId, transactionType, referenceId y description, utilizar únicamente valores reconocidos sin inferencias no sustentadas.
- Campos originales desconocidos: conservarlos en el objeto de origen y, cuando aporte valor, registrar UNRECOGNIZED_FIELD (INFO).
7. Validación y resultados
Clasificar sin descartar información:
- VALID: registro identificado como transacción, con amount y currency interpretados correctamente.
- INVALID: registro identificado como transacción, pero monto o moneda ausentes, ambiguos o inválidos.
- UNIDENTIFIED: objeto de entrada que no puede reconocerse con suficiente seguridad como transacción.
- Mantener cada registro original, resultado normalizado parcial, diagnósticos y su procedencia.
- Un registro cuenta una sola vez en su categoría, incluso con múltiples errores.
- Los objetos no identificados deben tener conteo independiente, no mezclarse en VALID/`INVALID`.
- Invariantes: processedTransactions = validTransactions + invalidTransactions, donde processedTransactions solo abarca transacciones identificadas; unidentifiedObjects se reporta aparte.
- Los totales monetarios de transacciones válidas excluyen INVALID y UNIDENTIFIED. Los archivos rechazados durante la validación inicial quedan fuera de todas las métricas transaccionales; sus fallos se muestran únicamente como diagnósticos FILE.
8. Diagnósticos y trazabilidad
Cada diagnóstico debe ofrecer, cuando corresponda:
Campo	Contenido
scope	FILE o RECORD
code	Identificador técnico en inglés
severity	ERROR, WARNING, INFO
message	Mensaje comprensible en español
field	Campo normalizado afectado o null
originalValue	Valor original, cuando corresponda
sourceFile	Archivo de origen
jsonPath	Ruta del elemento/campo en el documento
details	Explicación técnica en español


- FILE identifica problemas de carga, extensión, límite de tamaño/cantidad, sintaxis JSON o fallo de procesamiento de un archivo; no implica una transacción INVALID. RECORD identifica problemas asociados a un objeto o transacción ya obtenido de un archivo válido.
- Para FILE, usar sourceFile y jsonPath: null si no existe una ruta JSON fiable. Para RECORD, conservar la ruta del objeto/campo cuando corresponda. Un error sintáctico puede informar línea y columna si el parser las proporciona; no fabricar rutas JSON.
- Los problemas de amount y currency son ERROR cuando impiden cumplir su validación mínima.
- Problemas de campos opcionales, fechas, estados, fuentes y posibles duplicados generalmente son WARNING; campos adicionales desconocidos pueden ser INFO.
- Definir códigos estables (por ejemplo, MISSING_AMOUNT, INVALID_AMOUNT, AMBIGUOUS_AMOUNT, MISSING_CURRENCY, UNKNOWN_CURRENCY, UNKNOWN_STATUS, UNKNOWN_SOURCE, AMBIGUOUS_DATE, INVALID_DATE, POSSIBLE_DUPLICATE, UNRECOGNIZED_FIELD, UNIDENTIFIED_OBJECT; y para archivos INVALID_JSON, FILE_TOO_LARGE, FILE_LIMIT_EXCEEDED, INVALID_FILE_TYPE, FILE_PROCESSING_ERROR).
- No inventar el número de línea de un JSON: usar jsonPath confiable y archivo de procedencia.
- Mostrar comparación del JSON original con su representación normalizada y explicar las transformaciones aplicadas.
9. Posibles duplicados
- Detectar y advertir, sin borrar ni invalidar automáticamente, coincidencias dentro de un mismo archivo o entre archivos.
- Considerar identificador + fuente, coincidencia de datos relevantes y objetos originales idénticos, sin asumir que la misma ID en fuentes diferentes representa necesariamente la misma operación.
- La mera coincidencia de monto y moneda no es suficiente para declarar duplicado.
- Conservar todos los registros y contabilizarlos individualmente en métricas. Al eliminar archivos, recalcular las coincidencias y sus advertencias.
10. Métricas
Mostrar en el dashboard:
- Total de transacciones procesadas, válidas e inválidas; objetos no identificados por separado.
- Porcentajes de validez y distribución de diagnósticos.
- Conteo por estado (APPROVED, REJECTED, PENDING, FAILED, CANCELLED, REFUNDED, UNKNOWN).
- Conteo por fuente y tipo de transacción.
- Totales y cantidad de transacciones por moneda.
- Montos positivos, negativos y netos por cada moneda, calculados con Decimal y únicamente sobre transacciones válidas.
- Conteo por tipo de error/advertencia y de campos no reconocidos.
- Indicadores generales consolidados y métricas de la selección filtrada, claramente diferenciados en la interfaz.
No mostrar un total monetario global mezclando divisas, ni contar varias veces una transacción por tener varios diagnósticos. Mantener separados los contadores de diagnósticos FILE y RECORD, sin incluir archivos rechazados en porcentajes de validez.
11. Interfaz y navegación
- Aplicación en español, responsive, con dashboard moderno, menú lateral, PrimeReact y PrimeIcons, tarjetas, gráficos, tablas y modo claro/oscuro.
- Cinco vistas:
  1. Carga de archivos: agregar progresivamente, validar límites, procesar, mostrar estado por archivo y eliminar individualmente.
  2. Dashboard: métricas, distribuciones y gráficos consolidados.
  3. Transacciones: explorar válidas/ inválidas, búsqueda, filtros combinables (fuente, estado, moneda, tipo, fechas y rangos de monto), ordenamiento, paginación y detalle.
  4. Inconsistencias: errores, advertencias, objetos no identificados, posibles duplicados y trazabilidad.
  5. Reglas: consulta de solo lectura de criterios, catálogos y equivalencias aplicadas.
- En el detalle, mostrar los nueve campos, objeto original, ruta JSON, valores desconocidos y las transformaciones realizadas.
- Cuidar rendimiento: tabla paginada/virtualizada y procesamiento Python en un Web Worker con Pyodide, salvo incompatibilidad técnica documentada.
- Mantener una única representación principal de los registros procesados en el motor/Worker durante la sesión, cuando sea técnicamente viable. Evitar duplicar colecciones completas, objetos originales y diagnósticos en el estado de React; enviar a la interfaz solo resúmenes, páginas filtradas y detalles solicitados.
- Ejecutar filtrado, ordenamiento, paginación y cálculos monetarios en Python cuando dependan de los datos completos, de modo que React no necesite copiar toda la colección. Liberar datos y referencias asociados cuando se retire un archivo o se cierre la sesión.
- Mantener amount y todos los totales monetarios como strings decimales al cruzar el puente Python–JavaScript. No convertirlos a Number para sumar, ordenar o filtrar montos con precisión exacta; usar decimal.Decimal en Python. Solo se permiten conversiones aproximadas para visualizaciones cuando no alteren cifras presentadas ni cálculos de negocio, dejando el valor exacto disponible.
- Mostrar errores de validación de archivos diferenciados de inconsistencias de transacciones; los archivos rechazados no aparecen en tablas transaccionales ni afectan el dashboard.
- No ofrecer ninguna exportación ni descarga de resultados en JSON, CSV, Excel o PDF. Solo visualización.
- No almacenar datos de las transacciones de manera persistente ni enviarlos a un backend externo.
12. Organización sugerida
Codex puede ajustar nombres de carpetas cuando exista una justificación técnica, conservando responsabilidades claras:
transactcheck/
├── AGENTS.md
├── README.md
├── .gitignore
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── workers/
│   │   └── ...
│   └── ...
├── python/
│   ├── normalization/
│   ├── validation/
│   ├── metrics/
│   ├── detection/
│   └── ...
├── config/
│   ├── field_aliases.json
│   ├── status_mappings.json
│   ├── currency_aliases.json
│   └── date_formats.json
├── data/
│   └── samples/
├── tests/
│   └── ...
├── requirements-dev.txt
└── .github/
    └── workflows/
        └── ...
- Separar de forma verificable detección, normalización, validación, métricas y presentación.
- Mantener lógica transaccional en Python; React solo debe gestionar presentación, interacción y puente con Pyodide.
- Evitar copiar datos voluminosos innecesariamente entre Web Worker, JavaScript y Python; preferir consultas paginadas y respuestas compactas. Definir un puente que preserve montos como strings decimales y mantenga los cálculos exactos en Python.
- Separar la configuración de reglas del código y hacerla legible para la pantalla Reglas.
13. Pruebas y criterios de aceptación del MVP1
Etapa inicial: pruebas básicas automatizadas con pytest y validación de build. El usuario revisará visualmente el sistema antes de solicitar pruebas extendidas; no exigir todavía suite Playwright, Vitest exhaustiva ni porcentaje de cobertura mínimo.

Como mínimo, crear fixtures JSON heterogéneos y pruebas para:
1. JSON válido, malformado y con estructuras anidadas/multilínea; comprobar que el parseo completo sucede antes de procesar registros, que un JSON malformado se rechaza íntegro y que no modifica resultados de otros archivos.
2. Detección de transacciones, exclusión de contenedores y objetos no identificados.
3. Alias en español/inglés, campos desconocidos y mapeos ambiguos.
4. Montos positivos, negativos, cero, inválidos y ambiguos (incluido "1,500").
5. Monedas reconocidas, alias y desconocidas.
6. Estados admitidos, desconocidos y correspondencias configuradas.
7. Fechas inequívocas, ambiguas, imposibles y bisiestos.
8. Validez basada solo en monto y moneda.
9. Errores múltiples sin doble conteo y conservación de JSON original/ruta.
10. Métricas por moneda y suma neta con Decimal; verificar transporte de importes como strings y operaciones exactas de filtrado/ordenamiento, incluso con decimales de alta precisión.
11. Posibles duplicados sin excluir registros.
12. Validaciones de máximo 3 archivos y 5 MiB por archivo (incluyendo casos límite); comprobar que archivos rechazados no consumen cupos ni alteran el tamaño acumulado. Verificar también carga/eliminación en pruebas manuales iniciales.
13. Diagnósticos FILE frente a RECORD, incluyendo códigos y ausencia de conteo transaccional para errores del archivo.
14. Paginación/consultas compactas desde el Worker y liberación de datos al retirar archivos, con comprobación manual de rendimiento y memoria en navegador.
Asegurar que el código de procesamiento pueda probarse en CPython cuando sea viable y comprobar en navegador la ejecución con Pyodide antes de dar por finalizado el MVP. Las pruebas que no se hayan ejecutado deben declararse como no ejecutadas, nunca como aprobadas.
14. GitHub Actions y publicación
- Workflow de CI con instalación de Python y Node, ejecución de pytest, verificación TypeScript y build de Vite.
- Desplegar automáticamente a GitHub Pages solo tras aprobar CI en un push a main; no publicar una compilación fallida.
- Configurar la ruta base del proyecto en Vite: /transactcheck/ (o configuración equivalente verificable).
- Incluir en el build los módulos Python y configuraciones necesarios para Pyodide, mediante rutas correctas en GitHub Pages.
- Documentar habilitación de GitHub Pages (fuente GitHub Actions), permisos mínimos y pasos para verificar el sitio.
- No asumir que GitHub Actions puede mantener un servidor FastAPI activo. No utilizar un backend remoto.
15. Documentación y uso consciente de IA
- README.md: objetivo, requisitos, arquitectura, instalación, desarrollo local, pruebas, despliegue y explicación de reglas, con datos de prueba.
- Preparar una nota técnica breve de máximo una página con decisiones de diseño, uso de IA como apoyo y ajustes reales realizados sobre sugerencias de IA. No inventar experiencias o correcciones que no hayan ocurrido; si falta evidencia, dejarla para revisión del usuario antes de la entrega académica.
- En la documentación de usuario utilizar español natural, preciso y conciso; evitar afirmaciones de resultados no verificados.
- No presentar MVP2/XML como implementado.
16. Restricciones de trabajo para Codex
- Implementar MVP1 de forma autónoma respetando estas decisiones. No cambiar unilateralmente el modelo, validez, reglas de negocio ni alcance.
- Puede crear/modificar archivos, instalar dependencias necesarias, ejecutar pruebas y corregir errores.
- No agregar funcionalidades no solicitadas, bases de datos, exportaciones, APIs de IA, servicios externos o servicios de pago.
- No ejecutar git commit, git push ni publicar directamente. La configuración de GitHub Actions puede producir despliegues automáticos posteriormente cuando el usuario haga push a main.
- No eliminar archivos existentes sin una justificación clara.
- Si una regla aún no está suficientemente definida (por ejemplo, un umbral de similitud, una equivalencia semántica o una prioridad entre candidatos), no inventar decisiones financieras: conservar la interpretación conservadora, registrar las limitaciones y señalar al usuario qué requiere definición. Los parámetros técnicos de rendimiento pueden proponerse y justificarse sin cambiar el significado de los datos.
- Priorizar funcionamiento estable y verificable por encima de complejidad visual o bibliotecas adicionales.
- Mantener nombres técnicos en inglés, clases en PascalCase, Python en snake_case, claves JSON y TypeScript en camelCase; interfaz y documentación en español.
- Tras implementar, informar qué archivos cambió, comandos ejecutados, pruebas aprobadas/fallidas/no ejecutadas y limitaciones. No declarar completado lo que no fue verificado.
17. Verificación final antes de entrega
- Carga 1–3 JSON, cada uno de máximo 5 MiB; valida sintaxis de cada archivo por completo antes del análisis y rechaza íntegramente el malformado sin afectar archivos anteriores.
- Detecta registros sin depender de líneas ni estructura fija; separa los no identificados.
- Modelo JSON de nueve campos, claves en inglés camelCase.
- Valida solo amount y currency; estados y fechas opcionales.
- Normaliza montos, monedas, estados y fechas con reglas explícitas y conservadoras.
- Conserva originales, rutas JSON y diagnósticos detallados; distingue FILE de RECORD y excluye archivos rechazados de los conteos transaccionales.
- Consolida archivos y recalcula al quitar uno; detecta posibles duplicados sin borrar.
- Dashboard y cinco vistas funcionales, filtros y trazabilidad; preserva precisión monetaria mediante Decimal y strings al comunicarse con React; evita duplicaciones masivas de datos mediante el Worker y consultas paginadas.
- Sin exportación, base de datos, servidor externo ni XML en MVP1.
- Pruebas básicas ejecutadas; build y GitHub Actions configurados.
- Despliegue a GitHub Pages desde main después de CI exitoso.
- README y nota técnica académica preparados para revisión humana.