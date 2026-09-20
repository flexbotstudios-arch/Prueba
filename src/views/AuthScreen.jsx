import { Brand } from '../components/Common';

export default function AuthScreen({ authView, setAuthView, loginForm, setLoginForm, loginErrors, setLoginErrors, registerForm, setRegisterForm, handleLogin, handleRegister }) {
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
