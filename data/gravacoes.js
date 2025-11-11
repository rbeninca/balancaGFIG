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
 * Calcula as métricas de análise de uma gravação
 * @param {Object} gravacao - Objeto da gravação
 * @returns {Object} - Objeto com as métricas calculadas
 */
function calcularMetricasGravacao(gravacao) {
  try {
    if (!gravacao.dadosTabela || gravacao.dadosTabela.length === 0) {
      return null;
    }

    const forceValues = gravacao.dadosTabela.map(d => parseFloat(d.newtons));
    const timeValues = gravacao.dadosTabela.map(d => parseFloat(d.tempo_esp));
    
    const maxForce = Math.max(...forceValues);
    const threshold = maxForce * 0.05;
    const minTime = Math.min(...timeValues);
    
    // Detecta início da queima
    let burnStart = 0;
    for (let i = 0; i < forceValues.length; i++) {
      if (forceValues[i] > threshold) {
        burnStart = timeValues[i] - minTime;
        break;
      }
    }
    
    // Detecta fim da queima
    let burnEnd = timeValues[timeValues.length - 1] - minTime;
    for (let i = forceValues.length - 1; i >= 0; i--) {
      if (forceValues[i] > threshold) {
        burnEnd = timeValues[i] - minTime;
        break;
      }
    }
    
    // Calcula impulso total usando regra do trapézio
    let impulsoTotal = 0;
    for (let i = 1; i < timeValues.length; i++) {
      const tPrev = timeValues[i - 1];
      const tCur = timeValues[i];
      const startTimeAbs = burnStart + minTime;
      const endTimeAbs = burnEnd + minTime;
      
      if (tCur >= startTimeAbs && tPrev >= startTimeAbs && tCur <= endTimeAbs) {
        const dt = tCur - tPrev;
        const f1 = forceValues[i - 1];
        const f2 = forceValues[i];
        const areaTrap = dt * (f1 + f2) / 2;
        if (areaTrap > 0) {
          impulsoTotal += areaTrap;
        }
      }
    }
    
    const tempoBurning = burnEnd - burnStart;
    
    // Classifica o motor
    const classificacoes = [
      { min: 0.00, max: 0.3125, classe: 'Micro 1/8A', faixa: '0-0.31 N·s' },
      { min: 0.3126, max: 0.625, classe: '¼A', faixa: '0.31-0.63 N·s' },
      { min: 0.626, max: 1.25, classe: '½A', faixa: '0.63-1.25 N·s' },
      { min: 1.26, max: 2.50, classe: 'A', faixa: '1.26-2.5 N·s' },
      { min: 2.51, max: 5.00, classe: 'B', faixa: '2.5-5 N·s' },
      { min: 5.01, max: 10.00, classe: 'C', faixa: '5-10 N·s' },
      { min: 10.01, max: 20.00, classe: 'D', faixa: '10-20 N·s' },
      { min: 20.01, max: 40.00, classe: 'E', faixa: '20-40 N·s' },
      { min: 40.01, max: 80.00, classe: 'F', faixa: '40-80 N·s' },
      { min: 80.01, max: 160.00, classe: 'G', faixa: '80-160 N·s' },
      { min: 160.01, max: 320.00, classe: 'H', faixa: '160-320 N·s' },
      { min: 320.01, max: 640.00, classe: 'I', faixa: '320-640 N·s' },
      { min: 640.01, max: 1280.00, classe: 'J', faixa: '640-1280 N·s' },
      { min: 1280.01, max: 2560.00, classe: 'K', faixa: '1.28-2.56 kN·s' },
      { min: 2560.01, max: 5120.00, classe: 'L', faixa: '2.56-5.12 kN·s' },
      { min: 5120.01, max: 10240.00, classe: 'M', faixa: '5.12-10.24 kN·s' },
      { min: 10240.01, max: 20480.00, classe: 'N', faixa: '10.24-20.48 kN·s' },
      { min: 20480.01, max: 40960.00, classe: 'O', faixa: '20.48-40.96 kN·s' }
    ];
    
    let classificacao = { classe: '---', faixa: '---' };
    const EPS = 1e-6;
    for (let c of classificacoes) {
      if ((c.min - EPS) <= impulsoTotal && impulsoTotal <= (c.max + EPS)) {
        classificacao = { classe: c.classe, faixa: c.faixa };
        break;
      }
    }
    
    return {
      tempoBurning: tempoBurning,
      impulsoTotal: impulsoTotal,
      classeMotor: classificacao.classe,
      faixaMotor: classificacao.faixa
    };
  } catch (e) {
    console.error('Erro ao calcular métricas:', e);
    return null;
  }
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

      // Calcula métricas da gravação
      const metricas = calcularMetricasGravacao(gravacao);
      const nomeMotor = gravacao.metadadosMotor?.nome || '---';
      const tempoBurning = metricas ? metricas.tempoBurning.toFixed(2) + ' s' : '---';
      const impulsoTotal = metricas ? metricas.impulsoTotal.toFixed(2) + ' N·s' : '---';
      const classeMotor = metricas ? metricas.classeMotor : '---';
      const faixaMotor = metricas ? metricas.faixaMotor : '---';

      itemEl.innerHTML = `
        <div class="gravacao-info">
          <div class="gravacao-linha1">
            <span class="gravacao-nome">${gravacao.nome}</span>
            <span class="gravacao-data">${dataFormatada}</span>
          </div>
          <div class="gravacao-linha2">
            <span class="gravacao-detalhe"><strong>Motor:</strong> ${nomeMotor}</span>
            <span class="gravacao-detalhe"><strong>Tempo:</strong> ${tempoBurning}</span>
            <span class="gravacao-detalhe"><strong>Impulso:</strong> ${impulsoTotal}</span>
            <span class="gravacao-detalhe"><strong>Classe:</strong> ${classeMotor}</span>
            <span class="gravacao-detalhe"><strong>Faixa:</strong> ${faixaMotor}</span>
          </div>
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
