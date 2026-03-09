const sessionUser = requireUserSession();
let dashboardData = null;
let countdownHandle = null;

const featureCatalog = [
  { key: 'antilink', icon: 'shield-ban', title: 'Anti Link', description: 'Bloqueia links não autorizados dentro do grupo.' },
  { key: 'antiporno', icon: 'scan-eye', title: 'Anti Pornô', description: 'Mantém o ambiente protegido contra mídia sensível.' },
  { key: 'antifake', icon: 'user-x', title: 'Anti Fake', description: 'Aumenta o filtro para perfis suspeitos.' },
  { key: 'transcrever', icon: 'mic', title: 'Transcrever', description: 'Converte áudios em texto para facilitar leitura.' },
  { key: 'autohorarios', icon: 'clock-3', title: 'Auto Horários', description: 'Gerencia janela automática de mensagens do grupo.' },
  { key: 'antiflood', icon: 'shield-ellipsis', title: 'Anti Flood', description: 'Controla spam repetitivo com regras configuráveis.' },
  { key: 'open_close', icon: 'door-open', title: 'Abrir / Fechar', description: 'Programa janelas de abertura e fechamento do grupo.' },
  { key: 'welcome', icon: 'party-popper', title: 'Boas-vindas', description: 'Recepção personalizada com texto, botões e imagem.' }
];

const mediaCatalog = [
  { key: 'image', title: 'Imagem', icon: 'image' },
  { key: 'video', title: 'Vídeo', icon: 'video' },
  { key: 'audio', title: 'Áudio', icon: 'music-4' },
  { key: 'sticker', title: 'Sticker', icon: 'sticker' },
  { key: 'document', title: 'Documento', icon: 'file-text' }
];

async function loadDashboard() {
  const [configRes, platformRes] = await Promise.all([
    apiRequest({ acao: 'get_config', id: sessionUser.id }),
    apiRequest({ acao: 'get_platform_message', id: sessionUser.id })
  ]);

  if (!configRes.sucesso) throw new Error(configRes.erro || 'Falha ao carregar as configurações.');
  dashboardData = {
    ...configRes,
    platformMessage: platformRes?.sucesso ? platformRes.mensagem || '' : ''
  };
  renderDashboard();
}

function renderHero() {
  const statusClass = Number(dashboardData.expira) > Date.now() ? 'success' : 'danger';
  document.getElementById('group-name').textContent = dashboardData.nome || 'Grupo sem nome';
  document.getElementById('group-id').textContent = sessionUser.id;
  document.getElementById('group-exp-date').textContent = formatDateBR(dashboardData.expira);
  document.getElementById('group-exp-badge').className = `status-chip ${statusClass}`;
  document.getElementById('group-exp-badge').textContent = Number(dashboardData.expira) > Date.now() ? 'Plano ativo' : 'Plano expirado';

  if (countdownHandle) clearInterval(countdownHandle);
  countdownHandle = startCountdown(dashboardData.expira, diff => {
    document.getElementById('group-countdown').textContent = diffLabel(diff);
  });
}

function getModerationActionValue(featureKey) {
  return dashboardData.configs?.banConf?.[featureKey] || 'warn';
}

function getModerationActionLabel(featureKey) {
  return getModerationActionValue(featureKey) === 'ban' ? 'Deletar e remover' : 'Só deletar';
}

function getModerationActionTitle(featureKey) {
  return featureKey === 'antiporno' ? 'Ação ao detectar mídia sensível' : 'Ação ao detectar link';
}

function renderModerationInlineControls(featureKey) {
  const currentAction = getModerationActionValue(featureKey);
  return `
    <div class="inline-setting-panel mt-4">
      <div class="inline-setting-label">${getModerationActionTitle(featureKey)}</div>
      <div class="inline-setting-group">
        <button type="button" class="inline-setting-option ${currentAction === 'warn' ? 'active' : ''}" data-moderation-inline="${featureKey}:warn">
          <span class="inline-setting-title">Só deletar mensagem</span>
          <span class="inline-setting-desc">Remove apenas a mensagem detectada pelo módulo.</span>
        </button>
        <button type="button" class="inline-setting-option ${currentAction === 'ban' ? 'active' : ''}" data-moderation-inline="${featureKey}:ban">
          <span class="inline-setting-title">Deletar e remover</span>
          <span class="inline-setting-desc">Apaga a mensagem e remove o usuário do grupo.</span>
        </button>
      </div>
    </div>
  `;
}

