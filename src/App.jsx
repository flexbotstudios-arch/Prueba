import { useEffect, useMemo, useState } from 'react';
import { Bell, ChevronDown, Gavel, Headphones, LayoutDashboard, LifeBuoy, Search, ShieldCheck, UserRound } from 'lucide-react';
import { Avatar, Brand, RoleBadge, RoleCard, UserLink, roleLabels } from './components/Common';
import { pathForRoute, routeFromPath } from './routing';
import { canAccessSection, sectionTitles } from './sections';
import AuthScreen from './views/AuthScreen';
import ErrorPage from './views/ErrorPage';
import ForumView from './views/ForumView';
import AdminView from './views/AdminView';
import ModerationView from './views/ModerationView';
import ProfileView from './views/ProfileView';
import CreatorView from './views/CreatorView';
import TicketSupportView from './views/TicketSupportView';

const SESSION_KEY = 'forum-demo-session';
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
  const initialRoute = routeFromPath(window.location.pathname, window.location.search);
  const [db, setDb] = useState({ users: [], boards: [], threads: [], posts: [], supportMessages: [], supportReplies: [] });
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setViewState] = useState(initialRoute.view);
  const [errorCode, setErrorCode] = useState(initialRoute.errorCode || 404);
  const [profileId, setProfileId] = useState(initialRoute.profileId);
  const [authView, setAuthView] = useState('login');
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [loginErrors, setLoginErrors] = useState({ identifier: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', username: '', email: '', password: '' });
  const [registerErrors, setRegisterErrors] = useState({ name: '', username: '', email: '', password: '' });
  const [selectedBoardId, setSelectedBoardId] = useState(initialRoute.boardId || 'general');
  const [selectedThreadId, setSelectedThreadId] = useState(null);
  const [threadForm, setThreadForm] = useState({ title: '', content: '', imageUrl: '', attachment: null });
  const [postDraft, setPostDraft] = useState('');
  const [postImageUrl, setPostImageUrl] = useState('');
  const [postAttachment, setPostAttachment] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileForm, setProfileForm] = useState({ name: '', username: '', avatar: '', bio: '' });
  const [supportForm, setSupportForm] = useState({ subject: '', content: '' });
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [supportReply, setSupportReply] = useState('');
  const [supportAttachment, setSupportAttachment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(null);
  const [userSearch, setUserSearch] = useState('');
  const [sanctionDialog, setSanctionDialog] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportDraft, setReportDraft] = useState(null);
  const [warningDraft, setWarningDraft] = useState(null);
  const [moderationHistory, setModerationHistory] = useState({});

  const setView = (nextView, options = {}) => {
    const route = {
      view: nextView,
      boardId: options.boardId || selectedBoardId,
      profileId: options.profileId ?? (nextView === 'profile' ? profileId : null),
      threadId: options.threadId || null,
    };
    const path = pathForRoute(route);
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setViewState(nextView);
    if (nextView === 'forbidden') setErrorCode(403);
    if (nextView === 'not-found') setErrorCode(404);
    if (options.boardId) setSelectedBoardId(options.boardId);
    if (Object.prototype.hasOwnProperty.call(options, 'profileId')) setProfileId(options.profileId);
  };

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
      if (isModerator) {
        try {
          const reportResult = await api('/api/reports');
          setReports(reportResult.reports || []);
        } catch (error) {
          console.error('Error loading reports:', error);
        }
      }
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
    const handleRouteChange = () => {
      const route = routeFromPath(window.location.pathname, window.location.search);
      setViewState(route.view);
      if (route.errorCode) setErrorCode(route.errorCode);
      if (route.boardId) setSelectedBoardId(route.boardId);
      if (route.threadId) setSelectedThreadId(route.threadId);
      setProfileId(route.profileId || null);
    };
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
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
    if (!session) return undefined;
    const loadNotifications = async () => {
      try {
        const result = await api('/api/notifications');
        setNotifications(result.notifications || []);
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 5000);
    return () => window.clearInterval(timer);
  }, [session?.token]);

  useEffect(() => {
    if (!session || searchQuery.trim().length < 2) {
      setSearchResults(null);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      try {
        const result = await api(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(result);
      } catch (error) {
        console.error('Error searching:', error);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, session?.token]);

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

  useEffect(() => {
    if (!session || !isModerator) return undefined;
    return undefined;
  }, [session?.token, isModerator]);

  useEffect(() => {
    if (!loggedUser) return;
    if (!canAccessSection(view, loggedUser)) setView('not-found');
  }, [loggedUser, view]);

  const boards = db.boards || [];
  const visibleThreads = useMemo(
    () => db.threads.filter((thread) => thread.boardId === selectedBoardId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [db.threads, selectedBoardId],
  );
  const activeThread = visibleThreads.find((thread) => thread.id === selectedThreadId) || visibleThreads[0] || null;
  const threadPosts = activeThread ? db.posts.filter((post) => post.threadId === activeThread.id && post.status !== 'hidden').sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)) : [];
  const filteredThreads = visibleThreads.filter((thread) => `${thread.title} ${thread.content}`.toLowerCase().includes(searchQuery.toLowerCase()));
  const hiddenPosts = db.posts.filter((post) => post.status === 'hidden');
  const profileUser = db.users.find((user) => String(user.id) === String(profileId) || user.publicId === profileId) || loggedUser;
  const profileThreads = db.threads.filter((thread) => thread.authorId === profileUser?.id);
  const profilePosts = db.posts.filter((post) => post.authorId === profileUser?.id);

  const formatDate = (value) => new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  const avatarText = (user) => user?.avatar || (user?.name || 'U').slice(0, 2).toUpperCase();
  const openProfile = (id) => {
    const target = userMap[id] || db.users.find((user) => user.publicId === id) || loggedUser;
    const profileKey = target?.publicId || target?.id || id;
    setProfileId(profileKey);
    setProfileForm({
      name: target?.name || '',
      username: target?.username || '',
      avatar: target?.avatar || '',
      bio: target?.bio || '',
    });
    setView('profile', { profileId: profileKey });
  };

  const json = (body, method = 'POST') => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const uploadImage = async (file) => {
    const result = await uploadFile(file, 'avatar');
    return result.url;
  };
  const uploadFile = async (file, purpose) => {
    if (file.size > 200 * 1024 * 1024) throw new Error('El archivo no puede superar los 200 MB');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose);
    const headers = session?.token ? { Authorization: `Bearer ${session.token}` } : {};
    const response = await fetch('/api/uploads', { method: 'POST', headers, body: formData });
    const result = await parseResponse(response);
    if (!response.ok) throw new Error(result.message || 'No se pudo subir el archivo');
    return result;
  };
  const showNotice = (message, title = 'Aviso') => setDialog({ title, message, confirmLabel: 'Aceptar' });
  const showConfirm = (message, onConfirm) => setDialog({ title: 'Confirmar acción', message, confirmLabel: 'Confirmar', cancelLabel: 'Cancelar', onConfirm });
  const openSanctionDialog = (user, type) => setSanctionDialog({ user, type });
  const handleReport = async (targetType, targetId) => {
    setReportDraft({ targetType, targetId, reason: '' });
  };
  const submitReport = async () => {
    if (!reportDraft?.reason.trim()) return;
    try {
      await api('/api/reports', json(reportDraft));
      setReportDraft(null);
    } catch (error) {
      showNotice(error.message, 'No se pudo enviar el reporte');
    }
  };
  const markNotificationRead = async (notification) => {
    if (notification.readAt) return;
    await api(`/api/notifications/${notification.id}/read`, json({}, 'PATCH'));
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item));
  };
  const openNotification = async (notification) => {
    await markNotificationRead(notification);
    if (notification.type === 'warning') {
      setDialog({
        title: 'Advertencia de moderación',
        message: `Motivo: ${notification.warningReason || 'No disponible'}\nModerador: ${notification.moderatorName || 'Moderación comunitaria'}\n\n¿Esto es un error? Crea un ticket de soporte.`,
        confirmLabel: 'Crear ticket de soporte',
        cancelLabel: 'Cerrar',
        onConfirm: () => { setSelectedTicketId(null); setView('support'); },
      });
      return;
    }
    if (!notification.link) return;
    const destination = new URL(notification.link, window.location.origin);
    const route = routeFromPath(destination.pathname, destination.search);
    setView(route.view, { boardId: route.boardId, profileId: route.profileId, threadId: route.threadId });
    if (route.threadId) setSelectedThreadId(route.threadId);
  };
  const loadModerationHistory = async (user) => {
    if (moderationHistory[user.id]) {
      setModerationHistory((current) => ({ ...current, openUserId: current.openUserId === user.id ? null : user.id }));
      return;
    }
    try {
      const result = await api(`/api/warnings?userId=${user.id}`);
      setModerationHistory((current) => ({ ...current, [user.id]: result.warnings || [], openUserId: user.id }));
    } catch (error) {
      showNotice(error.message, 'No se pudo cargar el historial');
    }
  };
  const resolveReport = async (reportId, status) => {
    await api(`/api/reports/${reportId}`, json({ status }, 'PATCH'));
    setReports((current) => current.filter((report) => report.id !== reportId));
  };
  const submitWarning = async () => {
    if (!warningDraft?.reason.trim()) return;
    const warnedUserId = warningDraft.userId;
    try {
      await api('/api/warnings', json({ userId: warningDraft.userId, reason: warningDraft.reason }));
      setWarningDraft(null);
      const historyResult = await api(`/api/warnings?userId=${warnedUserId}`);
      setModerationHistory((current) => ({ ...current, [warnedUserId]: historyResult.warnings || [], openUserId: warnedUserId }));
      const result = await api('/api/reports');
      setReports(result.reports || []);
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo crear la advertencia');
    }
  };
  const deleteWarning = (warning, userId) => {
    showConfirm('Esta advertencia se eliminará del historial de la cuenta.', async () => {
      try {
        await api(`/api/warnings/${warning.id}`, json({}, 'DELETE'));
        const historyResult = await api(`/api/warnings?userId=${userId}`);
        setModerationHistory((current) => ({ ...current, [userId]: historyResult.warnings || [], openUserId: userId }));
        await fetchForumData();
      } catch (error) {
        showNotice(error.message, 'No se pudo eliminar la advertencia');
      }
    });
  };
  const openReportedThread = (report) => {
    setSelectedThreadId(Number(report.threadId));
    setView('forum', { boardId: report.boardId });
  };
  const deleteReportedContent = async (report) => {
    try {
      if (report.targetType === 'post') await handleDeletePost({ id: report.targetId });
      else await handleDeleteThread({ id: report.targetId });
      await resolveReport(report.id, 'resolved');
    } catch (error) {
      showNotice(error.message, 'No se pudo eliminar el contenido');
    }
  };
  const banReportedOwner = (report) => handleBan({ id: report.ownerId, name: 'dueño de la publicación', status: 'active' }, true, 1440, 'Baneo por contenido reportado');

  const handleRegister = async (event) => {
    event.preventDefault();
    setRegisterErrors({ name: '', username: '', email: '', password: '' });
    const username = registerForm.username.trim().startsWith('@') ? registerForm.username.trim() : `@${registerForm.username.trim()}`;
    const errors = {
      name: registerForm.name.trim() ? '' : 'Escribe tu nombre.',
      username: username.length >= 4 && username.length <= 25 && /^@[a-z0-9_]{3,24}$/i.test(username) ? '' : 'Usa @ y entre 3 y 24 caracteres: @tu_usuario.',
      email: /^\S+@\S+\.\S+$/.test(registerForm.email.trim()) ? '' : 'Escribe un correo válido.',
      password: registerForm.password.length >= 6 ? '' : 'La contraseña debe tener al menos 6 caracteres.',
    };
    if (Object.values(errors).some(Boolean)) {
      setRegisterErrors(errors);
      return;
    }
    try {
      const result = await api('/api/register', json({ ...registerForm, username }));
      setSession({ user: result.user, token: result.token });
      setRegisterForm({ name: '', username: '', email: '', password: '' });
      setRegisterErrors({ name: '', username: '', email: '', password: '' });
      await fetchForumData();
    } catch (error) {
      const message = error.message || 'No se pudo registrar.';
      const nextErrors = { name: '', username: '', email: '', password: '' };
      if (message.toLowerCase().includes('username')) nextErrors.username = message;
      else if (message.toLowerCase().includes('correo') || message.toLowerCase().includes('email')) nextErrors.email = message;
      else if (message.toLowerCase().includes('contraseña')) nextErrors.password = message;
      else nextErrors.name = message;
      setRegisterErrors(nextErrors);
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoginErrors({ identifier: '', password: '' });
    const errors = {
      identifier: loginForm.identifier.trim() ? '' : 'Escribe tu username o correo.',
      password: loginForm.password ? '' : 'Escribe tu contraseña.',
    };
    if (loginForm.identifier.includes('@') && loginForm.identifier.includes('.') && !/^\S+@\S+\.\S+$/.test(loginForm.identifier.trim())) {
      errors.identifier = 'El formato del correo no es válido.';
    }
    if (errors.identifier || errors.password) {
      setLoginErrors(errors);
      return;
    }
    try {
      const result = await api('/api/login', json(loginForm));
      setSession({ user: result.user, token: result.token });
      setLoginForm({ identifier: '', password: '' });
      setLoginErrors({ identifier: '', password: '' });
      await fetchForumData();
    } catch (error) {
      const message = error.message || 'No se pudo iniciar sesión.';
      if (message.toLowerCase().includes('contraseña')) {
        setLoginErrors({ identifier: '', password: message });
      } else {
        setLoginErrors({ identifier: message, password: '' });
      }
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
      setThreadForm({ title: '', content: '', imageUrl: '', attachment: null });
      setView('forum');
      await fetchForumData(result.thread.id);
    } catch (error) {
      showNotice(error.message, 'No se pudo crear el tema');
    }
  };

  const handleAddPost = async (event) => {
    event.preventDefault();
    if ((!postDraft.trim() && !postImageUrl) || !activeThread) return;
    try {
      await api('/api/posts', json({ threadId: activeThread.id, content: postDraft, imageUrl: postImageUrl, attachment: postAttachment, userId: loggedUser.id }));
      setPostDraft('');
      setPostImageUrl('');
      setPostAttachment(null);
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
    if (!selectedTicketId || (!supportReply.trim() && !supportAttachment)) return;
    try {
      await api(`/api/support-messages/${selectedTicketId}/replies`, json({ userId: loggedUser.id, content: supportReply, attachment: supportAttachment }));
      setSupportReply('');
      setSupportAttachment(null);
      await fetchForumData();
    } catch (error) {
      showNotice(error.message, 'No se pudo enviar el mensaje');
    }
  };

  if (view === 'not-found' || view === 'forbidden') return <ErrorPage code={errorCode} onHome={() => setView('forum')} />;
  if (!session) return <AuthScreen authView={authView} setAuthView={setAuthView} loginForm={loginForm} setLoginForm={setLoginForm} loginErrors={loginErrors} setLoginErrors={setLoginErrors} registerForm={registerForm} setRegisterForm={setRegisterForm} registerErrors={registerErrors} setRegisterErrors={setRegisterErrors} handleLogin={handleLogin} handleRegister={handleRegister} />;
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
            <button key={board.id} className={`board-item ${selectedBoardId === board.id ? 'active' : ''}`} onClick={() => setView('forum', { boardId: board.id })}>
              <span>{board.name}</span>
              <small>{db.threads.filter((thread) => thread.boardId === board.id).length}</small>
            </button>
          ))}
        </nav>

        <nav className="app-nav">
          <button onClick={() => setView('forum')} className={view === 'forum' ? 'active' : ''}><LayoutDashboard size={16} />Foro</button>
          <button onClick={() => { const profileKey = loggedUser.publicId || loggedUser.id; setProfileId(profileKey); setProfileForm(loggedUser); setView('profile', { profileId: profileKey }); }} className={view === 'profile' ? 'active' : ''}><UserRound size={16} />Mi perfil</button>
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
            <h3>{view === 'forum' ? boards.find((board) => board.id === selectedBoardId)?.name : sectionTitles[view]}</h3>
            <small>{roleDescriptions[loggedUser.role]}</small>
          </div>
          <div className="topbar-actions">
            {view === 'forum' && <div className="global-search"><Search size={15} /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar en todo el foro" />{searchResults && <SearchResults results={searchResults} openProfile={openProfile} setView={setView} />}</div>}
            {['moderation', 'admin', 'creator'].includes(view) && <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por @username" />}
            <button className="ghost-btn" onClick={handleLogout}>Cerrar sesión</button>
            <NotificationBell notifications={notifications} onOpen={openNotification} />
          </div>
        </header>

        <div className="view-transition" key={`${view}-${selectedBoardId}-${profileId || ''}`}>
          {view === 'forum' && <ForumView boards={boards} selectedBoardId={selectedBoardId} activeThread={activeThread} filteredThreads={filteredThreads} threadForm={threadForm} setThreadForm={setThreadForm} uploadImage={uploadImage} uploadFile={uploadFile} handleCreateThread={handleCreateThread} threadPosts={threadPosts} userMap={userMap} users={db.users} loggedUser={loggedUser} isModerator={isModerator} formatDate={formatDate} openProfile={openProfile} handleAddPost={handleAddPost} postDraft={postDraft} setPostDraft={setPostDraft} postImageUrl={postImageUrl} setPostImageUrl={setPostImageUrl} postAttachment={postAttachment} setPostAttachment={setPostAttachment} handleHidePost={handleHidePost} handleDeletePost={handleDeletePost} handleDeleteThread={handleDeleteThread} handleLockThread={handleLockThread} setSelectedThreadId={setSelectedThreadId} onReport={handleReport} />}
          {view === 'profile' && <ProfileView user={profileUser} isOwn={profileUser?.id === loggedUser.id} form={profileForm} setForm={setProfileForm} uploadImage={uploadImage} onSave={handleProfileSave} threads={profileThreads} posts={profilePosts} formatDate={formatDate} roleLabels={roleLabels} />}
          {view === 'moderation' && <ModerationView users={searchedUsers} reports={reports} hiddenPosts={hiddenPosts} userMap={userMap} loggedUser={loggedUser} history={moderationHistory} onLoadHistory={loadModerationHistory} onDeleteWarning={deleteWarning} onOpenSanction={openSanctionDialog} onHide={handleHidePost} onDelete={handleDeletePost} onResolveReport={resolveReport} onOpenReport={openReportedThread} onWarn={(userId) => setWarningDraft({ userId, reason: '' })} onDeleteReport={deleteReportedContent} onBanReport={banReportedOwner} formatDate={formatDate} />}
          {view === 'admin' && <AdminView users={searchedUsers} boards={boards} loggedUser={loggedUser} onRoleChange={handleRoleChange} onCreateBoard={handleCreateBoard} onDeleteBoard={handleDeleteBoard} />}
          {view === 'creator' && <CreatorView users={searchedUsers} loggedUser={loggedUser} search={userSearch} setSearch={setUserSearch} formatDate={formatDate} onReset={async () => { await api('/api/creator/reset', json({})); await fetchForumData(); }} />}
          {view === 'support' && <TicketSupportView messages={db.supportMessages || []} replies={db.supportReplies || []} users={userMap} loggedUser={loggedUser} isSupport={isSupport} form={supportForm} setForm={setSupportForm} onSubmit={handleSupportSubmit} onStatus={handleSupportStatus} onReply={handleSupportReply} reply={supportReply} setReply={setSupportReply} attachment={supportAttachment} setAttachment={setSupportAttachment} uploadFile={uploadFile} selectedTicketId={selectedTicketId} setSelectedTicketId={setSelectedTicketId} formatDate={formatDate} />}
        </div>

        {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
        {sanctionDialog && <SanctionDialog sanction={sanctionDialog} onClose={() => setSanctionDialog(null)} onBan={handleBan} onMute={handleMute} />}
        {reportDraft && <ReportDialog draft={reportDraft} setDraft={setReportDraft} onClose={() => setReportDraft(null)} onSubmit={submitReport} />}
        {warningDraft && <WarningDialog draft={warningDraft} setDraft={setWarningDraft} onClose={() => setWarningDraft(null)} onSubmit={submitWarning} />}
      </main>
    </div>
  );
}

function NotificationBell({ notifications, onOpen }) {
  const unread = notifications.filter((notification) => !notification.readAt).length;
  return <details className="notification-menu"><summary className="ghost-btn"><Bell size={16} />{unread > 0 && <b>{unread}</b>}</summary><div className="notification-popover"><strong>Notificaciones</strong>{notifications.length ? notifications.slice(0, 8).map((notification) => <button key={notification.id} className={notification.readAt ? 'notification-item read' : 'notification-item'} onClick={() => onOpen(notification)}><span>{notification.message}</span><small>{new Date(notification.createdAt).toLocaleString('es-ES')}</small></button>) : <p className="presence-empty">No tienes notificaciones.</p>}</div></details>;
}

function SearchResults({ results, openProfile, setView }) {
  const hasResults = results.users.length || results.threads.length || results.posts.length;
  return <div className="search-results">{hasResults ? <>{results.users.map((user) => <button key={`user-${user.id}`} onClick={() => openProfile(user.id)}><small>Usuario</small><strong>{user.name}</strong><span>{user.username}</span></button>)}{results.threads.map((thread) => <button key={`thread-${thread.id}`} onClick={() => setView('forum', { boardId: thread.boardId })}><small>Publicación</small><strong>{thread.title}</strong><span>{thread.content.slice(0, 70)}</span></button>)}{results.posts.map((post) => <button key={`post-${post.id}`} onClick={() => setView('forum')}><small>Respuesta</small><strong>{post.content.slice(0, 90)}</strong></button>)}</> : <p>Sin resultados.</p>}</div>;
}


function ReportDialog({ draft, setDraft, onClose, onSubmit }) {
  return <div className="dialog-backdrop" role="presentation"><form className="app-dialog report-dialog" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="dialog-mark">!</div><p className="eyebrow">Moderación comunitaria</p><h2>Reportar contenido</h2><p>Explica brevemente por qué este contenido debería revisarse.</p><label className="sanction-label">Motivo<textarea autoFocus value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Describe el problema..." rows="5" /></label><div className="dialog-actions"><button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button><button type="submit" className="primary-btn">Enviar reporte</button></div></form></div>;
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


function WarningDialog({ draft, setDraft, onClose, onSubmit }) {
  return <div className="dialog-backdrop" role="presentation"><form className="app-dialog warning-dialog" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="dialog-mark">!</div><p className="eyebrow">Moderación</p><h2>Emitir advertencia</h2><p>La tercera advertencia suspende la cuenta durante 1 día automáticamente.</p><label className="sanction-label">Motivo<textarea autoFocus value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Explica el motivo..." rows="4" /></label><div className="dialog-actions"><button type="button" className="ghost-btn" onClick={onClose}>Cancelar</button><button type="submit" className="primary-btn">Emitir advertencia</button></div></form></div>;
}
function UsernameEditor({ value, onChange }) {
  return (
    <div className="panel-card username-editor">
      <p className="mini-label">Identidad pública</p>
      <label>Username único<input value={value} onChange={(event) => onChange(event.target.value)} placeholder="@tu_username" /><small>Guarda el perfil para aplicar el cambio.</small></label>
    </div>
  );
}

function LegacyCreatorView({ users, loggedUser, search, setSearch, formatDate, onReset }) {
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
                  <div><dt>ID público</dt><dd>{user.publicId || user.id}</dd></div>
                  <div><dt>ID interno</dt><dd>{user.id}</dd></div>
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

function LegacyTicketSupportView({ messages, replies, users, loggedUser, isSupport, form, setForm, onSubmit, onStatus, onReply, reply, setReply, selectedTicketId, setSelectedTicketId, formatDate }) {
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
