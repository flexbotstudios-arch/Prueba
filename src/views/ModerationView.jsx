import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ChevronDown, ClipboardList, Flag, History, ShieldAlert, Trash2 } from 'lucide-react';
import { RoleCard } from '../components/Common';

export default function ModerationView({ users, reports, hiddenPosts, userMap, loggedUser, history, onLoadHistory, onDeleteWarning, onOpenSanction, onHide, onDelete, onResolveReport, onOpenReport, onWarn, onDeleteReport, onBanReport, formatDate }) {
  const managedUsers = users.filter((user) => user.id !== loggedUser.id);
  const [selectedReport, setSelectedReport] = useState(null);

  const openModerationAction = (report, type) => {
    const user = userMap[report.ownerId] || { id: report.ownerId, name: 'dueño de la publicación', username: 'desconocido' };
    onOpenSanction(user, type);
  };

  return (
    <section className="page-view moderation-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Control de comunidad</p>
          <h2>Panel de moderación</h2>
          <small>Revisa cuentas, reportes y medidas aplicadas desde un solo lugar.</small>
        </div>
        <span className="role-badge role-moderator">Moderador</span>
      </div>

      <div className="moderation-summary">
        <SummaryCard icon={<ShieldAlert size={18} />} label="Cuentas visibles" value={managedUsers.length} />
        <SummaryCard icon={<Flag size={18} />} label="Reportes abiertos" value={reports.length} />
        <SummaryCard icon={<History size={18} />} label="Contenido oculto" value={hiddenPosts.length} />
      </div>

      <section className="panel-card moderation-section">
        <div className="section-header">
          <div>
            <p className="mini-label">Directorio de cuentas</p>
            <h3>Usuarios y sanciones</h3>
          </div>
          <span className="section-count">{managedUsers.length} cuentas</span>
        </div>
        <div className="admin-list">
          {managedUsers.map((user) => (
            <ModerationUserRow
              key={user.id}
              user={user}
              history={history}
              onLoadHistory={onLoadHistory}
              onDeleteWarning={onDeleteWarning}
              onOpenSanction={onOpenSanction}
              formatDate={formatDate}
            />
          ))}
        </div>
      </section>

      <section className="panel-card moderation-section">
        <div className="section-header">
          <div>
            <p className="mini-label">Cola de revisión</p>
            <h3>Reportes abiertos</h3>
          </div>
          <span className="section-count">{reports.length}</span>
        </div>

        {reports.length ? (
          <div className="admin-list">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                userMap={userMap}
                onSelectReport={setSelectedReport}
                onWarn={onWarn}
                onOpenSanction={(type) => openModerationAction(report, type)}
                onDeleteReport={onDeleteReport}
              />
            ))}
          </div>
        ) : (
          <div className="presence-empty">No hay reportes abiertos.</div>
        )}
      </section>

      {selectedReport && (
        <ReportDetailsModal
          report={selectedReport}
          userMap={userMap}
          onClose={() => setSelectedReport(null)}
          onOpenReport={() => {
            onOpenReport(selectedReport);
            setSelectedReport(null);
          }}
          onWarn={() => {
            onWarn(selectedReport.ownerId);
            setSelectedReport(null);
          }}
          onOpenSanction={(type) => {
            openModerationAction(selectedReport, type);
            setSelectedReport(null);
          }}
          onDeleteReport={() => {
            onDeleteReport(selectedReport);
            setSelectedReport(null);
          }}
          formatDate={formatDate}
        />
      )}
    </section>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="moderation-summary-card">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ReportRow({ report, onSelectReport }) {
  return (
    <div className="moderation-item report-card" key={report.id}>
      <div className="report-card-copy">
        <span className="report-number">Reporte #{String(report.id).padStart(2, '0')}</span>
        <strong>{report.targetTitle || 'Contenido reportado'}</strong>
        <small>{report.reason} · por {report.reporterUsername} · {report.warningCount} advertencias</small>
      </div>

      <div className="report-card-actions">
        <button type="button" className="mini-action" onClick={() => onSelectReport(report)}>Información</button>
      </div>
    </div>
  );
}

