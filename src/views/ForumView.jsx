import { Circle, Users } from 'lucide-react';
import { Avatar, RoleBadge, UserLink } from '../components/Common';

const submitOnEnter = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

export default function ForumView({ boards, activeThread, filteredThreads, threadForm, setThreadForm, handleCreateThread, threadPosts, userMap, users, loggedUser, isModerator, formatDate, openProfile, handleAddPost, postDraft, setPostDraft, handleHidePost, handleDeletePost, handleDeleteThread, handleLockThread, setSelectedThreadId }) {
  return (
    <>
      <section className="thread-creator">
        <h4>Nueva publicación</h4>
        <form onSubmit={handleCreateThread}>
          <input value={threadForm.title} onChange={(event) => setThreadForm({ ...threadForm, title: event.target.value })} placeholder="Título de tu tema" />
          <textarea value={threadForm.content} onChange={(event) => setThreadForm({ ...threadForm, content: event.target.value })} onKeyDown={submitOnEnter} placeholder="Describe tu idea o pregunta..." rows="3" />
          <button className="primary-btn">Publicar tema</button>
        </form>
      </section>

      <div className="forum-layout">
        <section className="thread-list-panel">
          <div className="section-header"><h4>Temas activos</h4></div>
          <div className="thread-list">
            {filteredThreads.length ? filteredThreads.map((thread) => {
              const threadAuthor = userMap[thread.authorId] || (loggedUser?.id === thread.authorId ? loggedUser : { id: thread.authorId, name: 'Usuario', role: 'member' });
              return (
                <button key={thread.id} className={`thread-card ${activeThread?.id === thread.id ? 'selected' : ''}`} onClick={() => setSelectedThreadId(thread.id)}>
                  <div className="thread-header-row"><strong>{thread.title}</strong><span>{thread.locked ? 'Bloqueado' : `${threadPosts.filter((post) => post.threadId === thread.id).length} respuestas`}</span></div>
                  <p>{thread.content}</p>
                  <small>{threadAuthor.name} · {formatDate(thread.createdAt)}</small>
                </button>
              );
            }) : <p className="empty-state">No hay temas para esta búsqueda.</p>}
          </div>
        </section>

        <section className="thread-detail-panel">
          {activeThread ? (
            <>
              <div className="discussion-header">
                <div>
                  <span className="topic-pill">{boards.find((board) => board.id === activeThread.boardId)?.name}</span>
                  <h3>{activeThread.title}</h3>
                  <small>Publicado por <button className="inline-link" onClick={() => openProfile(activeThread.authorId)}>{(userMap[activeThread.authorId] || (loggedUser?.id === activeThread.authorId ? loggedUser : { name: 'Usuario' })).name}</button> · {formatDate(activeThread.createdAt)}</small>
                </div>
                {isModerator && <div className="action-row"><button className="ghost-btn small-btn" onClick={() => handleLockThread(activeThread)}>{activeThread.locked ? 'Desbloquear' : 'Bloquear'}</button><button className="danger-btn small-btn" onClick={() => handleDeleteThread(activeThread)}>Eliminar</button></div>}
              </div>
              <div className="discussion-body"><p>{activeThread.content}</p></div>
              <div className="post-list">
                {threadPosts.length ? threadPosts.map((post) => {
                  const postAuthor = userMap[post.authorId] || (loggedUser?.id === post.authorId ? loggedUser : { id: post.authorId, name: 'Usuario', role: 'member' });
                  return <article key={post.id} className="post-card"><div className="post-meta"><UserLink user={postAuthor} onClick={() => openProfile(post.authorId)} /><span>{formatDate(post.createdAt)}</span></div><p>{post.content}</p><div className="action-row">{(isModerator || post.authorId === loggedUser.id) && <button className="mini-action" onClick={() => handleHidePost(post)}>{post.status === 'hidden' ? 'Mostrar' : 'Ocultar'}</button>}{isModerator && <button className="mini-action danger-text" onClick={() => handleDeletePost(post)}>Eliminar</button>}</div></article>;
                }) : <p className="empty-state">Aún no hay respuestas en este tema.</p>}
              </div>
              {!activeThread.locked && <form onSubmit={handleAddPost} className="reply-form"><textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} onKeyDown={submitOnEnter} placeholder="Escribe tu respuesta..." rows="4" /><button className="primary-btn">Responder</button></form>}
            </>
          ) : <p className="empty-state">Selecciona un tema para comenzar.</p>}
        </section>
        <ForumPresence users={users} loggedUser={loggedUser} openProfile={openProfile} />
      </div>
    </>
  );
}

function ForumPresence({ users, loggedUser, openProfile }) {
  const activeUsers = users.filter((user) => user.isOnline);
  const inactiveUsers = users.filter((user) => !user.isOnline);
  const teamUsers = activeUsers.filter((user) => ['support', 'moderator', 'admin', 'creator'].includes(user.role));
  const renderUser = (user, inactive = false) => <button key={user.id} className={`presence-user ${inactive ? 'is-inactive' : ''}`} onClick={() => openProfile(user.id)}><Avatar user={user} small /><span className="presence-user-copy"><strong>{user.name || 'Usuario'}</strong><small>{user.username || 'Sin username'}</small></span><RoleBadge role={user.role || 'member'} /><Circle className="presence-dot" size={9} fill="currentColor" /></button>;
  return <aside className="forum-presence"><div className="presence-heading"><div><span className="eyebrow">Comunidad</span><h4>Usuarios</h4></div><Users size={18} /></div><p className="presence-caption">Conectados en este momento</p><PresenceGroup className="presence-group" title="Activos" count={activeUsers.length} users={activeUsers} renderUser={renderUser} /><PresenceGroup className="presence-group" title="Inactivos" count={inactiveUsers.length} users={inactiveUsers} renderUser={(user) => renderUser(user, true)} inactive /><PresenceGroup className="presence-group presence-team" title="Equipo" count={teamUsers.length} users={teamUsers} renderUser={renderUser} team /><div className="presence-footer">Tu cuenta: <strong>{loggedUser?.username || 'Usuario'}</strong></div></aside>;
}

function PresenceGroup({ className, title, count, users, renderUser, inactive, team }) {
  return <section className={className}><div className="presence-group-heading"><span><i className={`status-pulse ${inactive ? 'inactive' : team ? 'team' : 'active'}`} />{title}</span><strong>{count}</strong></div>{users.length ? users.map(renderUser) : <p className="presence-empty">{inactive ? 'Nadie inactivo.' : team ? 'No hay personal conectado.' : 'No hay cuentas activas.'}</p>}</section>;
}
