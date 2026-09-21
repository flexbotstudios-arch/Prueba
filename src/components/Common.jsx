import { useState } from 'react';
import { Camera, Gavel, Headphones, ImagePlus, Paperclip, ShieldCheck, UserRound } from 'lucide-react';

export const roleLabels = { creator: 'Creador', admin: 'Administrador', moderator: 'Moderador', support: 'Soporte', member: 'Miembro' };
export const roleIcons = { creator: ShieldCheck, admin: ShieldCheck, moderator: Gavel, support: Headphones, member: UserRound };

export function Brand() {
  return <div className="brand-block sidebar-brand"><div className="logo">F</div><div><p className="eyebrow">Foro comunitario</p><h2>Foro Demo</h2></div></div>;
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

export function ImagePicker({ value, onChange, uploadImage, label = 'Adjuntar imagen' }) {
  const [uploading, setUploading] = useState(false);
  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } finally {
      setUploading(false);
    }
  };
  return <div className="image-picker"><label className="image-picker-button"><ImagePlus size={16} />{uploading ? 'Subiendo...' : value ? 'Cambiar imagen' : label}<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleChange} disabled={uploading} /></label>{value && <div className="image-picker-preview"><img src={value} alt="Vista previa" /><button type="button" className="mini-action danger-text" onClick={() => onChange('')}>Quitar</button></div>}</div>;
}

export function AvatarPicker({ value, user, onChange, uploadImage }) {
  const [uploading, setUploading] = useState(false);
  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } finally {
      setUploading(false);
    }
  };
  return <label className={`avatar-picker ${uploading ? 'uploading' : ''}`} title="Cambiar avatar"><Avatar user={{ ...user, avatar: value || user?.avatar }} /><span><Camera size={15} /></span><input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleChange} disabled={uploading} /></label>;
}

export function AttachmentPicker({ value, onChange, uploadFile }) {
  const [uploading, setUploading] = useState(false);
  const handleChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadFile(file, 'attachment'));
    } finally {
      setUploading(false);
    }
  };
  return <div className={`attachment-picker ${value ? 'has-attachment' : ''}`}><label className="attachment-button" title="Adjuntar archivo"><Paperclip size={17} /><input type="file" onChange={handleChange} disabled={uploading} /></label>{uploading && <small>Subiendo...</small>}{value && <div className="attachment-preview"><div className="attachment-preview-media">{value.type?.startsWith('image/') ? <img src={value.url} alt="Vista previa del archivo" /> : <Paperclip size={18} />}</div><div className="attachment-preview-copy"><strong>{value.name}</strong><small>{formatFileSize(value.size)}</small></div><button type="button" onClick={() => onChange(null)} aria-label="Quitar archivo">×</button></div>}</div>;
}

function formatFileSize(size) {
  if (!size) return '';
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}