function renderFeatureGrid() {
  const wrapper = document.getElementById('feature-grid');
  wrapper.innerHTML = featureCatalog.map(feature => `
    <article class="glass-panel p-5 shine">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="card-icon"><i data-lucide="${feature.icon}"></i></div>
          <h3 class="text-lg font-extrabold mt-4">${feature.title}</h3>
          <p class="text-sm text-slate-400 mt-2">${feature.description}</p>
          ${['antilink', 'antiporno'].includes(feature.key) ? renderModerationInlineControls(feature.key) : ''}
        </div>
        <label class="switch">
          <input type="checkbox" data-feature-toggle="${feature.key}" ${dashboardData.status?.[feature.key] ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>
      <div class="divider-soft my-4"></div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-slate-400">Status atual</span>
        <div class="flex items-center gap-2 flex-wrap justify-end">
          ${dashboardData.status?.[feature.key] ? '<span class="status-chip success">Ativo</span>' : '<span class="status-chip warning">Desativado</span>'}
          ${['antilink', 'antiporno'].includes(feature.key) ? `<span class="soft-chip">${getModerationActionLabel(feature.key)}</span>` : ''}
          ${['antilink', 'antiporno', 'welcome', 'antiflood', 'open_close'].includes(feature.key) ? `<button class="btn-secondary !py-3 !px-4" data-config-button="${feature.key}" title="Configurar ${feature.title}"><i data-lucide="sliders-horizontal"></i></button>` : ''}
        </div>
      </div>
    </article>
  `).join('');

  wrapper.querySelectorAll('[data-feature-toggle]').forEach(input => {
    input.addEventListener('change', () => toggleFeature(input.dataset.featureToggle, input.checked));
  });
  wrapper.querySelectorAll('[data-config-button]').forEach(button => {
    button.addEventListener('click', () => openConfigModal(button.dataset.configButton));
  });
  wrapper.querySelectorAll('[data-moderation-inline]').forEach(button => {
    button.addEventListener('click', () => {
      const [featureKey, act] = button.dataset.moderationInline.split(':');
      saveModerationAction(featureKey, act);
    });
  });
}

function renderAntimedia() {
  const wrapper = document.getElementById('antimedia-grid');
  wrapper.innerHTML = mediaCatalog.map(item => `
    <article class="neo-card p-5 flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="card-icon"><i data-lucide="${item.icon}"></i></div>
        <div>
          <div class="font-extrabold">${item.title}</div>
          <div class="text-sm text-slate-400">Controle de mídia por tipo.</div>
        </div>
      </div>
      <label class="switch">
        <input type="checkbox" data-media-toggle="${item.key}" ${dashboardData.antimedia?.[item.key] ? 'checked' : ''}>
        <span class="switch-slider"></span>
      </label>
    </article>
  `).join('');

  wrapper.querySelectorAll('[data-media-toggle]').forEach(input => {
    input.addEventListener('change', () => toggleAntiMedia(input.dataset.mediaToggle, input.checked));
  });
}

function renderAutoMessages() {
  const wrapper = document.getElementById('auto-message-list');
  const list = Array.isArray(dashboardData.autoMsgs) ? dashboardData.autoMsgs : [];
  if (!list.length) {
    wrapper.innerHTML = '<div class="empty-state glass-panel">Nenhuma automensagem configurada ainda.</div>';
    return;
  }

  wrapper.innerHTML = list.map((message, index) => `
    <article class="glass-panel p-5">
      <div class="flex flex-col xl:flex-row gap-5 justify-between">
        <div class="flex-1">
          <div class="flex gap-2 flex-wrap">
            ${message.mencionarTodos ? '<span class="status-chip primary">Menciona todos</span>' : ''}
            ${message.fixar ? '<span class="status-chip warning">Fixar</span>' : ''}
            <span class="soft-chip">${escapeHtml(message.tempo)} min</span>
          </div>
          <div class="text-white/95 font-semibold leading-7 mt-4 whitespace-pre-wrap">${escapeHtml(message.texto || '')}</div>
        </div>
        <div class="xl:w-[220px] space-y-3">
          ${message.imagemPreview ? `<img src="${message.imagemPreview}" alt="Prévia" class="w-full h-32 object-cover rounded-2xl border border-white/10">` : '<div class="h-32 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-slate-500">Sem mídia</div>'}
          <button class="btn-danger w-full" data-delete-msg="${index}"><i data-lucide="trash-2"></i>Excluir</button>
        </div>
      </div>
    </article>
  `).join('');

  wrapper.querySelectorAll('[data-delete-msg]').forEach(button => {
    button.addEventListener('click', () => deleteAutoMessage(Number(button.dataset.deleteMsg)));
  });
}

