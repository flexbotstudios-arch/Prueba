export const sectionTitles = {
  forum: 'Foro',
  profile: 'Perfil',
  moderation: 'Moderación',
  admin: 'Administración',
  creator: 'Panel de creación',
  support: 'Soporte',
  forbidden: 'Acceso restringido',
  'not-found': 'Página no encontrada',
};

export const canAccessSection = (view, user) => {
  if (!user) return false;
  if (view === 'admin') return user.role === 'admin' || user.role === 'creator';
  if (view === 'moderation') return user.role === 'moderator' || user.role === 'admin' || user.role === 'creator';
  if (view === 'creator') return user.role === 'creator';
  return true;
};
