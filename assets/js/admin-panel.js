let adminGroups = [];
let pendingOrders = [];
let activeTab = 'overview';

function adminMetrics() {
  const now = Date.now();
  const active = adminGroups.filter(group => Number(group.expira) > now).length;
  const expired = adminGroups.length - active;
  const paidPending = pendingOrders.filter(item => item.status_pagamento === 'approved').length;
  return { total: adminGroups.length, active, expired, pending: pendingOrders.length, paidPending };
}

async function loadAdminData() {
  const [groupsRes, pendingRes] = await Promise.all([
    apiRequest({ acao: 'admin_get_data' }),
    apiRequest({ acao: 'admin_get_pending' })
  ]);

  if (!groupsRes.sucesso) throw new Error(groupsRes.erro || 'Falha ao carregar grupos.');
  if (!pendingRes.sucesso) throw new Error(pendingRes.erro || 'Falha ao carregar pendências.');

  adminGroups = Array.isArray(groupsRes.grupos) ? groupsRes.grupos : [];
  pendingOrders = Array.isArray(pendingRes.pendentes) ? pendingRes.pendentes : [];
  renderAdmin();
}

function renderMetrics() {
  const metrics = adminMetrics();
  document.getElementById('metric-total').textContent = metrics.total;
  document.getElementById('metric-active').textContent = metrics.active;
  document.getElementById('metric-expired').textContent = metrics.expired;
  document.getElementById('metric-pending').textContent = metrics.pending;
  document.getElementById('metric-paid-pending').textContent = metrics.paidPending;
}

function renderOverview() {
  const metrics = adminMetrics();
  document.getElementById('overview-summary').innerHTML = `
    <div class="glass-panel p-6 lg:p-7 fade-up">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span class="brand-chip"><i data-lucide="sparkles"></i>Painel premium <strong>operacional</strong></span>
          <h2 class="section-title mt-4">Controle de grupos, pedidos pendentes e aprovações em uma única central.</h2>
          <p class="section-subtitle mt-3 max-w-3xl">Toda compra aprovada via PIX aparece em pendências. Depois da aprovação administrativa, o backend envia apenas o link e o tempo para <span class="kbd">lib\\novo-grupo.json</span>.</p>
        </div>
        <div class="glass-panel p-5 rounded-[24px] min-w-[280px]">
          <div class="metric-label">Compras aguardando ação</div>
          <div class="metric-value mt-3">${metrics.pending}</div>
          <div class="metric-note mt-3">${metrics.paidPending} pagamento(s) já confirmados pelo Mercado Pago.</div>
        </div>
      </div>
    </div>
  `;
}

function renderPendingList() {
  const wrapper = document.getElementById('pending-list');
  const search = document.getElementById('pending-search').value.trim().toLowerCase();
  const filtered = pendingOrders.filter(item => {
    const haystack = [item.nome, item.numero, item.link_grupo, item.payment_id, item.tempo].join(' ').toLowerCase();
    return haystack.includes(search);
  });

  if (!filtered.length) {
    wrapper.innerHTML = '<div class="empty-state glass-panel">Nenhuma compra pendente encontrada.</div>';
    return;
  }

  wrapper.innerHTML = filtered.map(item => `
    <article class="glass-panel p-6 fade-up">
      <div class="flex flex-col xl:flex-row gap-6 justify-between">
        <div class="space-y-4 flex-1">
          <div class="flex flex-wrap gap-2 items-center">
            <span class="status-chip ${item.status_pagamento === 'approved' ? 'success' : 'warning'}">${item.status_pagamento === 'approved' ? 'Pagamento aprovado' : 'Aguardando pagamento'}</span>
            <span class="soft-chip">${escapeHtml(item.tempo || 'Plano não informado')}</span>
            <span class="soft-chip">${formatCurrencyBR(item.valor_pago || item.valor)}</span>
          </div>
          <div>
            <h3 class="text-xl font-extrabold">${escapeHtml(item.nome || 'Sem nome')}</h3>
            <p class="text-slate-400 text-sm mt-1">Pedido ${escapeHtml(item.registro_id || '—')} · pagamento ${escapeHtml(item.payment_id || '—')}</p>
          </div>
          <div class="grid md:grid-cols-2 gap-4 text-sm">
            <div class="neo-card p-4">
              <div class="text-slate-400 text-xs uppercase tracking-[0.18em] font-bold">Contato</div>
              <div class="mt-2 font-bold break-all">${escapeHtml(item.numero || '—')}</div>
            </div>
            <div class="neo-card p-4">
              <div class="text-slate-400 text-xs uppercase tracking-[0.18em] font-bold">Tempo em ms</div>
              <div class="mt-2 font-bold break-all">${escapeHtml(item.tempo_ms || 0)}</div>
            </div>
          </div>
          <div class="neo-card p-4">
            <div class="text-slate-400 text-xs uppercase tracking-[0.18em] font-bold">Link do grupo</div>
            <div class="mt-2 break-all text-sm">${escapeHtml(item.link_grupo || '—')}</div>
          </div>
        </div>
        <div class="xl:w-[260px] flex xl:flex-col gap-3">
          <button class="btn-success w-full" data-action="approve" data-id="${escapeHtml(item.payment_id)}"><i data-lucide="check-circle-2"></i>Aprovar</button>
          <button class="btn-secondary w-full" data-action="copy-link" data-link="${escapeHtml(item.link_grupo || '')}"><i data-lucide="copy"></i>Copiar link</button>
          <button class="btn-danger w-full" data-action="delete" data-id="${escapeHtml(item.payment_id)}"><i data-lucide="trash-2"></i>Remover</button>
          <div class="glass-panel p-4 text-sm xl:mt-auto">
            <div class="text-slate-400 text-xs uppercase tracking-[0.18em] font-bold">Criado em</div>
            <div class="mt-2 font-semibold">${escapeHtml(item.criado_em || '—')}</div>
            <div class="text-slate-500 mt-3 text-xs">Depois da aprovação, a compra sai de pendentes e segue para a fila do bot.</div>
          </div>
        </div>
      </div>
    </article>
  `).join('');

  wrapper.querySelectorAll('[data-action="approve"]').forEach(button => {
    button.addEventListener('click', () => approvePending(button.dataset.id));
  });
  wrapper.querySelectorAll('[data-action="delete"]').forEach(button => {
    button.addEventListener('click', () => removePending(button.dataset.id));
  });
  wrapper.querySelectorAll('[data-action="copy-link"]').forEach(button => {
    button.addEventListener('click', async () => {
      await copyText(button.dataset.link || '');
      showToast('success', 'Link copiado.');
    });
  });
}

