# Contexto del proyecto GymLog (para continuar en otro chat)

## Qué es
App de gimnasio personal: registro de series (peso × repes), historial, gráficas de progreso y récords.
Web instalable (PWA) para Android e iPhone. De momento uso personal, datos solo en el dispositivo.

## Decisiones tomadas con el usuario
- **Registro manual** (sin contar repes con cámara/sensores; quizá en el futuro).
- ~~Rutinas guardadas~~ → sustituidas en v3 por "Repetir un entrenamiento anterior". Calentamiento: casilla discreta. Sin temporizador.
- **Por serie**: peso y repes. Las series de **calentamiento también se registran** (marcadas), para estadísticas.
- **Ejercicios**: lista predefinida (27) + posibilidad de crear propios. Cada uno con músculos y flag "peso corporal".
- **Peso corporal**: se registra (uno por día). En ejercicios de peso propio se **suma al total levantado** (peso corporal vigente en esa fecha + lastre).
- **Sección de PRs** (récords personales) separada.
- **Futuro online** (Firebase o similar): amigos y **dos rankings**: absoluto (kg) y relativo al peso corporal. Métricas por ejercicio: peso total, peso máximo, y peso máximo en relación a repeticiones (1RM estimado / marcas a N repes).
- Despliegue previsto en **GitHub Pages** (workflow incluido).

## Decisiones tomadas por Claude (pendientes de validar)
- Calentamientos cuentan para volumen/total, **no** para récords.
- La primera serie de un ejercicio no cuenta como PR.
- Sin peso registrado ese día → se usa el último anterior (o el primero que exista).
- 1RM estimado con fórmula de Epley: peso × (1 + repes/30).

## Stack y estructura
HTML + CSS + JS (módulos ES nativos), **sin Node ni compilación**. Librerías copiadas en `lib/`: Dexie 4.4.7 (IndexedDB) y Chart.js 4.6.1. PWA con `manifest.webmanifest` + `sw.js` propio (red primero, caché si no hay conexión). Probar en local: `python serve.py` → http://localhost:8000.
- `js/data/db.js` – esquema Dexie v2: exercises, sets {exerciseId, reps, weight, warmup, date, ts}, routines {name, exerciseIds}, sessions {date, routineId, exerciseIds}, bodyweight {date, kg}
- `js/data/repo.js` – **única capa de acceso a datos**: carga todo en memoria (`getData()`), escrituras que recargan y avisan a `subscribe()`, export/import. Para migrar a Firebase se reescribe este archivo. Las series llevan `load` = peso + peso corporal si aplica.
- `js/data/stats.js` – cálculos puros: volumen, e1rm, computePRs (eventos de PR, peso máx., máx. repes, marcas 1/3/5/8/10RM), por músculo, por semana.
- `js/ui.js` – helper `h(tag, props, ...hijos)`, `rerender()`, gráficas, stepper, buscador de ejercicios, temporizador, toast.
- `js/views/` – train (incluye bloque de ejercicio), history, stats, records, more → routines, exercises, bodyweight. Cada vista es una función que devuelve su DOM; la app se repinta entera tras cada cambio.
- Colores de gráficas validados para modo oscuro: azul #6688f0, naranja #c06e3a.

## Pantallas (rediseño v3, 8-nov-2026: "sustituir al bloc de notas")
3 pestañas: **Hoy · Historial · Progreso** + ⚙️ Ajustes desde Hoy.
- **Hoy**: hoja del día, una línea por ejercicio con sus series en formato kg×repes (`60×10 · 70×8`). Botón "+ Ejercicio" (buscador con recientes primero). Si el día está vacío: "Repetir un entrenamiento anterior" (copia la lista de ejercicios de un día pasado). Selector de fecha para apuntar otro día.
- **Ficha de ejercicio**: "Última vez" + PR como referencia, series de hoy (tocar una = corregir/borrar), dos casillas grandes kg y repes precargadas, casilla discreta "calentamiento", botón "Guardar serie N". Aviso 🏆 al batir PR.
- **Historial**: mapa de calor 16 semanas + lista de días (tocar abre el día en Hoy).
- **Progreso**: conmutador Récords / Gráficas (los récords con absoluto/relativo; gráficas con filtro 30d/3m/1año/todo).
- **Ajustes**: peso corporal, ejercicios, exportar/importar JSON.
- Eliminado en v3: rutinas (la tabla sigue en la BD, sin uso), temporizador de descanso, steppers −/+.

## Preferencias del usuario
- Respuestas breves y directas, en español.
- **Hablar y cerrar el diseño antes de programar**; no empezar a codificar sin su OK.

## Próximos pasos posibles
- Subir a GitHub y activar Pages (Settings → Pages → Source: GitHub Actions).
- Probar en el móvil y ajustar.
- Fase online: Firebase (auth, sincronización, amigos, rankings).

## Fase online (v4, 8-nov-2026) — Firebase proyecto "Gymify" (gymify-2d89f, cuenta jmqmaestre)
- Auth: Google + email/contraseña. Login **opcional**: sin sesión = Dexie local; con sesión = Firestore (caché offline). Primer login: ofrece subir los datos locales y luego limpia el dispositivo.
- SDK Firebase 12.19.0 desde gstatic (sin Node), cargado con import() dinámico en `repo.initAccount()`; adaptador en `js/data/cloud.js`; config pública en `js/config.js`.
- Firestore: `users/{uid}` (perfil privado: alias, sex, birthDate, height) y `users/{uid}/{exercises,sets,bodyweight,sessions}`; `profiles/{uid}` público (alias, aliasLower, photo, sex); `aliases/{lower}` (únicos); `friendships/{uidA_uidB}` (users ordenados, from, to, status pending/accepted); `marks/{uid}_{key}` (e1rm, maxLoad, total y sus *Rel, alias, photo) para rankings.
- Reglas en `firestore.rules` (ya publicadas en la consola). Rankings sin índices compuestos: global = todas las marcas de un ejercicio ordenadas en cliente (vale para pocos usuarios).
- Perfil: avatar arriba a la derecha en Hoy → Perfil (login, datos, peso corporal, amigos, ejercicios, copia, cerrar sesión). Amigos: buscar por alias + solicitud. Ranking: Progreso → 👥 Ranking (amigos/global, 1RM/peso máx./total, absoluto/relativo). Solo ejercicios predefinidos (campo `key` = slug del nombre).
- Pendiente: al publicar en GitHub Pages, añadir `<usuario>.github.io` en Authentication → Configuración → Dominios autorizados. Foto de perfil = la de Google (Storage requiere plan de pago). Las marcas no se validan en servidor.