function renderPlatformMessage() {
  document.getElementById('platform-message').value = dashboardData.platformMessage || '';
}

async function saveModerationAction(featureKey, act) {
  const labels = {
    antilink: 'Anti link',
    antiporno: 'Anti pornô'
  };
  try {
    const result = await apiRequest({ acao: 'save_ban_action', id: sessionUser.id, type: featureKey, act });
    if (!result.sucesso) throw new Error(result.erro || 'Não foi possível salvar a ação do módulo.');
    showToast('success', `${labels[featureKey] || 'Módulo'} atualizado`, act === 'ban' ? 'Agora o bot deleta a mensagem e remove o usuário.' : 'Agora o bot apenas deleta a mensagem.');
    await loadDashboard();
  } catch (error) {
    showToast('error', 'Falha ao salvar', error.message || 'Tente novamente.');
  }
}

async function toggleFeature(feature, state) {
  try {
    const result = await apiRequest({ acao: 'toggle', id: sessionUser.id, funcao: feature, estado: state ? 1 : 0 });
    if (!result.sucesso) throw new Error(result.erro || 'Não foi possível alterar o status.');
    showToast('success', 'Status atualizado', `${feature} ${state ? 'ativado' : 'desativado'}.`);
    await loadDashboard();
  } catch (error) {
    showToast('error', 'Falha ao atualizar', error.message || 'Tente novamente.');
    await loadDashboard();
  }
}

async function toggleAntiMedia(type, state) {
  try {
    const result = await apiRequest({ acao: 'toggle_antimedia', id: sessionUser.id, tipo: type, estado: state ? 1 : 0 });
    if (!result.sucesso) throw new Error(result.erro || 'Não foi possível alterar o tipo de mídia.');
    showToast('success', 'Anti mídia atualizado');
    await loadDashboard();
  } catch (error) {
    showToast('error', 'Falha ao atualizar', error.message || 'Tente novamente.');
    await loadDashboard();
  }
}

