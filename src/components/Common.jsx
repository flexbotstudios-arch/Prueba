import { useState } from 'react';
import { Gavel, Headphones, ShieldCheck, UserRound } from 'lucide-react';

export const roleLabels = { creator: 'Creador', admin: 'Administrador', moderator: 'Moderador', support: 'Soporte', member: 'Miembro' };
export const roleIcons = { creator: ShieldCheck, admin: ShieldCheck, moderator: Gavel, support: Headphones, member: UserRound };

export function Brand() {
  return <div className="brand-block sidebar-brand"><div className="logo">F</div><div><p className="eyebrow">Foro comunitario</p><h2>ForumBonito</h2></div></div>;
}

export function Avatar({ user, small = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatar = user?.avatar?.trim();
  return <span className={`avatar ${small ? 'small' : ''}`}>{avatar && !imageFailed ? <img src={avatar} alt={`Avatar de ${user.name}`} onError={() => setImageFailed(true)} /> : avatar || (user?.name || 'U').slice(0, 2).toUpperCase()}</span>;
}

export function RoleBadge({ role }) {
  const Icon = roleIcons[role] || UserRound;
  return <span className={`role-badge role-${role}`}><Icon size={13} strokeWidth={2.4} />{roleLabels[role] || 'Miembro'}</span>;
}

export function UserLink({ user, onClick }) {
  if (!user) return <span className="user-link user-link-empty"><Avatar user={null} small /><span>Usuario</span><RoleBadge role="member" /></span>;
  return <button className="user-link" onClick={onClick}><Avatar user={user} small /><span><strong>{user.name || 'Usuario'}</strong>{user.username && <small>{user.username}</small>}</span><RoleBadge role={user.role || 'member'} /></button>;
}

export function RoleCard({ user, meta }) {
  return <div className="role-user-card"><Avatar user={user} small /><div className="role-user-copy"><strong>{user.name || user.username || 'Usuario'}</strong><small>{user.username || 'Username no disponible'} · {meta || user.email}</small></div><RoleBadge role={user.role} /></div>;
}
