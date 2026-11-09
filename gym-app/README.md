# GymLog

PWA (Android + iPhone) para registrar entrenamientos de gimnasio. HTML, CSS y JavaScript sin compilación: no necesita Node.

- **Entrenar**: empezar desde una rutina o con ejercicios sueltos; series de peso × repes, con marca de calentamiento; temporizador de descanso; aviso de PR.
- **Historial**: calendario de actividad y detalle por día.
- **Progreso**: totales, volumen semanal, reparto por músculo, evolución por ejercicio.
- **Récords**: últimos PRs, 1RM estimado, peso máx., máx. repes y marcas a 1/3/5/8/10 repes; en absoluto o relativo al peso corporal.
- **Más**: rutinas, peso corporal, ejercicios (predefinidos + propios), copia de seguridad.

En ejercicios de peso propio se suma el peso corporal vigente en esa fecha. Los calentamientos cuentan para el volumen pero no para los récords.

## Probar en local
```bash
python serve.py
```
y abre http://localhost:8000. (Abrir `index.html` con doble clic no funciona: los navegadores bloquean los módulos con `file://`.)

## Publicar
Al subir a la rama `main`, el workflow de `.github/workflows/deploy.yml` publica la carpeta en GitHub Pages (Settings → Pages → Source: GitHub Actions).

## Estructura
- `index.html`, `css/app.css`, `manifest.webmanifest`, `sw.js` (offline)
- `lib/` – Dexie 4.4.7 (IndexedDB) y Chart.js 4.6.1, copiados en el repo
- `js/data/db.js` – esquema de la base de datos
- `js/data/repo.js` – **única capa de acceso a datos** (cambiar aquí para Firebase)
- `js/data/stats.js` – cálculos: volumen, 1RM (Epley), PRs, por músculo, por semana
- `js/ui.js` – helper `h()` para crear elementos, gráficas, stepper, buscador, temporizador
- `js/views/` – una función por pantalla; se repintan tras cada cambio de datos
- Si añades archivos, inclúyelos en `FILES` de `sw.js` y sube la versión de `CACHE`.
