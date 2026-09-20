const panelRoutes = {
  admin: '/paneles/administrador',
  moderation: '/paneles/moderacion',
  creator: '/paneles/creador',
};

export const routeFromPath = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'tablas' && parts[1]) return { view: 'forum', boardId: decodeURIComponent(parts[1]) };
  if (parts[0] === 'paneles' && parts[1] === 'administrador') return { view: 'admin' };
  if (parts[0] === 'paneles' && parts[1] === 'moderacion') return { view: 'moderation' };
  if (parts[0] === 'paneles' && parts[1] === 'creador') return { view: 'creator' };
  if (parts[0] === 'soporte') return { view: 'support' };
  if (parts[0] === 'perfil') return { view: 'profile', profileId: parts[1] ? Number(parts[1]) : null };
  return { view: 'forum', boardId: 'general' };
};

export const pathForRoute = ({ view, boardId = 'general', profileId = null }) => {
  if (view === 'forum') return `/tablas/${encodeURIComponent(boardId || 'general')}`;
  if (panelRoutes[view]) return panelRoutes[view];
  if (view === 'support') return '/soporte';
  if (view === 'profile') return profileId ? `/perfil/${profileId}` : '/perfil';
  return '/tablas/general';
};

export const navigateTo = (route) => {
  const path = pathForRoute(route);
  if (window.location.pathname !== path) window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
};
