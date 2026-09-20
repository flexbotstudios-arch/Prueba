import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Circle, Gavel, Headphones, LayoutDashboard, LifeBuoy, ShieldCheck, UserRound, Users } from 'lucide-react';

const SESSION_KEY = 'forum-demo-session';
const roleLabels = { creator: 'Creador', admin: 'Administrador', moderator: 'Moderador', support: 'Soporte', member: 'Miembro' };
const roleIcons = { creator: ShieldCheck, admin: ShieldCheck, moderator: Gavel, support: Headphones, member: UserRound };
const roleDescriptions = {
  creator: 'Control total, gestión de cuentas y reinicio de datos.',
  admin: 'Acceso total, gestión de roles y configuración.',
  moderator: 'Moderación de usuarios, temas y respuestas.',
  support: 'Gestión de mensajes de ayuda y seguimiento.',
  member: 'Participación en conversaciones y perfiles.',
};

const submitOnEnter = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

function App() {
  const [db, setDb] = useState({ users: [], boards: [], threads: [], posts: [], supportMessages: [], supportReplies: [] });
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState('forum');
  const [profileId, setProfileId] = useState(null);
  const [authView, setAuthView] = useState('login');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', username: '', email: '', password: '' });
  const [selectedBoardId, setSelectedBoardId] = useState('general');
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadForm, setThreadForm] = useState({ title: '', content: '' });
  const [postDraft, setPostDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', username: '', avatar: '', bio: '' });
  const [supportForm, setSupportForm] = useState({ subject: '', content: '' });
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [supportReply, setSupportReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [sanctionDialog, setSanctionDialog] = useState(null);

  const parseResponse = async (response) => {
    const text = await response.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch {
      return { message: text };
    }
  };

  const api = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (session?.token) headers.Authorization = `Bearer ${session.token}`;
    const response = await fetch(url, { ...options, headers });
    const result = await parseResponse(response);
    if (response.status === 401) setSession(null);
    if (!response.ok) throw new Error(result.message || 'No se pudo completar la acción');
    return result;
  };

  const fetchForumData = async (nextThreadId = null) => {
    try {
      const data = await api('/api/data');
      setDb(data);
      setSession((current) => {
        const freshUser = current && data.users.find((user) => user.id === current.user.id);
        if (current && !freshUser) return null;
        if (freshUser?.status === 'banned') return null;
        return freshUser ? { ...current, user: freshUser } : current;
      });
      if (!data.boards.some((board) => board.id === selectedBoardId) && data.boards.length) setSelectedBoardId(data.boards[0].id);
      if (nextThreadId && data.threads.some((thread) => thread.id === nextThreadId)) setSelectedThreadId(nextThreadId);
      else if (!data.threads.some((thread) => thread.id === selectedThreadId)) setSelectedThreadId(data.threads[0]?.id || null);
    } catch (error) {
      console.error('Error loading forum data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchForumData();
  }, []);

  useEffect(() => {
    if (session && !session.token) setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    const refreshTimer = window.setInterval(() => fetchForumData(), 3000);
    return () => window.clearInterval(refreshTimer);
  }, [session]);

  useEffect(() => {
    const token = session?.token;
    if (!token) return undefined;
    const markOffline = () => {
      const body = new Blob([JSON.stringify({ token })], { type: 'application/json' });
      navigator.sendBeacon?.('/api/presence/offline', body);
    };
    window.addEventListener('pagehide', markOffline);
    return () => window.removeEventListener('pagehide', markOffline);
  }, [session?.token]);

  useEffect(() => {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }, [session]);

  useEffect(() => {
    if (view !== 'support' || !selectedTicketId) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const messageList = document.querySelector('.ticket-messages');
      messageList?.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [view, selectedTicketId, (db.supportReplies || []).length]);

  const loggedUser = session?.user || null;
  const userMap = useMemo(() => Object.fromEntries(db.users.map((user) => [user.id, user])), [db.users]);
  const searchedUsers = useMemo(
    () => db.users.filter((user) => `${user.username || ''} ${user.name}`.toLowerCase().includes(userSearch.toLowerCase())),
    [db.users, userSearch],
  );

  const isAdmin = loggedUser?.role === 'admin' || loggedUser?.role === 'creator';
  const isCreator = loggedUser?.role === 'creator';
  const isModerator = isAdmin || loggedUser?.role === 'moderator';
  const isSupport = isAdmin || loggedUser?.role === 'support';

  const boards = db.boards || [];
  const visibleThreads = useMemo(
    () => db.threads.filter((thread) => thread.boardId === selectedBoardId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [db.threads, selectedBoardId],
  );
  const activeThread = visibleThreads.find((thread) => thread.id === selectedThreadId) || visibleThreads[0] || null;
  const threadPosts = activeThread ? db.posts.filter((post) => post.threadId === activeThread.id && post.status !== 'hidden').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) : [];
  const filteredThreads = visibleThreads.filter((thread) => `${thread.title} ${thread.content}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const hiddenPosts = db.posts.filter((post) => post.status === 'hidden');
  const profileUser = userMap[profileId] || loggedUser;
  const profileThreads = db.threads.filter((thread) => thread.authorId === profileUser?.id);
  const profilePosts = db.posts.filter((post) => post.authorId === profileUser?.id);

  const formatDate = (value) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const avatarText = (user) => user?.avatar || (user?.name || 'U').slice(0, 2).toUpperCase();
  const openProfile = (id) => {
    setProfileId(id);
    const target = userMap[id] || loggedUser;
    setProfileForm({
      name: target?.name || '',
      username: target?.username || '',
      avatar: target?.avatar || '',
      bio: target?.bio || '',
    });
    setView('profile');
  };

  const json = (body, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const showNotice = (message, title = 'Aviso') => setDialog({ title, message, confirmLabel: 'Aceptar' });
  const showConfirm = (message, onConfirm) => setDialog({ title: 'Confirmar acción', message, confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', onConfirm });
  const openSanctionDialog = (user, type) => setSanctionDialog({ user, type });

  const handleRegister = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/api/register', json(registerForm));
      setSession({ user: result.user, token: result.token });
      setRegisterForm({ name: '', username: '', email: '', password: '' });
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo registrar');
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/api/login', json(loginForm));
      setSession({ user: result.user, token: result.token });
      setLoginForm({ identifier: '', password: '' });
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo iniciar sesión');
    }
  };

  const handleLogout = async () => {
    try {
      await api('/api/logout', json({}));
    } finally {
      setSession(null);
    }
  };

  const handleCreateThread = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/api/threads', json({ ...threadForm, boardId: selectedBoardId, userId: loggedUser.id }));
      setThreadForm({ title: '', content: '' });
      setView('forum');
      await fetchForumData(result.thread.id);
    } catch (error) {
      showNotice(error.message, 'No se pudo crear el tema');
    }
  };

  const handleAddPost = async (event) => {
    event.preventDefault();
    if (!postDraft.trim() || !activeThread) return;
    try {
      await api('/api/posts', json({ threadId: activeThread.id, content: postDraft, userId: loggedUser.id }));
      setPostDraft('');
      await fetchForumData(activeThread.id);
    } catch (error) {
      showNotice(error.message, 'No se pudo enviar la respuesta');
    }
  };

  const handleRoleChange = async (userId, role) => {
    try {
      const result = await api(`/api/users/${userId}/role`, json({ role, userId: loggedUser.id }, 'PATCH'));
      await fetchForumData();
      if (userId === loggedUser.id) setSession((current) => ({ ...current, user: result.user }));
    } catch (error) {
      showNotice(error.message, 'No se pudo cambiar el rol');
    }
  };

  const handleProfileSave = async (event) => {
    event.preventDefault();
    try {
      const result = await api(`/api/users/${loggedUser.id}/profile`, json({ ...profileForm, userId: loggedUser.id }, 'PATCH'));
      setSession((current) => ({ ...current, user: result.user }));
      setProfileId(result.user.id);
      await fetchForumData();
      showNotice('Tus datos se guardaron correctamente', 'Perfil actualizado');
    } catch (error) {
      showNotice(error.message, 'No se pudo actualizar el perfil');
    }
  };

  const handleBan = async (user, banned, durationMinutes, reason) => {
    try {
      await api(`/api/users/${user.id}/ban`, json({ userId: loggedUser.id, banned, durationMinutes, reason }, 'PATCH'));
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo actualizar la sanción');
    }
  };

  const handleMute = async (user, minutes, reason) => {
    try {
      await api(`/api/users/${user.id}/mute`, json({ userId: loggedUser.id, minutes, reason }, 'PATCH'));
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo actualizar el mute');
    }
  };

  const handleHidePost = async (post) => {
    try {
      await api(`/api/posts/${post.id}/hide`, json({ userId: loggedUser.id }, 'PATCH'));
      await fetchForumData(activeThread?.id);
    } catch (error) {
      showNotice(error.message, 'No se pudo actualizar la respuesta');
    }
  };

  const handleDeletePost = async (post) => {
    showConfirm('Esta respuesta se eliminará de forma permanente.', async () => {
      try {
        await api(`/api/posts/${post.id}`, json({ userId: loggedUser.id }, 'DELETE'));
        await fetchForumData(activeThread?.id);
      } catch (error) {
        showNotice(error.message, 'No se pudo eliminar');
      }
    });
  };

  const handleDeleteThread = async (thread) => {
    showConfirm('El tema y todas sus respuestas se eliminarán de forma permanente.', async () => {
      try {
        await api(`/api/threads/${thread.id}`, json({ userId: loggedUser.id }, 'DELETE'));
        await fetchForumData();
      } catch (error) {
        showNotice(error.message, 'No se pudo eliminar');
      }
    });
  };

  const handleLockThread = async (thread) => {
    try {
      await api(`/api/threads/${thread.id}/lock`, json({ userId: loggedUser.id }, 'PATCH'));
      await fetchForumData(thread.id);
    } catch (error) {
      showNotice(error.message, 'No se pudo cambiar el estado');
    }
  };

  const handleCreateBoard = async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const result = await api('/api/boards', json({ name: form.get('name'), description: form.get('description'), userId: loggedUser.id }));
      formElement.reset();
      setSelectedBoardId(result.board.id);
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo crear la tabla');
    }
  };

  const handleDeleteBoard = async (board) => {
    showConfirm(`La tabla "${board.name}" y todo su contenido se eliminarán de forma permanente.`, async () => {
      try {
        await api(`/api/boards/${board.id}`, json({ userId: loggedUser.id }, 'DELETE'));
        if (selectedBoardId === board.id) setSelectedBoardId('general');
        await fetchForumData();
      } catch (error) {
        showNotice(error.message, 'No se pudo eliminar la tabla');
      }
    });
  };

  const handleSupportSubmit = async (event) => {
    event.preventDefault();
    try {
      const result = await api('/api/support-messages', json({ ...supportForm, userId: loggedUser.id }));
      setSupportForm({ subject: '', content: '' });
      setSelectedTicketId(result.ticket?.id || null);
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo crear el ticket');
    }
  };

  const handleSupportStatus = async (message, status) => {
    try {
      await api(`/api/support-messages/${message.id}`, json({ userId: loggedUser.id, status }, 'PATCH'));
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo actualizar el ticket');
    }
  };

  const handleSupportReply = async (event) => {
    event.preventDefault();
    if (!selectedTicketId || !supportReply.trim()) return;
    try {
      await api(`/api/support-messages/${selectedTicketId}/replies`, json({ userId: loggedUser.id, content: supportReply }));
      setSupportReply('');
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo enviar el mensaje');
    }
  };

  if (!session) return <AuthScreen authView={authView} setAuthView={setAuthView} loginForm={loginForm} setLoginForm={setLoginForm} registerForm={registerForm} setRegisterForm={setRegisterForm} handleLogin={handleLogin} handleRegister={handleRegister} />;
  if (loading) return <div className="loading-screen"><div className="loading-orbit"><div className="logo">F</div></div><strong>Preparando tu espacio</strong><span>Un momento...</span></div>;

  return (
    <div className="forum-app">
      <aside className="sidebar">
        <Brand />
        <button className="profile-card profile-link" onClick={() => openProfile(loggedUser.id)}>
          <Avatar user={loggedUser} />
          <span>
            <strong>{loggedUser.name}</strong>
            <RoleBadge role={loggedUser.role} />
          </span>
        </button>

        <nav className="board-list">
          <p className="mini-label">Tablas de conversación</p>
          {boards.map((board) => (
            <button key={board.id} className={`board-item ${selectedBoardId === board.id ? 'active' : ''}`} onClick={() => { setSelectedBoardId(board.id); setView('forum'); }}>
              <span>{board.name}</span>
              <small>{db.threads.filter((thread) => thread.boardId === board.id).length}</small>
            </button>
          ))}
        </nav>

        <nav className="app-nav">
          <button onClick={() => setView('forum')} className={view === 'forum' ? 'active' : ''}><LayoutDashboard size={16} />Foro</button>
          <button onClick={() => { setProfileId(loggedUser.id); setProfileForm(loggedUser); setView('profile'); }} className={view === 'profile' ? 'active' : ''}><UserRound size={16} />Mi perfil</button>
          {isModerator && <button onClick={() => setView('moderation')} className={view === 'moderation' ? 'active' : ''}><Gavel size={16} />Moderación</button>}
          {isAdmin && <button onClick={() => setView('admin')} className={view === 'admin' ? 'active' : ''}><ShieldCheck size={16} />Administración</button>}
          {isCreator && <button onClick={() => setView('creator')} className={view === 'creator' ? 'active' : ''}><ShieldCheck size={16} />Creación</button>}
          <button onClick={() => { setSelectedTicketId(null); setView('support'); }} className={view === 'support' ? 'active' : ''}><LifeBuoy size={16} />Soporte</button>
        </nav>

        <div className="sidebar-scroll-hint"><ChevronDown size={15} /><span>Desliza para ver más</span></div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-title">
            <p className="eyebrow">Espacio comunitario</p>
            <h3>{view === 'forum' ? boards.find((board) => board.id === selectedBoardId)?.name : view === 'profile' ? 'Perfil' : view === 'admin' ? 'Administración' : view === 'creator' ? 'Panel de creación' : view === 'moderation' ? 'Moderación' : 'Soporte'}</h3>
            <small>{roleDescriptions[loggedUser.role]}</small>
          </div>
          <div className="topbar-actions">
            {view === 'forum' && <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar en esta tabla" />}
            {['moderation', 'admin', 'creator'].includes(view) && <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por @username" />}
            <button className="ghost-btn" onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </header>

        <div className="view-transition" key={`${view}-${selectedBoardId}-${profileId || ''}`}>
          {view === 'forum' && <ForumView boards={boards} selectedBoardId={selectedBoardId} activeThread={activeThread} filteredThreads={filteredThreads} threadForm={threadForm} setThreadForm={setThreadForm} handleCreateThread={handleCreateThread} threadPosts={threadPosts} userMap={userMap} users={db.users} loggedUser={loggedUser} isModerator={isModerator} formatDate={formatDate} openProfile={openProfile} handleAddPost={handleAddPost} postDraft={postDraft} setPostDraft={setPostDraft} handleHidePost={handleHidePost} handleDeletePost={handleDeletePost} handleDeleteThread={handleDeleteThread} handleLockThread={handleLockThread} setSelectedThreadId={setSelectedThreadId} />}
          {view === 'profile' && <ProfileView user={profileUser} isOwn={profileUser?.id === loggedUser.id} form={profileForm} setForm={setProfileForm} onSave={handleProfileSave} threads={profileThreads} posts={profilePosts} formatDate={formatDate} roleLabels={roleLabels} />}
          {view === 'moderation' && <ModerationView users={searchedUsers} hiddenPosts={hiddenPosts} userMap={userMap} loggedUser={loggedUser} onBan={handleBan} onMute={handleMute} onOpenSanction={openSanctionDialog} onHide={handleHidePost} onDelete={handleDeletePost} formatDate={formatDate} />}
          {view === 'admin' && <AdminView users={searchedUsers} boards={boards} loggedUser={loggedUser} onRoleChange={handleRoleChange} onCreateBoard={handleCreateBoard} onDeleteBoard={handleDeleteBoard} />}
          {view === 'creator' && <CreatorView users={searchedUsers} loggedUser={loggedUser} search={userSearch} setSearch={setUserSearch} formatDate={formatDate} onReset={async () => { await api('/api/creator/reset', json({})); await fetchForumData(); }} />}
          {view === 'support' && <TicketSupportView messages={db.supportMessages || []} replies={db.supportReplies || []} users={userMap} loggedUser={loggedUser} isSupport={isSupport} form={supportForm} setForm={setSupportForm} onSubmit={handleSupportSubmit} onStatus={handleSupportStatus} onReply={handleSupportReply} reply={supportReply} setReply={setSupportReply} selectedTicketId={selectedTicketId} setSelectedTicketId={setSelectedTicketId} formatDate={formatDate} />}
        </div>

        {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
        {sanctionDialog && <SanctionDialog sanction={sanctionDialog} onClose={() => setSanctionDialog(null)} onBan={handleBan} onMute={handleMute} />}
      </main>
    </div>
  );
}

function Brand() {
  return <div className="brand-block sidebar-brand"><div className="logo">F</div><div><p className="eyebrow">Foro comunitario</p><h2>ForumBonito</h2></div></div>;
}

function Avatar({ user, small = false }) {
  const [imageFailed, setImageFailed] = useState(false);
  const avatar = user?.avatar?.trim();
  return <span className={`avatar ${small ? 'small' : ''}`}>{avatar && !imageFailed ? <img src={avatar} alt={`Avatar de ${user.name}`} onError={() => setImageFailed(true)} /> : avatar || (user?.name || 'U').slice(0, 2).toUpperCase()}</span>;
}

function RoleBadge({ role }) {
  const Icon = roleIcons[role] || UserRound;
  return <span className={`role-badge role-${role}`}><Icon size={13} strokeWidth={2.4} />{roleLabels[role]}</span>;
}

function UserLink({ user, onClick }) {
  if (!user) {
    return <span className="user-link user-link-empty"><Avatar user={null} small /><span>Usuario</span><RoleBadge role="member" /></span>;
  }
  return <button className="user-link" onClick={onClick}><Avatar user={user} small /><span><strong>{user.name || 'Usuario'}</strong>{user.username && <small>{user.username}</small>}</span><RoleBadge role={user.role || 'member'} /></button>;
}

function AuthScreen({ authView, setAuthView, loginForm, setLoginForm, registerForm, setRegisterForm, handleLogin, handleRegister }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <Brand />
        <div className="auth-tabs">
          <span className={`auth-tab-indicator ${authView === 'register' ? 'register' : ''}`} aria-hidden="true" />
          <button className={authView === 'login' ? 'active' : ''} onClick={() => setAuthView('login')}>Iniciar sesión</button>
          <button className={authView === 'register' ? 'active' : ''} onClick={() => setAuthView('register')}>Registro</button>
        </div>
        {authView === 'login' ? (
          <form key="login" onSubmit={handleLogin} className="auth-form auth-form-login">
            <h2>Accede a tu cuenta</h2>
            <label>Username o correo<input value={loginForm.identifier} onChange={(event) => setLoginForm({ ...loginForm, identifier: event.target.value })} placeholder="@tu_username" /></label>
            <label>Contraseña<input type="password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} /></label>
            <button className="primary-btn">Entrar</button>
          </form>
        ) : (
          <form key="register" onSubmit={handleRegister} className="auth-form auth-form-register">
            <h2>Crear una cuenta</h2>
            <label>Display name<input value={registerForm.name} onChange={(event) => setRegisterForm({ ...registerForm, name: event.target.value })} /></label>
            <label>Username único<input value={registerForm.username} onChange={(event) => setRegisterForm({ ...registerForm, username: event.target.value })} placeholder="@tu_username" /></label>
            <label>Correo electrónico<input type="email" value={registerForm.email} onChange={(event) => setRegisterForm({ ...registerForm, email: event.target.value })} /></label>
            <label>Contraseña<input type="password" value={registerForm.password} onChange={(event) => setRegisterForm({ ...registerForm, password: event.target.value })} /></label>
            <button className="primary-btn">Registrarme</button>
          </form>
        )}
      </div>
    </div>
  );
}

function ForumView({ boards, selectedBoardId, activeThread, filteredThreads, threadForm, setThreadForm, handleCreateThread, threadPosts, userMap, users, loggedUser, isModerator, formatDate, openProfile, handleAddPost, postDraft, setPostDraft, handleHidePost, handleDeletePost, handleDeleteThread, handleLockThread, setSelectedThreadId }) {
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
                  <div className="thread-header-row">
                    <strong>{thread.title}</strong>
                    <span>{thread.locked ? 'Bloqueado' : `${threadPosts.filter((post) => post.threadId === thread.id).length} respuestas`}</span>
                  </div>
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
                {isModerator && (
                  <div className="action-row">
                    <button className="ghost-btn small-btn" onClick={() => handleLockThread(activeThread)}>{activeThread.locked ? 'Desbloquear' : 'Bloquear'}</button>
                    <button className="danger-btn small-btn" onClick={() => handleDeleteThread(activeThread)}>Eliminar</button>
                  </div>
                )}
              </div>

              <div className="discussion-body"><p>{activeThread.content}</p></div>

              <div className="post-list">
                {threadPosts.length ? threadPosts.map((post) => {
                  const postAuthor = userMap[post.authorId] || (loggedUser?.id === post.authorId ? loggedUser : { id: post.authorId, name: 'Usuario', role: 'member' });
                  return (
                    <article key={post.id} className="post-card">
                      <div className="post-meta">
                        <UserLink user={postAuthor} onClick={() => openProfile(post.authorId)} />
                        <span>{formatDate(post.createdAt)}</span>
                      </div>
                      <p>{post.content}</p>
                      <div className="action-row">
                        {(isModerator || post.authorId === loggedUser.id) && <button className="mini-action" onClick={() => handleHidePost(post)}>{post.status === 'hidden' ? 'Mostrar' : 'Ocultar'}</button>}
                        {isModerator && <button className="mini-action danger-text" onClick={() => handleDeletePost(post)}>Eliminar</button>}
                      </div>
                    </article>
                  );
                }) : <p className="empty-state">Aún no hay respuestas en este tema.</p>}
              </div>

              {!activeThread.locked && (
                <form onSubmit={handleAddPost} className="reply-form">
                  <textarea value={postDraft} onChange={(event) => setPostDraft(event.target.value)} onKeyDown={submitOnEnter} placeholder="Escribe tu respuesta..." rows="4" />
                  <button className="primary-btn">Responder</button>
                </form>
              )}
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

  const renderUser = (user, inactive = false) => (
    <button key={user.id} className={`presence-user ${inactive ? 'is-inactive' : ''}`} onClick={() => openProfile(user.id)}>
      <Avatar user={user} small />
      <span className="presence-user-copy"><strong>{user.name || 'Usuario'}</strong><small>{user.username || 'Sin username'}</small></span>
      <RoleBadge role={user.role || 'member'} />
      <Circle className="presence-dot" size={9} fill="currentColor" />
    </button>
  );

  return (
    <aside className="forum-presence">
      <div className="presence-heading">
        <div><span className="eyebrow">Comunidad</span><h4>Usuarios</h4></div>
        <Users size={18} />
      </div>
      <p className="presence-caption">Conectados en este momento</p>
      <section className="presence-group">
        <div className="presence-group-heading"><span><i className="status-pulse active" />Activos</span><strong>{activeUsers.length}</strong></div>
        {activeUsers.length ? activeUsers.map((user) => renderUser(user)) : <p className="presence-empty">No hay cuentas activas.</p>}
      </section>
      <section className="presence-group">
        <div className="presence-group-heading"><span><i className="status-pulse inactive" />Inactivos</span><strong>{inactiveUsers.length}</strong></div>
        {inactiveUsers.length ? inactiveUsers.map((user) => renderUser(user, true)) : <p className="presence-empty">Nadie inactivo.</p>}
      </section>
      <section className="presence-group presence-team">
        <div className="presence-group-heading"><span><i className="status-pulse team" />Equipo</span><strong>{teamUsers.length}</strong></div>
        {teamUsers.length ? teamUsers.map((user) => renderUser(user)) : <p className="presence-empty">No hay personal conectado.</p>}
      </section>
      <div className="presence-footer">Tu cuenta: <strong>{loggedUser?.username || 'Usuario'}</strong></div>
    </aside>
  );
}

function ProfileView({ user, isOwn, form, setForm, onSave, threads, posts, formatDate, roleLabels }) {
  if (!user) return <p className="empty-state">Perfil no encontrado.</p>;
  return (
    <section className="page-view profile-view">
      <div className="profile-hero">
        <Avatar user={user} />
        <div>
          <span className={`role-badge role-${user.role}`}>{roleLabels[user.role]}</span>
          <h2>{user.name}</h2>
          <p className="profile-username">{user.username}</p>
          <p>{user.bio || 'Este usuario todavía no ha añadido una biografía.'}</p>
        </div>
      </div>

      <div className="profile-grid">
        <div className="panel-card">
          <p className="mini-label">Información</p>
          <dl className="profile-facts">
            <div><dt>Username</dt><dd>{user.username}</dd></div>
            <div><dt>Cuenta creada</dt><dd>{formatDate(user.createdAt)}</dd></div>
            <div><dt>Publicaciones</dt><dd>{threads.length}</dd></div>
            <div><dt>Respuestas</dt><dd>{posts.length}</dd></div>
            <div><dt>Estado</dt><dd>{user.status === 'banned' ? 'Suspendida' : user.mutedUntil ? 'Silenciada temporalmente' : 'Activa'}</dd></div>
          </dl>
        </div>

        {isOwn && (
          <form className="panel-card profile-form" onSubmit={onSave}>
            <p className="mini-label">Editar mi perfil</p>
            <label>Username<input value={form.username || ''} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="@tu_username" /></label>
            <label>Nombre<input value={form.name || ''} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
            <label>Foto o avatar<input value={form.avatar || ''} onChange={(event) => setForm({ ...form, avatar: event.target.value })} placeholder="URL o emoji" /></label>
            <label>Biografía<textarea value={form.bio || ''} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows="4" /></label>
            <button className="primary-btn">Guardar perfil</button>
          </form>
        )}
      </div>

      <div className="panel-card">
        <p className="mini-label">Actividad reciente</p>
        {threads.length + posts.length === 0 ? <p className="empty-state">Todavía no hay actividad.</p> : <div className="activity-list">{threads.slice(0, 5).map((thread) => <div key={`thread-${thread.id}`}><strong>Publicó: {thread.title}</strong><small>{formatDate(thread.createdAt)}</small></div>)}{posts.slice(0, 5).map((post) => <div key={`post-${post.id}`}><strong>Respondió: {post.content.slice(0, 70)}</strong><small>{formatDate(post.createdAt)}</small></div>)}</div>}
      </div>
    </section>
  );
}

function ModerationView({ users, hiddenPosts, userMap, loggedUser, onBan, onMute, onOpenSanction, onHide, onDelete, formatDate }) {
  return (
    <section className="page-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Control de comunidad</p>
          <h2>Panel de moderación</h2>
        </div>
        <span className="role-badge role-moderator">Moderador</span>
      </div>

      <div className="panel-card">
        <p className="mini-label">Usuarios y sanciones</p>
        <div className="admin-list">
          {users.filter((user) => user.id !== loggedUser.id).map((user) => (
            <ModerationUserRow key={user.id} user={user} onOpenSanction={onOpenSanction} formatDate={formatDate} />
          ))}
        </div>
      </div>

      <div className="panel-card">
        <p className="mini-label">Contenido oculto</p>
        {hiddenPosts.length ? hiddenPosts.map((post) => (
          <div className="moderation-item" key={post.id}>
            <div>
              <strong>{userMap[post.authorId]?.name}</strong>
              <small>{post.content}</small>
            </div>
            <div className="action-row">
              <button className="mini-action" onClick={() => onHide(post)}>Mostrar</button>
              <button className="mini-action danger-text" onClick={() => onDelete(post)}>Eliminar</button>
            </div>
          </div>
        )) : <p className="empty-state">No hay contenido oculto.</p>}
      </div>
    </section>
  );
}

function ModerationUserRow({ user, onOpenSanction, formatDate }) {
  const statusText = user.status === 'banned' ? `Suspendido${user.bannedUntil ? ` hasta ${formatDate(user.bannedUntil)}` : ''}` : user.mutedUntil ? `Silenciado hasta ${formatDate(user.mutedUntil)}` : 'Activo';
  return (
    <div className="admin-user-row moderation-user-row">
      <RoleCard user={user} meta={statusText} />
      <div className="moderation-controls">
        <button className="mini-action" onClick={() => onOpenSanction(user, 'mute')}>{user.mutedUntil ? 'Cambiar mute' : 'Silenciar'}</button>
        <button className="mini-action danger-text" onClick={() => onOpenSanction(user, 'ban')}>{user.status === 'banned' ? 'Cambiar ban' : 'Banear'}</button>
      </div>
    </div>
  );
}

function RoleCard({ user, meta }) {
  return (
    <div className="role-user-card">
      <Avatar user={user} small />
      <div className="role-user-copy">
        <strong>{user.name || user.username || 'Usuario'}</strong>
        <small>{user.username || 'Username no disponible'} · {meta || user.email}</small>
      </div>
      <RoleBadge role={user.role} />
    </div>
  );
}

function AdminView({ users, boards, loggedUser, onRoleChange, onCreateBoard, onDeleteBoard }) {
  return (
    <section className="page-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Control total</p>
          <h2>Panel de administración</h2>
        </div>
        <RoleBadge role="admin" />
      </div>

      <div className="panel-card">
        <p className="mini-label">Gestionar roles</p>
        <div className="admin-list">
          {users.map((user) => (
            <div className="admin-user-row" key={user.id}>
              <RoleCard user={user} />
              <select value={user.role} onChange={(event) => onRoleChange(user.id, event.target.value)} disabled={user.id === loggedUser.id}>
                <option value="member">Miembro</option>
                <option value="moderator">Moderador</option>
                <option value="support">Soporte</option>
                <option value="admin">Administrador</option>
                <option value="creator">Creador</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      <form className="panel-card board-form" onSubmit={onCreateBoard}>
        <p className="mini-label">Crear una tabla</p>
        <input name="name" placeholder="Nombre de la tabla" />
        <textarea name="description" placeholder="Descripción" rows="3" />
        <button className="primary-btn">Guardar tabla</button>
      </form>

      <div className="panel-card">
        <p className="mini-label">Gestionar tablas</p>
        <div className="admin-list">
          {boards.map((board) => (
            <div className="admin-user-row" key={board.id}>
              <div>
                <strong>{board.name}</strong>
                <small>{board.description}</small>
              </div>
              <button className="mini-action danger-text" onClick={() => onDeleteBoard(board)}>Eliminar tabla</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AppDialog({ dialog, onClose }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-mark">!</div>
        <h2 id="dialog-title">{dialog.title}</h2>
        <p>{dialog.message}</p>
        <div className="dialog-actions">
          {dialog.cancelLabel && <button className="ghost-btn" onClick={onClose}>{dialog.cancelLabel}</button>}
          <button className="primary-btn" onClick={async () => { onClose(); await dialog.onConfirm?.(); }}>{dialog.confirmLabel || 'Aceptar'}</button>
        </div>
      </div>
    </div>
  );
}

function UsernameEditor({ value, onChange }) {
  return (
    <div className="panel-card username-editor">
      <p className="mini-label">Identidad pública</p>
      <label>Username único<input value={value} onChange={(event) => onChange(event.target.value)} placeholder="@tu_username" /><small>Guarda el perfil para aplicar el cambio.</small></label>
    </div>
  );
}

function CreatorView({ users, loggedUser, search, setSearch, formatDate, onReset }) {
  const [notice, setNotice] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [expandedUserId, setExpandedUserId] = useState(null);
  const filtered = users.filter((user) => `${user.username || ''} ${user.name}`.toLowerCase().includes(search.toLowerCase()));

  const getToken = () => {
    try {
      return JSON.parse(localStorage.getItem('forum-demo-session') || '{}')?.token || '';
    } catch {
      return '';
    }
  };

  const updateAccount = async (user) => {
    const payload = drafts[user.id] || {};
    const token = getToken();
    const response = await fetch(`/api/users/${user.id}/account`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: payload.email ?? user.email ?? '',
        password: payload.password ?? '',
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setNotice(result.message || 'No se pudo actualizar la cuenta.');
      return;
    }

    setNotice(`Cuenta de ${user.username} actualizada.`);
    setDrafts((current) => ({ ...current, [user.id]: {} }));
    window.location.reload();
  };

  const deleteUser = async (user) => {
    if (user.id === loggedUser.id) return;
    const response = await fetch(`/api/creator/users/${user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
    setNotice(response.ok ? `Cuenta ${user.username} eliminada.` : 'No se pudo eliminar la cuenta.');
    window.location.reload();
  };

  return (
    <section className="page-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Acceso de propietario</p>
          <h2>Panel de creación</h2>
          <small>Las contraseñas nunca se muestran: solo se almacenan como hashes.</small>
        </div>
        <RoleBadge role="creator" />
      </div>

      <div className="panel-card creator-danger-zone">
        <p className="mini-label">Base de datos</p>
        <h3>Reinicio completo</h3>
        <p>Elimina usuarios, contenido y tickets, conservando esta cuenta creadora.</p>
        <button className="danger-btn" onClick={onReset}>Reiniciar datos</button>
      </div>

      <div className="panel-card">
        <div className="panel-toolbar">
          <div>
            <p className="mini-label">Cuentas</p>
            <h3>Gestionar usuarios</h3>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por @username" />
        </div>

        <div className="admin-list">
          {filtered.map((user) => (
            <div className="admin-user-row creator-user-row" key={user.id}>
              <RoleCard user={user} meta={user.email || 'Correo privado'} />
              <div className="creator-controls">
                <button className="mini-action" onClick={() => setExpandedUserId((current) => current === user.id ? null : user.id)}>{expandedUserId === user.id ? 'Ocultar información' : 'Ver información'}</button>
                <input value={drafts[user.id]?.email ?? user.email ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...current[user.id], email: event.target.value } }))} placeholder="Correo nuevo" />
                <input type="password" value={drafts[user.id]?.password ?? ''} onChange={(event) => setDrafts((current) => ({ ...current, [user.id]: { ...current[user.id], password: event.target.value } }))} placeholder="Contraseña nueva" />
                <button className="mini-action" onClick={() => updateAccount(user)}>Guardar cuenta</button>
                <button className="mini-action danger-text" disabled={user.id === loggedUser.id} onClick={() => deleteUser(user)}>Eliminar cuenta</button>
              </div>
              {expandedUserId === user.id && (
                <dl className="account-details">
                  <div><dt>ID</dt><dd>{user.id}</dd></div>
                  <div><dt>Display name</dt><dd>{user.name || 'No disponible'}</dd></div>
                  <div><dt>Username</dt><dd>{user.username || 'No disponible'}</dd></div>
                  <div><dt>Correo</dt><dd>{user.email || 'Correo privado'}</dd></div>
                  <div><dt>Rol</dt><dd>{roleLabels[user.role] || user.role}</dd></div>
                  <div><dt>Estado</dt><dd>{user.status || 'active'}</dd></div>
                  <div><dt>Mute</dt><dd>{user.mutedUntil ? `${formatDate(user.mutedUntil)}${user.muteReason ? ` · ${user.muteReason}` : ''}` : 'No'}</dd></div>
                  <div><dt>Ban</dt><dd>{user.bannedUntil ? `${formatDate(user.bannedUntil)}${user.banReason ? ` · ${user.banReason}` : ''}` : 'No'}</dd></div>
                  <div><dt>Creada</dt><dd>{user.createdAt ? formatDate(user.createdAt) : 'No disponible'}</dd></div>
                  <div><dt>Avatar</dt><dd>{user.avatar || 'Sin avatar'}</dd></div>
                  <div className="account-details-wide"><dt>Biografía</dt><dd>{user.bio || 'Sin biografía'}</dd></div>
                  <div className="account-details-wide"><dt>Contraseña actual</dt><dd>Protegida mediante hash; no se puede consultar. Usa “Contraseña nueva” para reemplazarla.</dd></div>
                </dl>
              )}
            </div>
          ))}
        </div>

        {notice && <p className="empty-state">{notice}</p>}
      </div>
    </section>
  );
}

