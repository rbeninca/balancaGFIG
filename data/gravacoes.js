// ============================================================================
// LÓGICA PARA O MODAL DE GRAVAÇÕES
// ============================================================================

let gravacoesCache = [];

/**
 * Abre o modal de gravações e carrega a lista.
 */
async function openGravacoesModal() {
  const overlay = document.getElementById('gravacoes-modal-overlay');
  if (!overlay) {
    console.error('Modal de gravações não encontrado. Carregando...');
    await injectModalHTML('gravacoes.html', 'gravacoes.css');
  }
  
  document.getElementById('gravacoes-modal-overlay').classList.add('visible');
  loadAndDisplayRecordings();
}

/**
 * Fecha o modal de gravações.
 */
function closeGravacoesModal() {
  document.getElementById('gravacoes-modal-overlay').classList.remove('visible');
}

/**
 * Carrega as gravações do LocalStorage e as exibe na lista.
 */
function loadAndDisplayRecordings() {
  const listaEl = document.getElementById('gravacoes-lista');
  const statusEl = document.getElementById('gravacoes-status');
  listaEl.innerHTML = '<div class="gravacoes-placeholder"><span>Carregando gravações...</span></div>';

  try {
    const gravacoesJSON = localStorage.getItem('balancaGravacoes');
    gravacoesCache = gravacoesJSON ? JSON.parse(gravacoesJSON) : [];
    
    // Ordena as gravações da mais recente para a mais antiga
    gravacoesCache.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (gravacoesCache.length === 0) {
      listaEl.innerHTML = '<div class="gravacoes-placeholder"><span>Nenhuma gravação encontrada.</span></div>';
      statusEl.textContent = '0 gravações';
      return;
    }

    listaEl.innerHTML = ''; // Limpa o placeholder
    gravacoesCache.forEach(gravacao => {
      const itemEl = document.createElement('div');
      itemEl.className = 'gravacao-item';
      itemEl.onclick = () => viewRecording(gravacao.id);

      const data = new Date(gravacao.timestamp);
      const dataFormatada = data.toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });

      itemEl.innerHTML = `
        <div class="gravacao-info">
          <span class="gravacao-nome">${gravacao.nome}</span>
          <span class="gravacao-data">${dataFormatada}</span>
        </div>
        <div class="gravacao-actions">
          <button class="btn-icon" title="Deletar gravação" onclick="event.stopPropagation(); deleteRecording(${gravacao.id});">
            🗑️
          </button>
        </div>
      `;
      listaEl.appendChild(itemEl);
    });

    statusEl.textContent = `${gravacoesCache.length} gravações salvas localmente.`;

  } catch (e) {
    console.error('Erro ao carregar gravações:', e);
    listaEl.innerHTML = '<div class="gravacoes-placeholder"><span>Erro ao carregar gravações.</span></div>';
    statusEl.textContent = 'Erro';
  }
}

/**
 * Exibe uma gravação salva usando o modal de análise existente.
 * @param {number} id O ID da gravação a ser visualizada.
 */
function viewRecording(id) {
  const gravacao = gravacoesCache.find(g => g.id === id);
  if (!gravacao) {
    showNotification('error', 'Gravação não encontrada.');
    return;
  }

  // Prepara os dados no formato que o modal de análise espera
  const sessionData = gravacao.dadosTabela.map(d => ({
      forca: parseFloat(d.newtons),
      tempo: parseFloat(d.tempo_esp)
  }));

  const sessionMetadata = {
      nomeSessao: gravacao.nome,
      startDate: new Date(gravacao.data_inicio),
      recordingEndTime: new Date(gravacao.data_fim),
      recordedData: sessionData
  };
  
  console.log('[Gravacoes] Visualizando sessão:', sessionMetadata);

  // Fecha o modal de gravações e abre o de análise
  closeGravacoesModal();
  
  // Garante que a função showAnalysisModal está disponível
  if (typeof showAnalysisModal === 'function') {
    showAnalysisModal(sessionData, sessionMetadata);
  } else {
    showNotification('error', 'Função de análise de sessão não encontrada.');
  }
}

/**
 * Deleta uma gravação do LocalStorage.
 * @param {number} id O ID da gravação a ser deletada.
 */
function deleteRecording(id) {
  if (!confirm('Tem certeza que deseja deletar esta gravação? Esta ação não pode ser desfeita.')) {
    return;
  }

  try {
    let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    const novasGravacoes = gravacoes.filter(g => g.id !== id);
    
    localStorage.setItem('balancaGravacoes', JSON.stringify(novasGravacoes));
    showNotification('success', 'Gravação deletada com sucesso.');
    
    // Recarrega a lista no modal
    loadAndDisplayRecordings();

  } catch (e) {
    console.error('Erro ao deletar gravação:', e);
    showNotification('error', 'Erro ao deletar gravação.');
  }
}


/**
 * Injeta dinamicamente o HTML e o CSS de um componente no DOM.
 * @param {string} htmlFile O nome do arquivo HTML do componente.
 * @param {string} cssFile O nome do arquivo CSS do componente.
 */
async function injectModalHTML(htmlFile, cssFile) {
    try {
        // Carrega o CSS
        if (!document.querySelector(`link[href="${cssFile}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssFile;
            document.head.appendChild(link);
        }

        // Carrega o HTML
        const response = await fetch(htmlFile);
        if (!response.ok) {
            throw new Error(`Não foi possível carregar ${htmlFile}`);
        }
        const html = await response.text();
        
        // Cria um container para o novo HTML e o adiciona ao body
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container);

        console.log(`Componente ${htmlFile} carregado com sucesso.`);

    } catch (error) {
        console.error(`Falha ao injetar o modal ${htmlFile}:`, error);
        showNotification('error', `Não foi possível carregar o componente de gravações.`);
    }
}
