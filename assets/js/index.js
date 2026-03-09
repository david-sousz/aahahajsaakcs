const plans = [
  { id: 'starter', label: '15 dias', badge: 'Entrada', price: 25, days: 15, ms: 15 * 86400000, note: 'Ideal para ativação rápida.' },
  { id: 'monthly', label: '30 dias', badge: 'Popular', price: 40, days: 30, ms: 30 * 86400000, note: 'Plano mais escolhido.' },
  { id: 'quarter', label: '90 dias', badge: 'Premium', price: 110, days: 90, ms: 90 * 86400000, note: 'Melhor custo por período.' },
  { id: 'semester', label: '180 dias', badge: 'Elite', price: 199, days: 180, ms: 180 * 86400000, note: 'Operação longa e estável.' }
];

let selectedPlan = plans[1];
let captchaA = 0;
let captchaB = 0;

function renderPlans() {
  const wrapper = document.getElementById('plan-grid');
  wrapper.innerHTML = plans.map(plan => `
    <button type="button" class="plan-card ${selectedPlan.id === plan.id ? 'active' : ''}" data-plan="${plan.id}">
      <span class="plan-badge">${plan.badge}</span>
      <div class="text-left">
        <div class="text-lg font-extrabold">${plan.label}</div>
        <div class="text-sm text-slate-300 mt-1">${formatCurrencyBR(plan.price)}</div>
        <div class="text-xs text-slate-400 mt-3">${plan.note}</div>
      </div>
    </button>
  `).join('');

  wrapper.querySelectorAll('[data-plan]').forEach(button => {
    button.addEventListener('click', () => {
      const next = plans.find(plan => plan.id === button.dataset.plan);
      if (!next) return;
      selectedPlan = next;
      renderPlans();
      renderPurchaseSummary();
    });
  });
}

function renderPurchaseSummary() {
  document.getElementById('summary-plan').textContent = selectedPlan.label;
  document.getElementById('summary-price').textContent = formatCurrencyBR(selectedPlan.price);
  document.getElementById('summary-period').textContent = formatDuration(selectedPlan.ms);
}

async function loadGroups() {
  const select = document.getElementById('group-select');
  try {
    const groups = await apiGetGroups();
    if (!Array.isArray(groups) || !groups.length) {
      select.innerHTML = '<option value="" selected disabled>Nenhum grupo cadastrado no momento</option>';
      return;
    }
    select.innerHTML = '<option value="" selected disabled>Escolha o seu grupo</option>';
    groups.forEach(group => {
      const option = document.createElement('option');
      option.value = group.id;
      option.textContent = group.nome ? `${group.nome} · ${group.id.slice(0, 10)}...` : group.id;
      select.appendChild(option);
    });
  } catch (error) {
    select.innerHTML = '<option value="" selected disabled>Falha ao carregar grupos</option>';
  }
}

function renewCaptcha() {
  captchaA = Math.floor(Math.random() * 9) + 1;
  captchaB = Math.floor(Math.random() * 9) + 1;
  document.getElementById('captcha-text').textContent = `${captchaA} + ${captchaB}`;
  document.getElementById('captcha-answer').value = '';
}

async function submitLogin() {
  const button = document.getElementById('login-button');
  const groupId = document.getElementById('group-select').value;
  const pass = document.getElementById('group-pass').value.trim();
  const answer = Number(document.getElementById('captcha-answer').value);

  if (!groupId) return showToast('warning', 'Escolha um grupo para entrar.');
  if (!pass) return showToast('warning', 'Digite a senha do grupo.');
  if (answer !== captchaA + captchaB) {
    renewCaptcha();
    return showToast('error', 'Captcha incorreto.');
  }

  setButtonLoading(button, true, 'Entrando...');
  try {
    const result = await apiRequest({ acao: 'login', id: groupId, pass });
    if (!result.sucesso) {
      renewCaptcha();
      return showToast('error', 'Falha no login', result.erro || 'Senha incorreta.');
    }
    localStorage.setItem('nekotina_session', JSON.stringify(result.user));
    await showToast('success', 'Acesso liberado', 'Redirecionando para o painel...');
    window.location.href = '/dashboard/';
  } catch (error) {
    showToast('error', 'Erro de conexão', error.message || 'Não foi possível concluir o login.');
  } finally {
    setButtonLoading(button, false);
  }
}

