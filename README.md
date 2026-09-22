# Foro Demo

Foro comunitario con React, Vite, Express y SQLite.

## Desarrollo

```bash
npm install
npm run dev
```

## Produccion

```bash
npm run build
npm start
```

El servidor Express sirve la API y el contenido de `dist`, por lo que las rutas de la SPA funcionan al recargar la pagina.

## Rutas web

- `/tablas/general`: tabla general del foro.
- `/tablas/:boardId`: cualquier tabla existente.
- `/paneles/administrador`: administracion de roles y tablas.
- `/paneles/moderacion`: moderacion de usuarios y contenido.
- `/paneles/creador`: gestion de cuentas y reinicio.
- `/soporte`: tickets y conversaciones de soporte.
- `/perfil` y `/perfil/:id`: perfiles de usuario.

## Estructura frontend

- `src/App.jsx`: estado global, API y composicion de la aplicacion.
- `src/routing.js`: parseo y generacion de rutas.
- `src/sections.js`: nombres y permisos de secciones.
- `src/components/Common.jsx`: componentes visuales compartidos.
- `src/views/AuthScreen.jsx`: autenticacion.
- `src/views/ForumView.jsx`: tablas, publicaciones, respuestas y presencia.