function renderGroupsTable() {
  const tbody = document.getElementById('group-table-body');
  const query = document.getElementById('group-search').value.trim().toLowerCase();
  const filtered = adminGroups.filter(group => {
    const text = [group.id, group.nome, group.plano, group.senha].join(' ').toLowerCase();
    return text.includes(query);
  });

  document.getElementById('group-count').textContent = filtered.length;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhum grupo encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(group => `
    <tr>
      <td><input type="checkbox" class="group-check" value="${escapeHtml(group.id)}"></td>
      <td>
        <div class="font-bold text-white">${escapeHtml(group.nome || 'Sem nome')}</div>
        <div class="text-xs text-slate-400 mt-1 font-mono break-all">${escapeHtml(group.id)}</div>
      </td>
      <td><span class="soft-chip">${escapeHtml(group.senha || 'nekotina')}</span></td>
      <td>${badgeByExpiration(group.expira)}</td>
      <td>${formatShortDateBR(group.expira)}</td>
      <td><span class="soft-chip">${escapeHtml(group.plano || 'Manual')}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn-secondary !py-3 !px-4" data-edit-group="${escapeHtml(group.id)}"><i data-lucide="pencil"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-edit-group]').forEach(button => {
    button.addEventListener('click', () => editGroup(button.dataset.editGroup));
  });
}

function renderAdmin() {
  renderMetrics();
  renderOverview();
  renderPendingList();
  renderGroupsTable();
  document.querySelectorAll('[data-admin-view]').forEach(section => {
    section.classList.toggle('hidden', section.dataset.adminView !== activeTab);
  });
  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.adminTab === activeTab);
  });
  if (window.lucide) lucide.createIcons();
}

async function approvePending(paymentId) {
  const confirm = await Swal.fire({
    icon: 'question',
    title: 'Aprovar compra pendente?',
    text: 'O item será removido de pendentes e enviado para lib\\novo-grupo.json.',
    background: '#0f1422',
    color: '#eef2ff',
    showCancelButton: true,
    confirmButtonColor: '#22c55e',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Aprovar'
  });
  if (!confirm.isConfirmed) return;

  const result = await apiRequest({ acao: 'admin_approve_pending', payment_id: paymentId });
  if (!result.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Falha ao aprovar', text: result.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Compra aprovada com sucesso.');
  loadAdminData();
}

async function removePending(paymentId) {
  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'Remover pendência?',
    text: 'Essa ação exclui o registro da fila administrativa.',
    background: '#0f1422',
    color: '#eef2ff',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Excluir'
  });
  if (!confirm.isConfirmed) return;

  const result = await apiRequest({ acao: 'admin_delete_pending', payment_id: paymentId });
  if (!result.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Falha ao remover', text: result.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Pendência removida.');
  loadAdminData();
}

async function addGroup() {
  const result = await Swal.fire({
    title: 'Novo grupo',
    background: '#0f1422',
    color: '#eef2ff',
    confirmButtonColor: '#8b5cf6',
    html: `
      <div class="space-y-3 text-left">
        <div>
          <label class="label-top">ID do grupo</label>
          <div class="input-shell"><input id="new-group-id" placeholder="1203...@g.us"></div>
        </div>
        <div>
          <label class="label-top">Nome do grupo</label>
          <div class="input-shell"><input id="new-group-name" placeholder="Nome do grupo"></div>
        </div>
        <div>
          <label class="label-top">Senha</label>
          <div class="input-shell"><input id="new-group-pass" value="nekotina"></div>
        </div>
        <div>
          <label class="label-top">Dias de acesso</label>
          <div class="input-shell"><input id="new-group-days" type="number" value="30"></div>
        </div>
      </div>
    `,
    preConfirm: () => {
      const id = document.getElementById('new-group-id').value.trim();
      const nome = document.getElementById('new-group-name').value.trim();
      const senha = document.getElementById('new-group-pass').value.trim() || 'nekotina';
      const dias = Number(document.getElementById('new-group-days').value || 0);
      if (!id || !dias) {
        Swal.showValidationMessage('Preencha o ID e a quantidade de dias.');
        return false;
      }
      return { id, nome, senha, expira: Date.now() + dias * 86400000 };
    }
  });

  if (!result.value) return;
  const save = await apiRequest({ acao: 'admin_add_group', grupo: result.value });
  if (!save.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Não foi possível criar o grupo', text: save.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Grupo criado com sucesso.');
  loadAdminData();
}

async function editGroup(groupId) {
  const group = adminGroups.find(item => item.id === groupId);
  if (!group) return;

  const dateValue = new Date(Number(group.expira)).toISOString().slice(0, 10);
  const result = await Swal.fire({
    title: 'Editar grupo',
    background: '#0f1422',
    color: '#eef2ff',
    confirmButtonColor: '#8b5cf6',
    html: `
      <div class="space-y-3 text-left">
        <div>
          <label class="label-top">Nome</label>
          <div class="input-shell"><input id="edit-group-name" value="${escapeHtml(group.nome || '')}"></div>
        </div>
        <div>
          <label class="label-top">Senha</label>
          <div class="input-shell"><input id="edit-group-pass" value="${escapeHtml(group.senha || 'nekotina')}"></div>
        </div>
        <div>
          <label class="label-top">Plano</label>
          <div class="input-shell"><input id="edit-group-plan" value="${escapeHtml(group.plano || 'Manual')}"></div>
        </div>
        <div>
          <label class="label-top">Validade</label>
          <div class="input-shell"><input id="edit-group-exp" type="date" value="${dateValue}"></div>
        </div>
      </div>
    `,
    preConfirm: () => {
      const nome = document.getElementById('edit-group-name').value.trim();
      const senha = document.getElementById('edit-group-pass').value.trim() || 'nekotina';
      const plano = document.getElementById('edit-group-plan').value.trim() || 'Manual';
      const expira = new Date(`${document.getElementById('edit-group-exp').value}T12:00:00`).getTime();
      if (!expira) {
        Swal.showValidationMessage('Escolha uma validade válida.');
        return false;
      }
      return { id: group.id, nome, senha, plano, expira };
    }
  });

  if (!result.value) return;
  const save = await apiRequest({ acao: 'admin_save_group', grupo: result.value });
  if (!save.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Não foi possível salvar', text: save.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Grupo atualizado com sucesso.');
  loadAdminData();
}

async function deleteSelectedGroups() {
  const ids = Array.from(document.querySelectorAll('.group-check:checked')).map(input => input.value);
  if (!ids.length) return showToast('warning', 'Selecione ao menos um grupo.');
  const confirm = await Swal.fire({
    icon: 'warning',
    title: `Excluir ${ids.length} grupo(s)?`,
    text: 'Essa ação remove os grupos selecionados do painel.',
    background: '#0f1422',
    color: '#eef2ff',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#334155',
    confirmButtonText: 'Excluir'
  });
  if (!confirm.isConfirmed) return;
  const result = await apiRequest({ acao: 'admin_delete_groups', ids });
  if (!result.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Falha ao excluir', text: result.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Grupos removidos.');
  loadAdminData();
}

function setAdminTab(tab) {
  activeTab = tab;
  renderAdmin();
}

function logoutAdmin() {
  localStorage.removeItem('nekotina_admin_session');
  window.location.href = '/admin/';
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!requireAdminSession()) return;

  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.addEventListener('click', () => setAdminTab(button.dataset.adminTab));
  });

  document.getElementById('refresh-admin').addEventListener('click', loadAdminData);
  document.getElementById('add-group-button').addEventListener('click', addGroup);
  document.getElementById('delete-group-button').addEventListener('click', deleteSelectedGroups);
  document.getElementById('pending-search').addEventListener('input', renderPendingList);
  document.getElementById('group-search').addEventListener('input', renderGroupsTable);
  document.getElementById('logout-admin').addEventListener('click', logoutAdmin);
  document.getElementById('group-check-all').addEventListener('change', event => {
    document.querySelectorAll('.group-check').forEach(input => {
      input.checked = event.target.checked;
    });
  });

  try {
    await loadAdminData();
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Erro ao carregar painel', text: error.message || 'Não foi possível obter os dados administrativos.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
});