function formPurchasePayload() {
  const nome = document.getElementById('buyer-name').value.trim();
  const numero = normalizePhone(document.getElementById('buyer-number').value.trim());
  const link_grupo = document.getElementById('buyer-link').value.trim();

  return {
    nome,
    numero,
    link_grupo,
    tempo: selectedPlan.label,
    dias: selectedPlan.days,
    tempo_ms: selectedPlan.ms,
    valor: selectedPlan.price,
    origem: 'site'
  };
}

function validatePurchasePayload(payload) {
  if (!payload.nome) return 'Digite o nome do responsável.';
  if (!payload.numero) return 'Digite o número/contato do responsável.';
  if (!payload.link_grupo || !payload.link_grupo.includes('http')) return 'Informe o link válido do grupo.';
  return '';
}

async function pollPaymentStatus(paymentId, planDays) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = window.setInterval(async () => {
      attempts += 1;
      try {
        const status = await apiRequest({ acao: 'verificar_pix_status', payment_id: paymentId, dias: planDays });
        if (status.aprovado) {
          clearInterval(interval);
          resolve(status);
          return;
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
}

async function submitPurchase() {
  const button = document.getElementById('purchase-button');
  const payload = formPurchasePayload();
  const validation = validatePurchasePayload(payload);
  if (validation) return showToast('warning', validation);

  setButtonLoading(button, true, 'Gerando PIX...');
  try {
    const pix = await apiRequest({ acao: 'gerar_pix', ...payload });
    if (!pix.sucesso) {
      throw new Error(pix.erro || 'Não foi possível gerar o pagamento.');
    }

    Swal.fire({
      title: 'Pagamento via PIX',
      html: `
        <div class="space-y-4 text-left">
          <div class="mx-auto w-56 h-56 rounded-3xl overflow-hidden border border-white/10 bg-white p-3">
            <img class="w-full h-full object-contain" src="data:image/png;base64,${pix.qr_code}" alt="QR Code PIX">
          </div>
          <div class="text-sm text-slate-300 text-center">Depois que o pagamento for confirmado, o pedido ficará aguardando aprovação no painel administrativo.</div>
          <div class="textarea-shell !rounded-2xl">
            <textarea rows="4" readonly id="pix-copy-field">${pix.copia_cola}</textarea>
          </div>
          <button type="button" id="pix-copy-button" class="btn-secondary w-full">Copiar código PIX</button>
          <div class="status-chip primary w-full justify-center">Verificação automática em andamento</div>
        </div>
      `,
      background: '#0f1422',
      color: '#eef2ff',
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        document.getElementById('pix-copy-button').addEventListener('click', async () => {
          await copyText(pix.copia_cola);
          showToast('success', 'Código PIX copiado.');
        });
      }
    });

    const result = await pollPaymentStatus(pix.payment_id, selectedPlan.days);
    if (Swal.isVisible()) Swal.close();

    await Swal.fire({
      icon: 'success',
      title: 'Pagamento confirmado',
      text: result.aguardando_aprovacao_admin ? 'Seu pedido foi salvo e agora aguarda aprovação no painel administrativo.' : 'Pagamento aprovado com sucesso.',
      background: '#0f1422',
      color: '#eef2ff',
      confirmButtonColor: '#8b5cf6'
    });

    document.getElementById('purchase-form').reset();
    selectedPlan = plans[1];
    renderPlans();
    renderPurchaseSummary();
  } catch (error) {
    if (Swal.isVisible()) Swal.close();
    Swal.fire({
      icon: 'error',
      title: 'Falha no pagamento',
      text: error.message || 'Não foi possível concluir a operação.',
      background: '#0f1422',
      color: '#eef2ff',
      confirmButtonColor: '#8b5cf6'
    });
  } finally {
    setButtonLoading(button, false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  renderPlans();
  renderPurchaseSummary();
  loadGroups();
  renewCaptcha();

  document.getElementById('login-button').addEventListener('click', submitLogin);
  document.getElementById('purchase-button').addEventListener('click', submitPurchase);
  document.getElementById('reload-captcha').addEventListener('click', renewCaptcha);
  document.getElementById('buyer-number').addEventListener('input', event => {
    event.target.value = event.target.value.replace(/[^\d+()\-\s]/g, '');
  });
});