function SanctionDialog({ sanction, onClose, onBan, onMute }) {
  const [amount, setAmount] = useState('30');
  const [unit, setUnit] = useState('minutes');
  const [permanent, setPermanent] = useState(false);
  const [reason, setReason] = useState('');
  const isBan = sanction.type === 'ban';
  const unitMinutes = { minutes: 1, hours: 60, days: 1440, weeks: 10080, months: 43200 };
  const unitLabels = { minutes: 'minutos', hours: 'horas', days: 'días', weeks: 'semanas', months: 'meses' };

  const applySanction = async (revoked = false) => {
    onClose();
    if (revoked) {
      if (isBan) await onBan(sanction.user, false, 0, '');
      else await onMute(sanction.user, 0, '');
      return;
    }

    const durationMinutes = permanent ? (isBan ? 0 : -1) : Math.max(1, Number(amount || 0)) * unitMinutes[unit];
    if (isBan) await onBan(sanction.user, true, durationMinutes, reason.trim());
    else await onMute(sanction.user, durationMinutes, reason.trim());
  };

  return (
    <div className="dialog-backdrop" role="presentation">
      <form className="app-dialog sanction-dialog" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); applySanction(); }}>
        <div className="dialog-mark">!</div>
        <p className="eyebrow">Moderación</p>
        <h2>{isBan ? 'Configurar baneo' : 'Configurar mute'}</h2>
        <p>Elige cuánto tiempo {isBan ? 'se suspenderá' : 'no podrá participar'} <strong>{sanction.user.name}</strong>.</p>

        <label className="sanction-label">Motivo<textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explica el motivo de la sanción..." rows="3" /></label>
        <label className="sanction-toggle"><input type="checkbox" checked={permanent} onChange={(event) => setPermanent(event.target.checked)} /> Permanente</label>

        <div className="sanction-duration">
          <input type="number" min="1" value={amount} disabled={permanent} onChange={(event) => setAmount(event.target.value)} />
          <select value={unit} disabled={permanent} onChange={(event) => setUnit(event.target.value)}>
            {Object.entries(unitLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        <div className="dialog-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button>
          {(isBan ? sanction.user.status === 'banned' : Boolean(sanction.user.mutedUntil)) && <button type="button" className="ghost-btn revoke-btn" onClick={() => applySanction(true)}>Revocar</button>}
          <button type="submit" className="primary-btn">{isBan ? 'Aplicar baneo' : 'Aplicar mute'}</button>
        </div>
      </form>
    </div>
  );
}