async function openConfigModal(type) {
  if (['antilink', 'antiporno'].includes(type)) {
    const currentAction = getModerationActionValue(type);
    const titleMap = { antilink: 'Configurar anti link', antiporno: 'Configurar anti pornô' };
    const descMap = {
      antilink: 'Escolha se o bot deve apenas deletar a mensagem com link ou também remover o usuário do grupo.',
      antiporno: 'Escolha se o bot deve apenas deletar a mensagem com mídia sensível ou também remover o usuário do grupo.'
    };
    const labelMap = { antilink: 'Ação ao detectar link', antiporno: 'Ação ao detectar mídia sensível' };
    const modal = await Swal.fire({
      title: titleMap[type],
      background: '#0f1422',
      color: '#eef2ff',
      confirmButtonColor: '#8b5cf6',
      html: `
        <div class="space-y-3 text-left">
          <div>
            <label class="label-top">${labelMap[type]}</label>
            <div class="select-shell">
              <select id="moderation-action">
                <option value="warn" ${currentAction === 'warn' ? 'selected' : ''}>Só deletar a mensagem</option>
                <option value="ban" ${currentAction === 'ban' ? 'selected' : ''}>Deletar e remover usuário</option>
              </select>
            </div>
          </div>
          <div class="text-sm text-slate-400 leading-6">
            ${descMap[type]}
          </div>
        </div>
      `,
      preConfirm: () => ({
        type,
        act: document.getElementById('moderation-action').value
      })
    });

    if (modal.value) {
      await saveModerationAction(modal.value.type, modal.value.act);
    }
    return;
  }

  if (type === 'antiflood') {
    const cfg = dashboardData.configs?.antiflood || { limit: 5, action: 'ban' };
    const modal = await Swal.fire({
      title: 'Configurar anti flood',
      background: '#0f1422',
      color: '#eef2ff',
      confirmButtonColor: '#8b5cf6',
      html: `
        <div class="space-y-3 text-left">
          <div>
            <label class="label-top">Limite</label>
            <div class="input-shell"><input id="af-limit" type="number" value="${cfg.limit || 5}"></div>
          </div>
          <div>
            <label class="label-top">Ação</label>
            <div class="select-shell">
              <select id="af-action">
                <option value="ban" ${cfg.action === 'ban' ? 'selected' : ''}>Banir</option>
                <option value="warn" ${cfg.action === 'warn' ? 'selected' : ''}>Avisar</option>
              </select>
            </div>
          </div>
        </div>
      `,
      preConfirm: () => ({
        limit: Number(document.getElementById('af-limit').value || 5),
        action: document.getElementById('af-action').value,
        types: { text: true }
      })
    });
    if (modal.value) {
      await apiRequest({ acao: 'save_config_antiflood', id: sessionUser.id, ...modal.value });
      showToast('success', 'Anti flood salvo.');
      await loadDashboard();
    }
    return;
  }

  if (type === 'open_close') {
    const cfg = dashboardData.configs?.open_close || { abrir: '08:00', fechar: '22:00' };
    const modal = await Swal.fire({
      title: 'Horários de abertura',
      background: '#0f1422',
      color: '#eef2ff',
      confirmButtonColor: '#8b5cf6',
      html: `
        <div class="space-y-3 text-left">
          <div>
            <label class="label-top">Abrir às</label>
            <div class="input-shell"><input id="oc-open" type="time" value="${cfg.abrir || '08:00'}"></div>
          </div>
          <div>
            <label class="label-top">Fechar às</label>
            <div class="input-shell"><input id="oc-close" type="time" value="${cfg.fechar || '22:00'}"></div>
          </div>
        </div>
      `,
      preConfirm: () => ({
        abrir: document.getElementById('oc-open').value,
        fechar: document.getElementById('oc-close').value
      })
    });
    if (modal.value) {
      await apiRequest({ acao: 'save_open_close', id: sessionUser.id, ...modal.value });
      showToast('success', 'Horários salvos.');
      await loadDashboard();
    }
    return;
  }

  if (type === 'welcome') {
    const cfg = dashboardData.configs?.welcome || {};
    const modal = await Swal.fire({
      title: 'Boas-vindas premium',
      background: '#0f1422',
      color: '#eef2ff',
      confirmButtonColor: '#8b5cf6',
      width: 720,
      html: `
        <div class="space-y-3 text-left">
          <div>
            <label class="label-top">Texto</label>
            <div class="textarea-shell"><textarea id="welcome-text" rows="5">${escapeHtml(cfg.texto || '')}</textarea></div>
          </div>
          <div class="grid md:grid-cols-2 gap-3">
            <label class="soft-chip justify-start cursor-pointer"><input id="welcome-btn-link" type="checkbox" ${cfg.btnLink ? 'checked' : ''}> Botão de link</label>
            <label class="soft-chip justify-start cursor-pointer"><input id="welcome-btn-copy" type="checkbox" ${cfg.btnCopy ? 'checked' : ''}> Botão copiar</label>
          </div>
          <div>
            <label class="label-top">URL do botão</label>
            <div class="input-shell"><input id="welcome-link" value="${escapeHtml(cfg.link || '')}" placeholder="https://..."></div>
          </div>
          <div>
            <label class="label-top">Imagem personalizada</label>
            <div class="input-shell"><input id="welcome-image" type="file" accept="image/*"></div>
          </div>
        </div>
      `,
      preConfirm: () => {
        const file = document.getElementById('welcome-image').files[0];
        const base = {
          texto: document.getElementById('welcome-text').value,
          link_url: document.getElementById('welcome-link').value,
          show_button_link: document.getElementById('welcome-btn-link').checked,
          show_button_copy: document.getElementById('welcome-btn-copy').checked,
          imagem: null
        };
        if (!file) return base;
        return new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = event => resolve({ ...base, imagem: event.target.result });
          reader.readAsDataURL(file);
        });
      }
    });
    if (modal.value) {
      await apiRequest({ acao: 'save_welcome_full', id: sessionUser.id, ...modal.value });
      showToast('success', 'Configuração de boas-vindas salva.');
      await loadDashboard();
    }
  }
}

