import { AlertTriangle, ArrowLeft, Home, ShieldAlert } from 'lucide-react';

export default function ErrorPage({ code = 404, onHome }) {
  const forbidden = code === 403;
  return (
    <main className="error-screen">
      <div className="error-orbit"><span>{forbidden ? <ShieldAlert size={28} /> : <AlertTriangle size={28} />}</span></div>
      <p className="eyebrow">ForumBonito · {forbidden ? 'Acceso restringido' : 'Ruta no encontrada'}</p>
      <h1>{code}</h1>
      <h2>{forbidden ? 'No puedes entrar aquí' : 'Esta página no existe'}</h2>
      <p>{forbidden ? 'Tu cuenta no tiene el rol necesario para consultar esta sección.' : 'La dirección puede haber cambiado o ya no está disponible.'}</p>
      <div className="error-actions">
        <button className="primary-btn" onClick={onHome}><Home size={16} />Ir al foro</button>
        <button className="ghost-btn" onClick={() => window.history.back()}><ArrowLeft size={16} />Volver</button>
      </div>
    </main>
  );
}