function TicketSupportView({ messages, replies, users, loggedUser, isSupport, form, setForm, onSubmit, onStatus, onReply, reply, setReply, selectedTicketId, setSelectedTicketId, formatDate }) {
  const tickets = isSupport ? messages : messages.filter((message) => message.userId === loggedUser.id);
  const selectedTicket = selectedTicketId ? tickets.find((ticket) => ticket.id === selectedTicketId) || null : null;
  const ticketReplies = selectedTicket ? replies.filter((item) => item.ticketId === selectedTicket.id) : [];

  return (
    <section className="page-view support-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ayuda privada</p>
          <h2>{isSupport ? 'Bandeja de tickets' : 'Mis tickets'}</h2>
          <small>{isSupport ? 'Responde y actualiza el estado de cada conversación.' : 'Crea una conversación privada con el equipo de soporte.'}</small>
        </div>
        <RoleBadge role="support" />
      </div>

      <div className="ticket-layout">
        <aside className="ticket-sidebar">
          <div className="ticket-sidebar-head"><strong>Conversaciones</strong><span>{tickets.length}</span></div>
          {tickets.map((ticket) => (
            <button key={ticket.id} className={`ticket-item ${selectedTicket?.id === ticket.id ? 'active' : ''}`} onClick={() => setSelectedTicketId(ticket.id)}>
              <strong>{ticket.subject}</strong>
              <small>{ticket.status === 'pending' ? 'En espera' : ticket.status === 'in_progress' ? 'En curso' : ticket.status === 'resolved' ? 'Resuelto' : ticket.status === 'closed' ? 'Cerrado' : 'Abierto'} · {formatDate(ticket.updatedAt)}</small>
            </button>
          ))}
          {!tickets.length && <p className="empty-state">Todavía no tienes tickets.</p>}
        </aside>

        <div className="ticket-conversation">
          {selectedTicket ? (
            <>
              <header className="ticket-header">
                <div>
                  <p className="eyebrow">Ticket #{selectedTicket.id}</p>
                  <h3>{selectedTicket.subject}</h3>
                  <small>Creado por {users[selectedTicket.userId]?.name || 'Usuario'} · {formatDate(selectedTicket.createdAt)}</small>
                </div>
                {isSupport && (
                  <select value={selectedTicket.status} onChange={(event) => onStatus(selectedTicket, event.target.value)}>
                    <option value="open">Reabrir</option>
                    <option value="in_progress">En curso</option>
                    <option value="pending">En espera</option>
                    <option value="resolved">Resolver</option>
                    <option value="closed">Cerrar</option>
                  </select>
                )}
              </header>

              <div className="ticket-messages">
                <div className={`ticket-message ${selectedTicket.userId === loggedUser.id ? 'mine' : ''}`}>
                  <UserLink user={users[selectedTicket.userId]} onClick={() => {}} />
                  <small>{formatDate(selectedTicket.createdAt)}</small>
                  <p>{selectedTicket.content}</p>
                </div>

                {ticketReplies.map((replyItem) => (
                  <div key={replyItem.id} className={`ticket-message ${replyItem.userId === loggedUser.id ? 'mine' : ''}`}>
                    <UserLink user={users[replyItem.userId]} onClick={() => {}} />
                    <small>{formatDate(replyItem.createdAt)}</small>
                    <p>{replyItem.content}</p>
                  </div>
                ))}
              </div>

              <form className="reply-form" onSubmit={onReply}>
                <textarea value={reply} onChange={(event) => setReply(event.target.value)} onKeyDown={submitOnEnter} placeholder="Escribe tu respuesta..." rows="3" />
                <button className="primary-btn">Enviar respuesta</button>
              </form>
            </>
          ) : <p className="empty-state">Selecciona un ticket para verlo.</p>}
        </div>
      </div>

      {!isSupport && (
        <form className="panel-card support-form" onSubmit={onSubmit}>
          <p className="mini-label">Nuevo mensaje</p>
          <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Asunto" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} onKeyDown={submitOnEnter} placeholder="Describe lo que necesitas..." rows="6" />
          <button className="primary-btn">Enviar mensaje</button>
        </form>
      )}
    </section>
  );
}