function ReportDetailsModal({ report, userMap, onClose, onOpenReport, onWarn, onOpenSanction, onDeleteReport, formatDate }) {
  const owner = userMap[report.ownerId] || null;
  const reporter = report.reporterUsername || 'Desconocido';

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div className="app-dialog report-details-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-mark" aria-hidden="true">
          <AlertTriangle size={18} />
        </div>

        <p className="eyebrow">Detalle del reporte</p>
        <h2>{report.targetTitle || 'Contenido reportado'}</h2>

        <div className="report-details-grid">
          <div>
            <span>Motivo</span>
            <strong>{report.reason}</strong>
          </div>
          <div>
            <span>Creador de la publicación</span>
            <strong>{owner ? `${owner.name} (${owner.username})` : 'Desconocido'}</strong>
          </div>
          <div>
            <span>Reportante</span>
            <strong>{reporter}</strong>
          </div>
          <div>
            <span>Fecha de envío</span>
            <strong>{formatDate(report.createdAt)}</strong>
          </div>
        </div>

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>Cerrar</button>
          <button type="button" className="mini-action" onClick={onOpenReport}>Ir a la publicación</button>
          <button type="button" className="mini-action" onClick={onWarn}>Advertir</button>
          <button type="button" className="mini-action" onClick={() => onOpenSanction('mute')}>Silenciar</button>
          <button type="button" className="mini-action" onClick={() => onOpenSanction('ban')}>Banear</button>
          <button type="button" className="mini-action danger-text" onClick={onDeleteReport}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function ModerationUserRow({ user, history, onLoadHistory, onDeleteWarning, onOpenSanction, formatDate }) {
  const menuRef = useRef(null);
  const statusText = user.status === 'banned'
    ? `Suspendido${user.bannedUntil ? ` hasta ${formatDate(user.bannedUntil)}` : ''}`
    : user.mutedUntil
      ? `Silenciado hasta ${formatDate(user.mutedUntil)}`
      : 'Activo';
  const isOpen = history.openUserId === user.id;

  const closeMenu = () => {
    if (menuRef.current) menuRef.current.removeAttribute('open');
  };

  const runMenuAction = (action) => {
    action();
    closeMenu();
  };

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div className="moderation-user-wrap">
      <div className="admin-user-row moderation-user-row">
        <RoleCard user={user} meta={statusText} />

        <div className="moderation-controls">
          <details ref={menuRef} className="moderation-menu">
            <summary className="mini-action">
              <ClipboardList size={14} />
              Gestionar
              <ChevronDown size={14} />
            </summary>
            <div className="moderation-menu-popover">
              <button type="button" onClick={() => runMenuAction(() => onLoadHistory(user))}>Ver historial</button>
              <button type="button" onClick={() => runMenuAction(() => onOpenSanction(user, 'mute'))}>{user.mutedUntil ? 'Cambiar mute' : 'Silenciar'}</button>
              <button type="button" onClick={() => runMenuAction(() => onOpenSanction(user, 'ban'))}>{user.status === 'banned' ? 'Cambiar ban' : 'Banear'}</button>
            </div>
          </details>
        </div>
      </div>

      {isOpen && (
        <div className="moderation-history">
          <strong>Historial de advertencias</strong>
          {history[user.id]?.length ? (
            history[user.id].map((warning) => (
              <div key={warning.id}>
                <span>{warning.reason}</span>
                <small>{warning.moderatorName} · {formatDate(warning.createdAt)}</small>
                <button className="history-delete" title="Eliminar advertencia" aria-label={`Eliminar advertencia: ${warning.reason}`} onClick={() => onDeleteWarning(warning, user.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <p>No hay advertencias registradas.</p>
          )}
        </div>
      )}
    </div>
  );
}
