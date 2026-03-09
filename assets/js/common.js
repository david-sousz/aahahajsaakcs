window.NEKOTINA_API = localStorage.getItem('nekotina_api') || 'https://meristic-unironical-gail.ngrok-free.dev';
window.NEKOTINA_HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true'
};

async function apiRequest(payload, method = 'POST') {
  const options = { method, headers: method === 'GET' ? { 'ngrok-skip-browser-warning': 'true' } : window.NEKOTINA_HEADERS };
  if (method !== 'GET') options.body = JSON.stringify(payload || {});
  const response = await fetch(window.NEKOTINA_API, options);
  const text = await response.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    throw new Error('Resposta inválida do servidor.');
  }
}

async function apiGetGroups() {
  const response = await fetch(window.NEKOTINA_API, { headers: { 'ngrok-skip-browser-warning': 'true' } });
  return response.json();
}

function formatDateBR(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR');
}

function formatShortDateBR(value) {
  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function formatCurrencyBR(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDuration(ms) {
  const total = Math.max(0, Number(ms || 0));
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}min`;
  return `${minutes}min`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const temp = document.createElement('textarea');
  temp.value = text;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  temp.remove();
  return Promise.resolve();
}

function setButtonLoading(button, loading, loadingText = 'Carregando...') {
  if (!button) return;
  if (!button.dataset.originalText) button.dataset.originalText = button.innerHTML;
  button.disabled = loading;
  button.innerHTML = loading ? `<span class="inline-flex items-center gap-2"><span class="animate-spin rounded-full h-4 w-4 border-2 border-white/35 border-t-white"></span>${loadingText}</span>` : button.dataset.originalText;
}

function showToast(icon, title, text = '') {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2600,
    timerProgressBar: true,
    icon,
    title,
    text,
    background: '#101522',
    color: '#eef2ff'
  });
}

function requireUserSession() {
  const raw = localStorage.getItem('nekotina_session');
  if (!raw) {
    window.location.href = '/';
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('nekotina_session');
    window.location.href = '/';
    return null;
  }
}

function requireAdminSession() {
  if (!localStorage.getItem('nekotina_admin_session')) {
    window.location.href = '/admin/';
    return false;
  }
  return true;
}

function startCountdown(targetTimestamp, callback) {
  const tick = () => {
    const diff = Number(targetTimestamp) - Date.now();
    callback(diff);
  };
  tick();
  return window.setInterval(tick, 1000);
}

function diffLabel(diff) {
  if (diff <= 0) return 'Expirado';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${days}d ${hours}h ${minutes}min`;
}

function badgeByExpiration(timestamp) {
  const diff = Number(timestamp) - Date.now();
  if (diff <= 0) return '<span class="status-chip danger">Expirado</span>';
  if (diff < 7 * 86400000) return '<span class="status-chip warning">Vencendo</span>';
  return '<span class="status-chip success">Ativo</span>';
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
});
