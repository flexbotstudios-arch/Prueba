import { Brand } from '../components/Common';

export default function AuthScreen({ authView, setAuthView, loginForm, setLoginForm, loginErrors, setLoginErrors, registerForm, setRegisterForm, registerErrors, setRegisterErrors, handleLogin, handleRegister }) {
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
            <label className={loginErrors.identifier ? 'has-error' : ''}>Username o correo<input aria-invalid={Boolean(loginErrors.identifier)} value={loginForm.identifier} onChange={(event) => { setLoginForm({ ...loginForm, identifier: event.target.value }); setLoginErrors((current) => ({ ...current, identifier: '' })); }} placeholder="@tu_username" />{loginErrors.identifier && <span className="field-error" role="alert">{loginErrors.identifier}</span>}</label>
            <label className={loginErrors.password ? 'has-error' : ''}>Contraseña<input aria-invalid={Boolean(loginErrors.password)} type="password" value={loginForm.password} onChange={(event) => { setLoginForm({ ...loginForm, password: event.target.value }); setLoginErrors((current) => ({ ...current, password: '' })); }} />{loginErrors.password && <span className="field-error" role="alert">{loginErrors.password}</span>}</label>
            <button className="primary-btn">Entrar</button>
          </form>
        ) : (
          <form key="register" onSubmit={handleRegister} className="auth-form auth-form-register">
            <h2>Crear una cuenta</h2>
            <label className={registerErrors.name ? 'has-error' : ''}>Display name<input aria-invalid={Boolean(registerErrors.name)} value={registerForm.name} onChange={(event) => { setRegisterForm({ ...registerForm, name: event.target.value }); setRegisterErrors((current) => ({ ...current, name: '' })); }} />{registerErrors.name && <span className="field-error" role="alert">{registerErrors.name}</span>}</label>
            <label className={registerErrors.username ? 'has-error' : ''}>Username único<input aria-invalid={Boolean(registerErrors.username)} value={registerForm.username} onChange={(event) => { setRegisterForm({ ...registerForm, username: event.target.value }); setRegisterErrors((current) => ({ ...current, username: '' })); }} placeholder="@tu_username" />{registerErrors.username && <span className="field-error" role="alert">{registerErrors.username}</span>}</label>
            <label className={registerErrors.email ? 'has-error' : ''}>Correo electrónico<input aria-invalid={Boolean(registerErrors.email)} type="email" value={registerForm.email} onChange={(event) => { setRegisterForm({ ...registerForm, email: event.target.value }); setRegisterErrors((current) => ({ ...current, email: '' })); }} />{registerErrors.email && <span className="field-error" role="alert">{registerErrors.email}</span>}</label>
            <label className={registerErrors.password ? 'has-error' : ''}>Contraseña<input aria-invalid={Boolean(registerErrors.password)} type="password" value={registerForm.password} onChange={(event) => { setRegisterForm({ ...registerForm, password: event.target.value }); setRegisterErrors((current) => ({ ...current, password: '' })); }} />{registerErrors.password && <span className="field-error" role="alert">{registerErrors.password}</span>}</label>
            <button className="primary-btn">Registrarme</button>
          </form>
        )}
      </div>
    </div>
  );
}
