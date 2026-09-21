const panelRoutes = {
  admin: '/paneles/administrador',
  moderation: '/paneles/moderacion',
  creator: '/paneles/creador',
};

export const routeFromPath = (pathname, search = '') => {
  const parts = pathname.split('/').filter(Boolean);
  const params = new URLSearchParams(search);
  if (parts[0] === 'errores' && parts[1] === '403') return { view: 'forbidden', errorCode: 403 };
  if (parts[0] === 'errores' && parts[1] === '404') return { view: 'not-found', errorCode: 404 };
  if (parts[0] === 'tablas' && parts[1]) return { view: 'forum', boardId: decodeURIComponent(parts[1]), threadId: params.get('thread') ? Number(params.get('thread')) : null };
  if (parts[0] === 'paneles' && parts[1] === 'administrador') return { view: 'admin' };
  if (parts[0] === 'paneles' && parts[1] === 'moderacion') return { view: 'moderation' };
  if (parts[0] === 'paneles' && parts[1] === 'creador') return { view: 'creator' };
  if (parts[0] === 'soporte') return { view: 'support' };
  if (parts[0] === 'perfil') return { view: 'profile', profileId: parts[1] || null };
  if (parts.length) return { view: 'not-found', errorCode: 404 };
  return { view: 'forum', boardId: 'general' };
};

export const pathForRoute = ({ view, boardId = 'general', profileId = null, threadId = null }) => {
  if (view === 'forum') return `/tablas/${encodeURIComponent(boardId || 'general')}${threadId ? `?thread=${threadId}` : ''}`;
  if (panelRoutes[view]) return panelRoutes[view];
  if (view === 'support') return '/soporte';
  if (view === 'profile') return profileId ? `/perfil/${profileId}` : '/perfil';
  if (view === 'forbidden') return '/errores/404';
  if (view === 'not-found') return '/errores/404';
  return '/tablas/general';
};

export const navigateTo = (route) => {
  const path = pathForRoute(route);
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