async function savePlatformMessage() {
  const button = document.getElementById('save-platform-button');
  const mensagem = document.getElementById('platform-message').value;
  setButtonLoading(button, true, 'Salvando...');
  try {
    const result = await apiRequest({ acao: 'save_platform_message', id: sessionUser.id, mensagem });
    if (!result.sucesso) throw new Error(result.erro || 'Não foi possível salvar a mensagem.');
    showToast('success', 'Mensagem da plataforma salva.');
  } catch (error) {
    showToast('error', 'Falha ao salvar', error.message || 'Tente novamente.');
  } finally {
    setButtonLoading(button, false);
  }
}

async function copyPlatformMessage() {
  await copyText(document.getElementById('platform-message').value || '');
  showToast('success', 'Texto copiado.');
}

async function newAutoMessage() {
  const modal = await Swal.fire({
    title: 'Nova automensagem',
    background: '#0f1422',
    color: '#eef2ff',
    confirmButtonColor: '#8b5cf6',
    width: 760,
    html: `
      <div class="space-y-3 text-left">
        <div>
          <label class="label-top">Mídia opcional</label>
          <div class="input-shell"><input id="am-file" type="file" accept="image/*"></div>
        </div>
        <div>
          <label class="label-top">Texto</label>
          <div class="textarea-shell"><textarea id="am-text" rows="6" placeholder="Escreva a mensagem automática..."></textarea></div>
        </div>
        <div class="grid md:grid-cols-3 gap-3">
          <div>
            <label class="label-top">Intervalo (min)</label>
            <div class="input-shell"><input id="am-time" type="number" value="30"></div>
          </div>
          <label class="soft-chip justify-start cursor-pointer"><input id="am-all" type="checkbox" checked> Marcar todos</label>
          <label class="soft-chip justify-start cursor-pointer"><input id="am-pin" type="checkbox"> Fixar mensagem</label>
        </div>
      </div>
    `,
    preConfirm: () => {
      const file = document.getElementById('am-file').files[0];
      const payload = {
        texto: document.getElementById('am-text').value,
        tempo: document.getElementById('am-time').value,
        mencionarTodos: document.getElementById('am-all').checked,
        fixar: document.getElementById('am-pin').checked,
        imagem: null
      };
      if (!payload.texto.trim()) {
        Swal.showValidationMessage('Digite o texto da automensagem.');
        return false;
      }
      if (!file) return payload;
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = event => resolve({ ...payload, imagem: event.target.result });
        reader.readAsDataURL(file);
      });
    }
  });
  if (!modal.value) return;
  const result = await apiRequest({ acao: 'add_automsg', id: sessionUser.id, msg: modal.value });
  if (!result.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Não foi possível salvar', text: result.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Automensagem criada.');
  await loadDashboard();
}

