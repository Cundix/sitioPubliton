'use strict';
const $ = (id) => document.getElementById(id);
const reservation = $('reservation');
let passType = 'creador';
let currentReservation = null;
let trigger = null;
let activeStep = 0;
const form = $('reservation-form');
const steps = [form, $('review-step'), $('success-step')];
function setStep(index) {
  activeStep = index;
  $('cancel-step').hidden = true;
  $('pass-switcher').hidden = true;
  $('change-pass').setAttribute('aria-expanded', 'false');
  steps.forEach((step, i) => { step.hidden = i !== index; });
  $('step-label').textContent = ['01 / TUS DATOS', '02 / REVISAR', '03 / TU PASE'][index];
  $('reservation-title').innerHTML = ['Tu próxima idea<br>empieza acá.', 'Todo listo.<br>¿Confirmamos?', 'Nos vemos<br>creando.'][index];
  $('reservation-title').focus();
  reservation.scrollTop = 0;
}
function clearErrors() {
  ['full-name', 'email', 'team-name'].forEach(id => { $(id).removeAttribute('aria-invalid'); $(id + '-error').textContent = ''; });
  $('consent-error').textContent = '';
  $('demo-consent').removeAttribute('aria-invalid');
  $('form-errors').hidden = true;
}
function setPassType(type) {
  passType = type;
  $('team-fields').hidden = type !== 'equipo';
  $('team-name').required = type === 'equipo';
  $('selected-pass-name').textContent = type === 'equipo' ? 'Pase equipo · 4–5 integrantes' : 'Pase creador · individual';
  document.querySelectorAll('[data-switch-pass]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.switchPass === type)));
}
function openReservation(type, source) {
  setPassType(type);
  trigger = source;
  currentReservation = null;
  form.reset(); clearErrors();
  $('download-status').textContent = '';
  reservation.showModal(); setStep(0);
}
document.querySelectorAll('[data-reserve]').forEach(button => button.addEventListener('click', () => openReservation(button.dataset.reserve, button)));
function requestClose() {
  const hasData = ['full-name', 'email', 'team-name'].some(id => $(id).value.trim()) || $('creative-role').value || $('demo-consent').checked;
  if (activeStep === 2 || !hasData) { reservation.close(); return; }
  steps.forEach(step => { step.hidden = true; });
  $('step-label').textContent = 'CANCELAR RESERVA';
  $('reservation-title').textContent = 'Antes de salir.';
  $('cancel-step').hidden = false;
  $('cancel-title').focus();
}
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', requestClose));
reservation.addEventListener('cancel', event => { event.preventDefault(); requestClose(); });
reservation.addEventListener('close', () => { trigger?.focus(); });
$('form-cancel').addEventListener('click', requestClose);
$('keep-reservation').addEventListener('click', () => setStep(activeStep));
$('discard-reservation').addEventListener('click', () => { form.reset(); clearErrors(); currentReservation = null; reservation.close(); });
$('change-pass').addEventListener('click', () => {
  const open = $('pass-switcher').hidden;
  $('pass-switcher').hidden = !open;
  $('change-pass').setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('[data-switch-pass][aria-pressed="true"]').focus();
});
document.querySelectorAll('[data-switch-pass]').forEach(button => button.addEventListener('click', () => {
  setPassType(button.dataset.switchPass); clearErrors();
  $('pass-switcher').hidden = true;
  $('change-pass').setAttribute('aria-expanded', 'false');
  $('selected-pass-name').focus();
}));
function addRow(list, label, value) { const row = document.createElement('div'); const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); list.append(row); }
form.addEventListener('submit', event => {
  event.preventDefault(); clearErrors();
  const errors = [];
  function invalid(id, message) { $(id).setAttribute('aria-invalid', 'true'); $(id + '-error').textContent = message; errors.push({id, message}); }
  if ($('full-name').value.trim().length < 2) invalid('full-name', 'Ingresá tu nombre completo.');
  if (!$('email').value.trim() || !$('email').validity.valid || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('email').value.trim())) invalid('email', 'Ingresá un correo completo, por ejemplo alex@correo.com.');
  if (passType === 'equipo' && $('team-name').value.trim().length < 2) invalid('team-name', 'Ingresá el nombre del equipo.');
  if (!$('demo-consent').checked) { $('consent-error').textContent = 'Confirmá que entendés que es un pase de muestra.'; $('demo-consent').setAttribute('aria-invalid','true'); errors.push({id:'demo-consent', message:'Confirmá que es un pase de muestra.'}); }
  if (errors.length) {
    const summary = $('form-errors'); summary.replaceChildren();
    const text = document.createElement('p'); text.textContent = 'Revisá ' + (errors.length === 1 ? 'el dato señalado para continuar.' : 'los ' + errors.length + ' datos señalados para continuar.'); summary.append(text);
    const list = document.createElement('ul');
    errors.forEach(error => { const item=document.createElement('li');const link=document.createElement('a');link.href='#'+error.id;link.textContent=error.message;link.addEventListener('click',event=>{event.preventDefault();$(error.id).focus();});item.append(link);list.append(item); });summary.append(list);
    summary.hidden = false; summary.focus(); return;
  }
  currentReservation = { type: passType, name: $('full-name').value.trim(), email: $('email').value.trim(), role: $('creative-role').value, team: passType === 'equipo' ? $('team-name').value.trim() : '', size: passType === 'equipo' ? Number($('team-size').value) : 1 };
  const summary = $('review-data'); summary.replaceChildren();
  addRow(summary, 'Pase', passType === 'equipo' ? 'Pase equipo · ' + currentReservation.size + ' integrantes' : 'Pase creador · individual');
  addRow(summary, 'Nombre', currentReservation.name); addRow(summary, 'Correo', currentReservation.email);
  if (currentReservation.role) addRow(summary, 'Rol creativo', currentReservation.role);
  if (currentReservation.team) addRow(summary, 'Equipo', currentReservation.team);
  addRow(summary, 'Valor', 'Gratis · pase de muestra'); setStep(1);
});
$('edit-reservation').addEventListener('click', () => setStep(0));
$('confirm-reservation').addEventListener('click', () => {
  if (!currentReservation || currentReservation.code) return;
  const random = new Uint32Array(1); crypto.getRandomValues(random);
  currentReservation.code = 'DEMO-' + random[0].toString(36).toUpperCase().padStart(7, '0');
  $('ticket-type').textContent = currentReservation.type === 'equipo' ? 'PASE EQUIPO' : 'PASE CREADOR';
  $('ticket-name').textContent = currentReservation.name;
  $('ticket-team').textContent = currentReservation.team ? currentReservation.team + ' · ' + currentReservation.size + ' integrantes' : (currentReservation.role || 'Participación individual');
  $('ticket-code').textContent = currentReservation.code;
  setStep(2);
});
function escapeXml(value) { return String(value).replace(/[<>&"']/g, char => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' }[char])); }
$('download-ticket').addEventListener('click', () => {
  if (!currentReservation?.code) return;
  const r = currentReservation;
  const subtitle = r.team ? r.team + ' · ' + r.size + ' integrantes' : (r.role || 'Participación individual');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600"><rect width="900" height="600" rx="24" fill="#181d16"/><path d="M24 5h852" stroke="#ffc94a" stroke-width="10"/><g font-family="Arial,sans-serif" fill="#fff"><text x="55" y="86" font-size="40" font-weight="bold">PUBLITÓN</text><text x="55" y="142" font-size="18" fill="#ffc94a">${r.type === 'equipo' ? 'PASE EQUIPO' : 'PASE CREADOR'} · MUESTRA ACADÉMICA</text><text x="55" y="230" font-size="42" textLength="790" lengthAdjust="spacingAndGlyphs">${escapeXml(r.name)}</text><text x="55" y="286" font-size="24" fill="#c5cabf">${escapeXml(subtitle)}</text><path d="M55 365h790" stroke="#596151" stroke-dasharray="8 8"/><text x="55" y="420" font-size="20">CCR · BUENOS AIRES · 2026</text><text x="55" y="472" font-size="28" fill="#ffc94a">${escapeXml(r.code)}</text><text x="55" y="550" font-size="18" fill="#c5cabf">Pase académico de muestra. No válido para ingresar.</text></g></svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'Publiton-' + r.code + '.svg'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('download-status').textContent = 'Pase descargado en formato SVG. Podés abrirlo como imagen.';
});
const menu = document.querySelector('.menu-toggle'); menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); $('navigation').classList.toggle('is-open', open); });
document.querySelectorAll('#navigation a').forEach(a => a.addEventListener('click', () => { menu.setAttribute('aria-expanded', 'false'); $('navigation').classList.remove('is-open'); }));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.getAttribute('aria-expanded')==='true'){menu.setAttribute('aria-expanded','false');$('navigation').classList.remove('is-open');menu.focus();}});
const sponsor = $('sponsor-dialog'); $('sponsor-open').addEventListener('click', () => sponsor.showModal()); document.querySelectorAll('[data-close-sponsor]').forEach(b => b.addEventListener('click', () => sponsor.close()));

// Figma can open the matching functional form without repeating pass selection.
const linkedPass = new URLSearchParams(window.location.search).get('pase');
if (linkedPass === 'creador' || linkedPass === 'equipo') {
  openReservation(linkedPass, document.querySelector('[data-reserve="' + linkedPass + '"]'));
}
