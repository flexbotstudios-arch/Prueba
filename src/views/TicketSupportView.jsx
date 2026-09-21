import { ArrowUp, Paperclip } from 'lucide-react';
import { AttachmentPicker } from '../components/Common';

const submitOnEnter = (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
};

const growComposer = (event) => {
  event.currentTarget.style.height = 'auto';
  event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 220)}px`;
};

export default function TicketSupportView({ messages, replies, users, loggedUser, isSupport, form, setForm, onSubmit, onStatus, onReply, reply, setReply, attachment, setAttachment, uploadFile, selectedTicketId, setSelectedTicketId, formatDate }) {
  const tickets = isSupport ? messages : messages.filter((message) => message.userId === loggedUser.id);
  const selectedTicket = selectedTicketId ? tickets.find((ticket) => ticket.id === selectedTicketId) || null : null;
  const ticketReplies = selectedTicket ? replies.filter((item) => item.ticketId === selectedTicket.id) : [];
  return <section className="page-view support-page"><div className="page-heading"><div><p className="eyebrow">Ayuda privada</p><h2>{isSupport ? 'Bandeja de tickets' : 'Mis tickets'}</h2><small>{isSupport ? 'Responde y actualiza el estado.' : 'Crea una conversación privada.'}</small></div><span className="role-badge role-support">Soporte</span></div><div className="ticket-layout"><aside className="ticket-sidebar"><div className="ticket-sidebar-head"><strong>Conversaciones</strong><span>{tickets.length}</span></div>{tickets.map((ticket) => <button key={ticket.id} className={`ticket-item ${selectedTicket?.id === ticket.id ? 'active' : ''}`} onClick={() => setSelectedTicketId(ticket.id)}><strong>{ticket.subject}</strong><small>{ticket.status} · {formatDate(ticket.updatedAt)}</small></button>)}{!tickets.length && <p className="empty-state">Todavía no tienes tickets.</p>}</aside><div className="ticket-conversation">{selectedTicket ? <><header className="ticket-header"><div><p className="eyebrow">Ticket #{selectedTicket.id}</p><h3>{selectedTicket.subject}</h3><small>Creado por {users[selectedTicket.userId]?.name || 'Usuario'} · {formatDate(selectedTicket.createdAt)}</small></div>{isSupport && <select value={selectedTicket.status} onChange={(event) => onStatus(selectedTicket, event.target.value)}><option value="open">Abierto</option><option value="in_progress">En curso</option><option value="pending">En espera</option><option value="resolved">Resuelto</option><option value="closed">Cerrado</option></select>}</header><div className="ticket-messages"><TicketMessage item={selectedTicket} users={users} loggedUser={loggedUser} formatDate={formatDate} />{ticketReplies.map((item) => <TicketMessage key={item.id} item={item} users={users} loggedUser={loggedUser} formatDate={formatDate} />)}</div><form className="ticket-reply composer-box" onSubmit={onReply}><textarea value={reply} onChange={(event) => setReply(event.target.value)} onInput={growComposer} onKeyDown={submitOnEnter} placeholder="Escribe tu respuesta..." rows="1" /><AttachmentPicker value={attachment} onChange={setAttachment} uploadFile={uploadFile} /><button type="submit" className="send-icon-btn" title="Enviar respuesta" aria-label="Enviar respuesta"><ArrowUp size={18} /></button></form></> : <div className="ticket-empty"><Paperclip size={28} /><h3>Selecciona un ticket</h3><p>Elige una conversación para leerla y responder.</p></div>}</div></div>{!isSupport && <form className="panel-card support-form" onSubmit={onSubmit}><p className="mini-label">Nuevo ticket</p><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Asunto" /><textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="Describe lo que necesitas..." rows="4" /><button className="primary-btn">Enviar mensaje</button></form>}</section>;
}

function TicketMessage({ item, users, loggedUser, formatDate }) {
  return <div className={`ticket-message ${item.userId === loggedUser.id ? 'mine' : ''}`}><strong>{users[item.userId]?.name || 'Usuario'}</strong><small>{formatDate(item.createdAt)}</small>{item.content && <p>{item.content}</p>}{item.attachmentUrl && (item.attachmentType || '').startsWith('image/') ? <img className="ticket-attachment-image" src={item.attachmentUrl} alt={item.attachmentName || 'Imagen adjunta'} /> : item.attachmentUrl && <a className="attachment-link" href={item.attachmentUrl} target="_blank" rel="noreferrer"><Paperclip size={15} /><span>{item.attachmentName || 'Archivo adjunto'}</span></a>}</div>;
}