async function deleteAutoMessage(index) {
  const confirm = await Swal.fire({
    icon: 'warning',
    title: 'Excluir automensagem?',
    background: '#0f1422',
    color: '#eef2ff',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#334155'
  });
  if (!confirm.isConfirmed) return;
  const result = await apiRequest({ acao: 'del_automsg', id: sessionUser.id, index });
  if (!result.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Falha ao excluir', text: result.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
  showToast('success', 'Automensagem excluída.');
  await loadDashboard();
}

async function editProfile() {
  const modal = await Swal.fire({
    title: 'Perfil do grupo',
    background: '#0f1422',
    color: '#eef2ff',
    confirmButtonColor: '#8b5cf6',
    html: `
      <div class="space-y-3 text-left">
        <div>
          <label class="label-top">Nome do grupo</label>
          <div class="input-shell"><input id="profile-name" value="${escapeHtml(dashboardData.nome || '')}"></div>
        </div>
        <div>
          <label class="label-top">Nova senha</label>
          <div class="input-shell"><input id="profile-pass" placeholder="Deixe vazio para não alterar"></div>
        </div>
      </div>
    `,
    preConfirm: () => ({
      nome: document.getElementById('profile-name').value.trim(),
      senha: document.getElementById('profile-pass').value.trim()
    })
  });

  if (!modal.value) return;
  if (modal.value.nome) {
    await apiRequest({ acao: 'save_group_name', id: sessionUser.id, nome: modal.value.nome });
  }
  if (modal.value.senha) {
    await apiRequest({ acao: 'alterar_senha', id: sessionUser.id, nova_senha: modal.value.senha });
  }
  showToast('success', 'Perfil atualizado.');
  await loadDashboard();
}

async function renewPlan() {
  const plans = [
    { label: '30 dias', price: 40, days: 30 },
    { label: '90 dias', price: 110, days: 90 },
    { label: '180 dias', price: 199, days: 180 }
  ];
  const modal = await Swal.fire({
    title: 'Renovar acesso via PIX',
    background: '#0f1422',
    color: '#eef2ff',
    confirmButtonColor: '#8b5cf6',
    html: `
      <div class="grid gap-3 text-left">
        ${plans.map((plan, index) => `
          <label class="plan-card ${index === 0 ? 'active' : ''}" data-renew-option>
            <input type="radio" name="renew-plan" value="${index}" ${index === 0 ? 'checked' : ''} class="hidden">
            <div class="text-lg font-extrabold">${plan.label}</div>
            <div class="text-sm text-slate-400 mt-2">${formatCurrencyBR(plan.price)}</div>
          </label>
        `).join('')}
      </div>
    `,
    didOpen: () => {
      document.querySelectorAll('[data-renew-option]').forEach(option => {
        option.addEventListener('click', () => {
          document.querySelectorAll('[data-renew-option]').forEach(el => el.classList.remove('active'));
          option.classList.add('active');
          option.querySelector('input').checked = true;
        });
      });
    },
    preConfirm: () => {
      const value = Number(document.querySelector('input[name="renew-plan"]:checked')?.value || 0);
      return plans[value];
    }
  });
  if (!modal.value) return;

  const pix = await apiRequest({ acao: 'gerar_pix', id: sessionUser.id, dias: modal.value.days, valor: modal.value.price });
  if (!pix.sucesso) {
    return Swal.fire({ icon: 'error', title: 'Falha ao gerar PIX', text: pix.erro || 'Erro desconhecido.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }

  Swal.fire({
    title: 'PIX de renovação',
    html: `
      <div class="space-y-4">
        <div class="mx-auto w-56 h-56 rounded-3xl overflow-hidden border border-white/10 bg-white p-3">
          <img class="w-full h-full object-contain" src="data:image/png;base64,${pix.qr_code}" alt="QR Code PIX">
        </div>
        <div class="textarea-shell"><textarea rows="4" readonly>${pix.copia_cola}</textarea></div>
      </div>
    `,
    background: '#0f1422',
    color: '#eef2ff',
    showCloseButton: true,
    showConfirmButton: false
  });

  const status = await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const response = await apiRequest({ acao: 'verificar_pix_status', id: sessionUser.id, payment_id: pix.payment_id, dias: modal.value.days });
        if (response.aprovado) {
          clearInterval(interval);
          resolve(response);
        }
        if (attempts >= 60) {
          clearInterval(interval);
          reject(new Error('Tempo limite de verificação atingido.'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 5000);
  });

  if (Swal.isVisible()) Swal.close();
  showToast('success', 'Pagamento confirmado', status.aguardando_aprovacao_admin ? 'Agora aguarde a aprovação administrativa.' : 'Renovação aplicada com sucesso.');
  await loadDashboard();
}

function renderDashboard() {
  renderHero();
  renderFeatureGrid();
  renderAntimedia();
  renderAutoMessages();
  renderPlatformMessage();
  if (window.lucide) lucide.createIcons();
}

function logoutUser() {
  localStorage.removeItem('nekotina_session');
  window.location.href = '/';
}

window.addEventListener('DOMContentLoaded', async () => {
  if (!sessionUser) return;
  document.getElementById('save-platform-button').addEventListener('click', savePlatformMessage);
  document.getElementById('copy-platform-button').addEventListener('click', copyPlatformMessage);
  document.getElementById('new-automsg-button').addEventListener('click', newAutoMessage);
  document.getElementById('edit-profile-button').addEventListener('click', editProfile);
  document.getElementById('renew-plan-button').addEventListener('click', renewPlan);
  document.getElementById('logout-button').addEventListener('click', logoutUser);
  document.getElementById('refresh-dashboard').addEventListener('click', loadDashboard);

  try {
    await loadDashboard();
  } catch (error) {
    Swal.fire({ icon: 'error', title: 'Não foi possível abrir o dashboard', text: error.message || 'Falha ao carregar os dados.', background: '#0f1422', color: '#eef2ff', confirmButtonColor: '#8b5cf6' });
  }
});
