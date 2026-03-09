async function submitAdminLogin() {
  const user = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value.trim();
  const button = document.getElementById('admin-login-button');

  if (!user || !pass) {
    return showToast('warning', 'Preencha usuário e senha.');
  }

  setButtonLoading(button, true, 'Entrando...');
  try {
    const result = await apiRequest({ acao: 'admin_login', user, pass });
    if (!result.sucesso) {
      throw new Error(result.erro || 'Credenciais inválidas.');
    }
    localStorage.setItem('nekotina_admin_session', 'ok');
    await showToast('success', 'Login aprovado', 'Abrindo o painel administrativo.');
    window.location.href = '/painel-admin/';
  } catch (error) {
    showToast('error', 'Falha ao entrar', error.message || 'Não foi possível autenticar.');
  } finally {
    setButtonLoading(button, false);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-login-button').addEventListener('click', submitAdminLogin);
  document.querySelectorAll('#admin-user, #admin-pass').forEach(input => {
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') submitAdminLogin();
    });
  });
});