function SupportView({ messages, users, isSupport, form, setForm, onSubmit, onStatus, formatDate }) {
  return (
    <section className="page-view">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Ayuda a la comunidad</p>
          <h2>{isSupport ? 'Bandeja de soporte' : 'Contactar con soporte'}</h2>
        </div>
        <span className="role-badge role-support">Soporte</span>
      </div>

      {!isSupport && (
        <form className="panel-card support-form" onSubmit={onSubmit}>
          <p className="mini-label">Nuevo mensaje</p>
          <input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Asunto" />
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Describe lo que necesitas..." rows="6" />
          <button className="primary-btn">Enviar mensaje</button>
        </form>
      )}

      {isSupport && (
        <div className="panel-card">
          <p className="mini-label">Mensajes recibidos</p>
          {messages.length ? (
            <div className="support-list">
              {messages.map((message) => (
                <article className="support-item" key={message.id}>
                  <div className="post-meta">
                    <strong>{message.subject}</strong>
                    <span>{formatDate(message.updatedAt)}</span>
                  </div>
                  <small>De: {users[message.userId]?.name || 'Usuario'}</small>
                  <p>{message.content}</p>
                  <select value={message.status} onChange={(event) => onStatus(message, event.target.value)}>
                    <option value="open">Abierto</option>
                    <option value="in_progress">En curso</option>
                    <option value="resolved">Resuelto</option>
                  </select>
                </article>
              ))}
            </div>
          ) : <p className="empty-state">No hay mensajes pendientes.</p>}
        </div>
      )}
    </section>
  );
}

export default App;
