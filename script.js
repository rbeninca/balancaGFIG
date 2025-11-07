// --- CONFIGURAÇÃO GUIADA (WIZARD) ---

let wizardCurrentStep = 0;
const WIZARD_TOTAL_STEPS = 5;
let wizardState = {};
let configTimeout;

function openWizard() {
  const modal = document.getElementById('wizard-modal');
  modal.style.display = 'block';
  wizardCurrentStep = 0;
  wizardState = {}; // Reseta o estado

  // Mostra a tela de loading e esconde a de erro
  document.getElementById('wizard-loading').style.display = 'block';
  document.getElementById('wizard-error').style.display = 'none';
  
  goToStep(0);

  // Se estiver no GitHub Pages, não tenta buscar a configuração
  if (isGitHubPages()) {
    console.warn('[Wizard] GitHub Pages detectado - pulando busca de configuração');
    document.getElementById('wizard-loading').style.display = 'none';
    return;
  }

  // Tenta buscar a configuração por 10 segundos com uma tentativa a cada segundo
  let retries = 10;
  const fetchConfig = () => {
    sendCommandToWorker('get_config');
    configTimeout = setTimeout(() => {
      if (retries > 0) {
        retries--;
        fetchConfig();
      } else {
        // Após 10 tentativas, mostra erro
        document.getElementById('wizard-loading').style.display = 'none';
        document.getElementById('wizard-error').style.display = 'block';
      }
    }, 1000); // 1 segundo de timeout entre tentativas
  };

  fetchConfig();
}

function closeWizard() {
  const modal = document.getElementById('wizard-modal');
  modal.style.display = 'none';
  clearTimeout(configTimeout);
  stopWizardRealtimeReading(); // Remove listener ao fechar
}

function wizardGoToStep(direction) {
  const newStep = wizardCurrentStep + direction;

  if (direction > 0) { // Indo para frente
    if (!validateStep(wizardCurrentStep)) {
      return; // Impede de avançar se a validação falhar
    }
    saveStepState(wizardCurrentStep);
  }

  if (newStep >= 0 && newStep <= WIZARD_TOTAL_STEPS) {
    goToStep(newStep);
  }
}

function goToStep(stepNumber) {
  // Esconde todas as etapas
  document.querySelectorAll('.wizard-step').forEach(step => step.style.display = 'none');

  // Mostra a etapa atual
  const currentStepEl = document.getElementById(`wizard-step-${stepNumber}`);
  if (currentStepEl) {
    currentStepEl.style.display = 'block';
  }

  wizardCurrentStep = stepNumber;
  updateWizardUI();

  // Se está entrando na etapa 2, atualiza a sugestão de tolerância baseado nos valores da etapa 1
  if (stepNumber === 2) {
    updateWizardToleranceSuggestion();
  }

  // Se está na etapa 3, ativa a atualização da leitura em tempo real
  if (stepNumber === 3) {
    startWizardRealtimeReading();
  } else {
    stopWizardRealtimeReading();
  }
}

// Variável para armazenar o listener de leitura em tempo real
let wizardRealtimeListener = null;

function startWizardRealtimeReading() {
  const leituraEl = document.getElementById('wizard-leitura-atual');

  if (!leituraEl) return;

  // Remove listener anterior se existir
  stopWizardRealtimeReading();

  // Cria novo listener
  wizardRealtimeListener = (event) => {
    const { type, payload } = event.data;
    if (type === 'dadosDisponiveis' && payload && payload[0]) {
      const forca = payload[0].forca;
      const kgf = (forca / 9.80665).toFixed(3);
      leituraEl.textContent = `${forca.toFixed(3)} N (${kgf} kgf)`;
    }
  };

  // Adiciona listener ao dataWorker se ele existir
  if (typeof dataWorker !== 'undefined') {
    dataWorker.addEventListener('message', wizardRealtimeListener);
  }
}

function stopWizardRealtimeReading() {
  if (wizardRealtimeListener && typeof dataWorker !== 'undefined') {
    dataWorker.removeEventListener('message', wizardRealtimeListener);
    wizardRealtimeListener = null;
  }
}

function updateWizardUI() {
  // Atualiza a barra de progresso
  const progressBar = document.querySelector('.wizard-progress-bar');
  const progress = (wizardCurrentStep / WIZARD_TOTAL_STEPS) * 100;
  progressBar.style.width = `${progress}%`;

  // Atualiza os botões
  document.getElementById('wizard-btn-prev').style.display = wizardCurrentStep > 0 ? 'inline-block' : 'none';
  document.getElementById('wizard-btn-next').style.display = wizardCurrentStep < WIZARD_TOTAL_STEPS ? 'inline-block' : 'none';
  document.getElementById('wizard-btn-finish').style.display = wizardCurrentStep === WIZARD_TOTAL_STEPS ? 'inline-block' : 'none';
}

function validateStep(step) {
  if (step === 1) {
    const capacidade = parseFloat(document.getElementById('wizard-capacidade-maxima').value);
    const acuracia = parseFloat(document.getElementById('wizard-acuracia').value);
    if (isNaN(capacidade) || capacidade <= 0) {
      showNotification('error', 'O limite da célula de carga deve ser um número maior que zero.');
      return false;
    }
    if (isNaN(acuracia) || acuracia <= 0) {
      showNotification('error', 'A acurácia deve ser um número percentual maior que zero.');
      return false;
    }
  }
  if (step === 2) {
    const numAmostras = parseInt(document.getElementById('wizard-num-amostras').value);
    const tolerancia = parseFloat(document.getElementById('wizard-tolerancia').value);
    const timeout = parseInt(document.getElementById('wizard-timeout').value);
    if (isNaN(numAmostras) || numAmostras < 1) {
      showNotification('error', 'O número de leituras para média deve ser ao menos 1.');
      return false;
    }
    if (isNaN(tolerancia) || tolerancia <= 0) {
      showNotification('error', 'A tolerância de calibração deve ser maior que zero.');
      return false;
    }
    if (isNaN(timeout) || timeout < 1000) {
      showNotification('error', 'O timeout de calibração deve ser de no mínimo 1000 ms.');
      return false;
    }
  }
  return true;
}

function saveStepState(step) {
  if (step === 1) {
    const capacidade = parseFloat(document.getElementById('wizard-capacidade-maxima').value);
    const unidade = document.getElementById('wizard-capacidade-unidade').value;
    let capacidadeEmGramas = capacidade;

    if (unidade === 'kg') {
      capacidadeEmGramas = capacidade * 1000;
    } else if (unidade === 'N') {
      // Assuming g = 9.80665
      capacidadeEmGramas = (capacidade / 9.80665) * 1000;
    }

    wizardState.capacidadeMaximaGramas = capacidadeEmGramas;
    wizardState.percentualAcuracia = parseFloat(document.getElementById('wizard-acuracia').value) / 100;
  }
  if (step === 4) {
    wizardState.antiNoisingMultiplier = parseFloat(document.getElementById('wizard-anti-noising-multiplier').value);
  }
  if (step === 2) {
    wizardState.numAmostrasMedia = parseInt(document.getElementById('wizard-num-amostras').value);

    // Converte tolerância de gramas para Newtons para salvar no ESP
    const toleranciaEmGramas = parseFloat(document.getElementById('wizard-tolerancia').value);
    wizardState.toleranciaEstabilidade = (toleranciaEmGramas * 9.80665) / 1000; // Converte g para N

    wizardState.timeoutCalibracao = parseInt(document.getElementById('wizard-timeout').value);
  }
}

function populateWizardForm(config) {
  clearTimeout(configTimeout); // Cancela o timeout de erro
  document.getElementById('wizard-loading').style.display = 'none';
  document.getElementById('wizard-error').style.display = 'none';

  // Etapa 1
  document.getElementById('wizard-capacidade-maxima').value = config.capacidadeMaximaGramas || 5000;
  document.getElementById('wizard-acuracia').value = (config.percentualAcuracia * 100).toFixed(3) || 0.05;

  const capacidadeInput = document.getElementById('wizard-capacidade-maxima');
  const unidadeSelect = document.getElementById('wizard-capacidade-unidade');
  const acuraciaInput = document.getElementById('wizard-acuracia');

  // Atualiza a exibição de capacidade em gramas e erro
  const updateCapacidadeDisplay = () => {
    const capacidade = parseFloat(capacidadeInput.value) || 0;
    const unidade = unidadeSelect.value;
    let capacidadeEmGramas = capacidade;

    if (unidade === 'kg') {
      capacidadeEmGramas = capacidade * 1000;
    } else if (unidade === 'N') {
      capacidadeEmGramas = (capacidade / 9.80665) * 1000;
    }

    document.getElementById('wizard-capacidade-em-gramas').textContent = `≈ ${capacidadeEmGramas.toFixed(2)} g`;
    updateWizardErroEmGramas();
  };

  capacidadeInput.addEventListener('input', updateCapacidadeDisplay);
  unidadeSelect.addEventListener('change', updateCapacidadeDisplay);
  updateCapacidadeDisplay();

  // Etapa 2
  document.getElementById('wizard-num-amostras').value = config.numAmostrasMedia || 10;
  document.getElementById('wizard-timeout').value = config.timeoutCalibracao || 10000; // Mudado de 5000 para 10000

  // Converte tolerância de Newtons para gramas (se config.toleranciaEstabilidade estiver em Newtons)
  const toleranciaEmNewtons = config.toleranciaEstabilidade || 0;
  const toleranciaEmGramas = (toleranciaEmNewtons * 1000) / 9.80665;

  // Define o valor de tolerância (será recalculado quando entrar na etapa 2)
  document.getElementById('wizard-tolerancia').value = toleranciaEmGramas > 0 ? toleranciaEmGramas.toFixed(2) : '';

  // Avança para a primeira etapa real
  wizardGoToStep(1);
}

// Função para atualizar o erro em gramas
function updateWizardErroEmGramas() {
  const capacidadeInput = document.getElementById('wizard-capacidade-maxima');
  const unidadeSelect = document.getElementById('wizard-capacidade-unidade');
  const acuraciaInput = document.getElementById('wizard-acuracia');

  const capacidade = parseFloat(capacidadeInput.value) || 0;
  const unidade = unidadeSelect.value;
  let capacidadeEmGramas = capacidade;

  if (unidade === 'kg') {
    capacidadeEmGramas = capacidade * 1000;
  } else if (unidade === 'N') {
    capacidadeEmGramas = (capacidade / 9.80665) * 1000;
  }

  const acuracia = parseFloat(acuraciaInput.value) || 0;
  const erro = capacidadeEmGramas * (acuracia / 100);
  document.getElementById('wizard-erro-em-gramas').textContent = `Erro: ± ${erro.toFixed(2)} g`;

  // Atualiza validação de tolerância se estiver na etapa 2
  if (wizardCurrentStep === 2) {
    validateWizardTolerancia();
  }
}

// Função para validar a tolerância em relação ao erro da célula
function validateWizardTolerancia() {
  const capacidadeInput = document.getElementById('wizard-capacidade-maxima');
  const unidadeSelect = document.getElementById('wizard-capacidade-unidade');
  const acuraciaInput = document.getElementById('wizard-acuracia');
  const toleranciaInput = document.getElementById('wizard-tolerancia');
  const warningEl = document.getElementById('wizard-tolerancia-warning');

  const capacidade = parseFloat(capacidadeInput.value) || 0;
  const unidade = unidadeSelect.value;
  let capacidadeEmGramas = capacidade;

  if (unidade === 'kg') {
    capacidadeEmGramas = capacidade * 1000;
  } else if (unidade === 'N') {
    capacidadeEmGramas = (capacidade / 9.80665) * 1000;
  }

  const acuracia = parseFloat(acuraciaInput.value) || 0;
  const erroEmGramas = capacidadeEmGramas * (acuracia / 100);
  const tolerancia = parseFloat(toleranciaInput.value) || 0;

  if (tolerancia < erroEmGramas) {
    warningEl.style.display = 'block';
    toleranciaInput.style.borderColor = 'var(--cor-alerta)';
    toleranciaInput.style.background = 'rgba(231, 76, 60, 0.1)';
  } else {
    warningEl.style.display = 'none';
    toleranciaInput.style.borderColor = '';
    toleranciaInput.style.background = '';
  }
}

// Função para validar o timeout de calibração
function validateWizardTimeout() {
  const timeoutInput = document.getElementById('wizard-timeout');
  const warningEl = document.getElementById('wizard-timeout-warning');
  const timeout = parseInt(timeoutInput.value) || 0;

  if (timeout < 5000 && timeout > 0) {
    warningEl.style.display = 'block';
    timeoutInput.style.borderColor = 'var(--cor-aviso)';
    timeoutInput.style.background = 'rgba(243, 156, 18, 0.1)';
  } else {
    warningEl.style.display = 'none';
    timeoutInput.style.borderColor = '';
    timeoutInput.style.background = '';
  }
}

// Função para atualizar a sugestão de tolerância baseado nos valores da Etapa 1
function updateWizardToleranceSuggestion() {
  const capacidadeInput = document.getElementById('wizard-capacidade-maxima');
  const unidadeSelect = document.getElementById('wizard-capacidade-unidade');
  const acuraciaInput = document.getElementById('wizard-acuracia');
  const toleranciaInput = document.getElementById('wizard-tolerancia');
  const sugestaoEl = document.getElementById('wizard-tolerancia-sugestao');

  if (!capacidadeInput || !unidadeSelect || !acuraciaInput || !toleranciaInput || !sugestaoEl) {
    console.warn('Elementos do wizard não encontrados');
    return;
  }

  const capacidade = parseFloat(capacidadeInput.value) || 0;
  const unidade = unidadeSelect.value;
  let capacidadeEmGramas = capacidade;

  // Converte para gramas conforme a unidade
  if (unidade === 'kg') {
    capacidadeEmGramas = capacidade * 1000;
  } else if (unidade === 'N') {
    capacidadeEmGramas = (capacidade / 9.80665) * 1000;
  }
  // Se já está em gramas, não precisa converter

  const acuracia = parseFloat(acuraciaInput.value) / 100 || 0;
  const erroAbsolutoEmGramas = capacidadeEmGramas * acuracia;
  const sugestaoTolerancia = (erroAbsolutoEmGramas * 1.5).toFixed(2);

  // Atualiza o campo de tolerância com a sugestão (apenas se estiver vazio ou com valor muito baixo)
  const valorAtual = parseFloat(toleranciaInput.value) || 0;
  if (valorAtual === 0 || valorAtual < erroAbsolutoEmGramas * 0.5) {
    toleranciaInput.value = sugestaoTolerancia;
  }

  // Atualiza o texto de sugestão
  sugestaoEl.textContent = `💡 Sugestão: ${sugestaoTolerancia} g (baseado em 1.5x o erro da célula de ${erroAbsolutoEmGramas.toFixed(2)} g)`;

  // Valida a tolerância após atualizar
  validateWizardTolerancia();
}

// Sobrescreve a função de update para também popular o wizard
const originalUpdateConfigForm = updateConfigForm;
updateConfigForm = function(config) {
  originalUpdateConfigForm(config);
  if (document.getElementById('wizard-modal').style.display === 'block') {
    populateWizardForm(config);
  }
}

function wizardTare() {
  const statusEl = document.getElementById('wizard-tare-status');
  statusEl.innerHTML = 'Enviando comando de tara...';
  sendCommandToWorker("t");

  // Aguarda a proxima leitura da balança para confirmar
  const onData = (event) => {
    const { type, payload } = event.data;
    if (type === 'dadosDisponiveis') {
      const forca = payload[0].forca;
      statusEl.innerHTML = `✅ Tara concluída! Leitura atual: ${forca.toFixed(3)} N`;
      dataWorker.removeEventListener('message', onData);
    }
  };
  dataWorker.addEventListener('message', onData);
}

function wizardCalibrate() {
  const statusEl = document.getElementById('wizard-calibrate-status');
  const massa = parseFloat(document.getElementById("wizard-massa-calibracao").value);
  if (!isNaN(massa) && massa > 0) {
    statusEl.innerHTML = `Enviando comando de calibração com ${massa}g...`;
    sendCommandToWorker("c", massa);

    // Aguarda a proxima leitura da balança para confirmar
    const onData = (event) => {
      const { type, payload } = event.data;
      if (type === 'dadosDisponiveis') {
        const forca = payload[0].forca;
        statusEl.innerHTML = `✅ Calibração concluída! Leitura atual: ${forca.toFixed(3)} N`;
        dataWorker.removeEventListener('message', onData);
      }
    };
    dataWorker.addEventListener('message', onData);
  } else {
    showNotification("error", "Informe uma massa de calibração válida.");
  }
}

async function applyWizardSettings() {
  saveStepState(wizardCurrentStep); // Salva o estado da última etapa

  const paramsToSave = {
    capacidadeMaximaGramas: wizardState.capacidadeMaximaGramas,
    percentualAcuracia: wizardState.percentualAcuracia,
    numAmostrasMedia: wizardState.numAmostrasMedia,
    toleranciaEstabilidade: wizardState.toleranciaEstabilidade,
    timeoutCalibracao: wizardState.timeoutCalibracao,
    antiNoisingMultiplier: wizardState.antiNoisingMultiplier
  };

  showNotification('info', 'Aplicando configurações no dispositivo...');

  for (const [key, value] of Object.entries(paramsToSave)) {
    if (value !== undefined && !isNaN(value)) {
      await new Promise(resolve => setTimeout(resolve, 100));
      sendCommandToWorker('set', { param: key, value: value });
    }
  }

  // Salva a preferência do lembrete
  const showReminder = document.getElementById('wizard-show-reminder').checked;
  localStorage.setItem('showStartupReminder', showReminder);

  setTimeout(() => {
    showNotification('success', 'Configurações aplicadas com sucesso!');
    sendCommandToWorker('get_config'); // Pede a config atualizada para garantir
    closeWizard();
  }, 1000);
}

function wizardAnalyzeNoise() {
  const statusEl = document.getElementById('wizard-noise-status');
  statusEl.innerHTML = 'Analisando ruído... Mantenha a balança VAZIA e ESTÁVEL por 5 segundos!';
  
  startNoiseAnalysis();

  setTimeout(() => {
    statusEl.innerHTML = `✅ Análise de ruído concluída! Desvio padrão: ${currentStdDev.toFixed(3)} N`;
  }, 5000);
}

// --- Variáveis Globais da UI ---
let chart;
let dataWorker;
let MAX_DATA_POINTS = 100; // Changed from const to let
let chartMode = 'deslizante';
let wasAccumulating = false; // Track if we were in accumulated mode before pausing
let displayUnit = 'kgf';
let maxForceInN = -Infinity;
let minForceInN = Infinity;
let lastForcaN = 0;
let lastEmaN = 0;
let rawDataN = []; // Mantido para conversão de unidades
let isSessionActive = false;
let isChartPaused = false;
let sessionStartTime = null; // Armazena o tempo inicial da sessão para normalização
let sessionRecordingStartTimestamp = null; // Wall-clock time when recording started
let sessionRecordingEndTimestamp = null; // Wall-clock time when recording ended
let chartUpdateBuffer = [];
let animationFrameId = null;
let originalChartContainer = null; // New global variable to store original parent
let originalChartSessionControlsContainer = null; // New global variable for session controls
let originalChartControlsParent = null; // Parent of the specific chart controls
let taxaAtualizacaoMs = 100; // Taxa de atualização em ms (padrão 100ms = 10 Hz)
let dataRequestIntervalId = null; // ID do intervalo de solicitação de dados
let btnToggleLabels, btnToggleDisplayMode, btnToggleGrid, btnSetSmoothLine, btnSetStraightLine;
let isMysqlConnected = false; // NEW: Global variable for MySQL connection status
let serverTimeOffset = 0; // Diferença entre servidor e cliente (ms)
window.sharedState = { 
  forcaAtual: 0, 
  overloadAlert: { active: false, level: 0, percent: 0, forca: 0 } 
}; // Objeto compartilhado para estado global

// --- Variáveis de Filtros e Análise ---
let antiNoisingAtivo = false;
let isStabilityMode = false;
let noiseBuffer = [];
const NOISE_BUFFER_SIZE = 50;
let currentStdDev = 0;
let noiseMean = 0;
let antiNoisingMultiplier = 2.0;

// --- Variáveis para Especificações da Célula ---
let capacidadeMaximaGramas = 5000.0;
let percentualAcuracia = 0.05;
let filtroZonaMortaAtivo = true;
let arredondamentoInteligenteAtivo = true;

// --- Variáveis de Áudio e Alertas ---
let avisosAudioAtivados = false;
let audioContext = null;
let ultimoStatusEstabilizacao = true;
let contadorFalhasEstabilizacao = 0;

// --- Funções de Inicialização ---
window.onload = () => {
  // Expor forcaAtual como propriedade do window para acesso de janelas filhas
  
  
  // Conectar ao worker IMEDIATAMENTE (antes de aguardar o onload completo)
  conectarWorkerRapido();
  
  abrirAba(document.getElementById("padrao"), 'abaGrafico');
  initializeApexChart(); // NOVA FUNÇÃO DE GRÁFICO
  loadAndDisplayAllSessions(); // Carrega as sessões uma vez ao iniciar
  setDisplayUnit('kgf');
  setChartMode('deslizante');
  
  // Inicia o intervalo dinâmico de solicitação de dados
  iniciarIntervaloAtualizacao();
  
  setInterval(updateReadingsPerSecond, 1000);
  addNoiseControlsToUI();
  inicializarAudioContext();
  setupKeyboardShortcuts();
  setupTheme();
  setupWebSocketUrl();
  setupApiBaseUrlHelpers();
  originalChartContainer = document.querySelector("#abaGrafico .grafico-e-controles"); // Initialize originalChartContainer
  originalChartSessionControlsContainer = document.querySelector("#abaGrafico .controles-grafico-sessao"); // Initialize new variable

  // Initialize specific chart control buttons and their original parent
  originalChartControlsParent = originalChartSessionControlsContainer.querySelector(".btn-grupo");
  btnToggleLabels = document.getElementById('btn-toggle-labels');
  btnToggleDisplayMode = document.getElementById('btn-toggle-display-mode');
  btnToggleGrid = document.getElementById('btn-toggle-grid');
  btnSetSmoothLine = document.getElementById('btn-set-smooth-line');
  btnSetStraightLine = document.getElementById('btn-set-straight-line');

  // Atualiza o status dos filtros na inicialização
  atualizarStatusFiltros();
  // Sincroniza a aparência dos botões de filtros na inicialização
  if (typeof syncFilterButtonsUI === 'function') {
    syncFilterButtonsUI();
  }

  // Setup para o campo de taxa de atualização
  const taxaInput = document.getElementById('taxa-atualizacao');
  if (taxaInput) {
    taxaInput.value = taxaAtualizacaoMs;
    console.log('[TAXA] Campo encontrado. Valor atual:', taxaAtualizacaoMs);
    
    // Atualiza ao sair do campo
    taxaInput.addEventListener('change', (e) => {
      const novaValor = parseInt(e.target.value);
      if (!isNaN(novaValor) && novaValor >= 10 && novaValor <= 1000) {
        taxaAtualizacaoMs = novaValor;
        atualizarIntervaloAtualizacao();
        atualizarInfoTaxa();
        console.log('[TAXA] Alterada para:', taxaAtualizacaoMs, 'ms');
        showNotification('info', `Taxa de atualização alterada para ${taxaAtualizacaoMs}ms (${(1000/taxaAtualizacaoMs).toFixed(1)} Hz)`);
      } else {
        e.target.value = taxaAtualizacaoMs;
        showNotification('error', 'Valor inválido. Use valores entre 10 e 1000 ms.');
      }
    });
    
    // Atualiza enquanto digita (feedback em tempo real)
    taxaInput.addEventListener('input', (e) => {
      const novaValor = parseInt(e.target.value);
      if (!isNaN(novaValor) && novaValor >= 10 && novaValor <= 1000) {
        const hz = (1000 / novaValor).toFixed(1);
        const infoEl = document.getElementById('taxa-info');
        if (infoEl) {
          infoEl.textContent = `≈ ${hz} atualizações/seg (prévia)`;
        }
      }
    });
  } else {
    console.warn('[TAXA] Campo taxa-atualizacao NÃO encontrado no HTML!');
  }

  // Add event listener for the new exit fullscreen button
  const exitFullscreenButton = document.getElementById('btn-exit-fullscreen');
  if (exitFullscreenButton) {
    exitFullscreenButton.addEventListener('click', toggleFullscreen);
  }

  // Setup for MAX_DATA_POINTS input
  const maxDataPointsInput = document.getElementById('max-data-points-input');
  if (maxDataPointsInput) {
    maxDataPointsInput.value = MAX_DATA_POINTS;
    maxDataPointsInput.addEventListener('change', (event) => {
      const newValue = parseInt(event.target.value);
      if (!isNaN(newValue) && newValue > 0) {
        MAX_DATA_POINTS = newValue;
        showNotification('info', 'Número máximo de pontos atualizado para ' + MAX_DATA_POINTS + '.');
        // Optionally, trim existing data if new limit is smaller
        if (rawDataN.length > MAX_DATA_POINTS) {
          rawDataN = rawDataN.slice(rawDataN.length - MAX_DATA_POINTS);
          chart.updateSeries([{ data: rawDataN.map(p => [p[0], convertForce(p[1], displayUnit)]) }]);
        }
      } else {
        showNotification('error', 'Valor inválido para o número máximo de pontos.');
        event.target.value = MAX_DATA_POINTS; // Revert to old value
      }
    });
  }

  // Setup for Wizard button
  const wizardButton = document.getElementById('btn-open-wizard');
  if (wizardButton) {
    wizardButton.addEventListener('click', openWizard);
  }

  const leiturasContainer = document.getElementById('leituras-container');
  if (leiturasContainer) {
    const units = ['kgf', 'N', 'gf'];
    leiturasContainer.addEventListener('click', () => {
      const currentIndex = units.indexOf(displayUnit);
      const nextIndex = (currentIndex + 1) % units.length;
      const newUnit = units[nextIndex];
      setDisplayUnit(newUnit);
      showNotification('info', `Unidade alterada para ${newUnit}`);
    });
  }

  // Setup para o novo modal de sessão
  const novaSessaoButton = document.getElementById('btn-abrir-modal-sessao');
  if (novaSessaoButton) {
    novaSessaoButton.addEventListener('click', abrirModalNovaSessao);
  }
};

/**
 * Verifica se a aplicação está sendo executada no GitHub Pages.
 * @returns {boolean} True se estiver no GitHub Pages, false caso contrário.
 */
function isGitHubPages() {
  return window.location.hostname.endsWith('github.io');
}

function setupTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const currentTheme = localStorage.getItem('theme') || 'light';

  if (currentTheme === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️';
  }

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    let theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);

    // Atualiza o tema do gráfico ApexCharts
    chart.updateOptions({
      chart: { background: 'transparent' },
      theme: { mode: theme }
    });
  });
}

function setupWebSocketUrl() {
  const wsUrlInput = document.getElementById('ws-url');
  const wsUrlSaveButton = document.getElementById('btn-salvar-ws-url');
  const wsUrlResetButton = document.getElementById('btn-resetar-ws-url');
  const wsUrlControls = document.getElementById('ws-url-controls');

  if (isGitHubPages()) {
    if (wsUrlInput) {
      wsUrlInput.value = 'WebSocket desabilitado no GitHub Pages (HTTPS)';
      wsUrlInput.disabled = true;
      wsUrlInput.style.backgroundColor = '#e9e9e9';
      wsUrlInput.style.color = '#555';
      wsUrlInput.style.cursor = 'not-allowed';
      wsUrlInput.title = 'Conexões WebSocket são desabilitadas em ambientes HTTPS como o GitHub Pages por segurança.';
    }
    if (wsUrlSaveButton) wsUrlSaveButton.style.display = 'none';
    if (wsUrlResetButton) wsUrlResetButton.style.display = 'none';
    if (wsUrlControls) wsUrlControls.style.display = 'none'; // Hide the whole section if it exists
    console.warn('WebSocket connections are disabled on GitHub Pages.');
    return; // Exit early, no need to set a URL
  }

  const savedWsUrl = localStorage.getItem('wsUrl');

  if (savedWsUrl) {
    wsUrlInput.value = savedWsUrl;
  } else {
    // Se não houver URL salva, preenche com o host atual e a porta padrão do WS
    let defaultHost = location.hostname;
    // Se estiver em um ambiente de desenvolvimento como Live Server, use localhost
    if (location.port === '5500' || defaultHost === '127.0.0.1') {
      defaultHost = 'localhost';
    }
    wsUrlInput.value = 'ws://' + defaultHost + ':81';
  }
}

// --- Gerenciamento da Taxa de Atualização Dinâmica ---

function iniciarIntervaloAtualizacao() {
  if (dataRequestIntervalId) {
    clearInterval(dataRequestIntervalId);
  }
  dataRequestIntervalId = setInterval(() => {
    if (dataWorker) {
      dataWorker.postMessage({ type: 'solicitarDados' });
    }
  }, taxaAtualizacaoMs);
  console.log(`[Intervalo] Iniciado com taxa de ${taxaAtualizacaoMs}ms (${(1000/taxaAtualizacaoMs).toFixed(1)} Hz)`);
}

function atualizarIntervaloAtualizacao() {
  if (dataRequestIntervalId) {
    clearInterval(dataRequestIntervalId);
  }
  iniciarIntervaloAtualizacao();
}

function atualizarInfoTaxa() {
  const infoEl = document.getElementById('taxa-info');
  if (infoEl) {
    const hz = (1000 / taxaAtualizacaoMs).toFixed(1);
    infoEl.textContent = `≈ ${hz} atualizações/seg`;
  }
}

// --- Helpers para API HTTP (funcionam mesmo fora do host do servidor) ---
let apiBaseUrl = '';

function setupApiBaseUrlHelpers() {
  try {
    // Usa a origem atual por padrão
    apiBaseUrl = window.location.origin;

    // Se estiver em Live Server (porta 5500) ou arquivo local, derive do wsUrl salvo
    if (location.port === '5500' || location.protocol === 'file:') {
      const savedWsUrl = localStorage.getItem('wsUrl');
      if (savedWsUrl) {
        const { host, protocol } = parseUrlLike(savedWsUrl);
        const httpProto = protocol === 'wss:' ? 'https:' : 'http:';
        const httpPort = '80';
        // Atenção para IPv6: se vier como ws://[addr]:81, URL() já retorna hostname sem colchetes
        apiBaseUrl = `${httpProto}//${host}:${httpPort}`;
      }
    }
  } catch (e) {
    console.warn('setupApiBaseUrlHelpers fallback para origem atual:', e);
    apiBaseUrl = window.location.origin;
  }
}

function parseUrlLike(urlStr) {
  try {
    let u = urlStr.trim();
    if (!u.startsWith('ws://') && !u.startsWith('wss://') && !u.startsWith('http')) {
      u = 'ws://' + u;
    }
    const url = new URL(u);
    return { protocol: url.protocol, host: url.hostname, port: url.port };
  } catch (e) {
    return { protocol: 'http:', host: location.hostname, port: '' };
  }
}

async function apiFetch(path, options = {}) {
  // Primeiro tenta relativo (mesma origem). Se falhar por erro de rede, tenta apiBaseUrl
  try {
    const res = await fetch(path, options);
    return res;
  } catch (e) {
    try {
      const url = path.startsWith('/') ? apiBaseUrl + path : apiBaseUrl + '/' + path;
      return await fetch(url, options);
    } catch (e2) {
      throw e2;
    }
  }
}

// --- Inicialização e Controle do Gráfico (ApexCharts) ---

function initializeApexChart() {
  const currentTheme = localStorage.getItem('theme') || 'light';
  const options = {
    series: [{
      name: 'Força',
      data: []
    }],
    chart: {
      id: 'realtime',
      height: 450,
      type: 'line',
      animations: {
        enabled: true,
        easing: 'linear',
        dynamicAnimation: {
          speed: 400
        }
      },
      toolbar: {
        show: true
      },
      zoom: {
        enabled: true
      },
      background: 'transparent'
    },
    grid: {
      show: true,
      borderColor: '#90A4AE',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true
        }
      },
      yaxis: {
        lines: {
          show: true
        }
      },
      row: {
        colors: ['#f3f3f3', 'transparent'], // alternating row colors
        opacity: 0.5
      },
      column: {
        colors: ['#f3f3f3', 'transparent'], // alternating column colors
        opacity: 0.5
      }
    },
    stroke: {
      curve: 'smooth',
      width: chartDisplayMode === 'line' || chartDisplayMode === 'both' ? 2.5 : 0
    },
    xaxis: {
      type: 'numeric',
      tickAmount: 10,
      labels: {
        formatter: (val) => {
          if (val % 1 === 0) {
            return parseInt(val) + 's';
          } else {
            return val.toFixed(1) + 's';
          }
        }
      }
    },
    yaxis: {
      labels: {
        formatter: (val) => {
          if (Math.abs(val) < 0.001) return '0.000 ' + displayUnit;
          if (Math.abs(val) < 0.01) return val.toFixed(4) + ' ' + displayUnit;
          if (Math.abs(val) < 0.1) return val.toFixed(3) + ' ' + displayUnit;
          if (Math.abs(val) < 10) return val.toFixed(2) + ' ' + displayUnit;
          return val.toFixed(1) + ' ' + displayUnit;
        }
      }
    },
    dataLabels: {
      enabled: false,
      offsetY: -10,
      style: {
        fontSize: '10px',
      },
    },
    markers: {
      size: chartDisplayMode === 'points' || chartDisplayMode === 'both' ? 4 : 0,
      colors: ['#FF0000']
    },
    theme: {
      mode: currentTheme
    }
  };

  chart = new ApexCharts(document.querySelector("#grafico"), options);
  chart.render();
}

function clearChart() {
  maxForceInN = -Infinity;
  minForceInN = Infinity;
  rawDataN = [];
  chart.updateSeries([{ data: [] }]);
  updateAccumulatedPointsDisplay(); // Atualiza o contador para 0
  showNotification("info", "Gráfico limpo. (Atalho: L)", 3000);
}

function updateForceDisplays(forceN, emaN, maxN, minN) {
    const displayForce = convertForce(forceN, displayUnit);
    const emaDisplay = convertForce(emaN, displayUnit);
    const maxDisplayForce = convertForce(maxN, displayUnit);
    const minDisplayForce = convertForce(minN, displayUnit);

    document.getElementById('forca-atual').textContent = `${displayForce.toFixed(3)} ${displayUnit}`;
    
    document.getElementById('forca-maxima').textContent = `${maxDisplayForce.toFixed(3)} ${displayUnit}`;
    document.getElementById('forca-minima').textContent = `mín: ${minDisplayForce.toFixed(3)} ${displayUnit}`;
}

function setDisplayUnit(unit) {
  displayUnit = unit;

  // Disparar evento customizado para o jogo Martelo do Thor
  document.dispatchEvent(new CustomEvent('unidade-alterada', {
    detail: { unidade: unit }
  }));

  // Re-processa os dados existentes para a nova unidade
  const newData = rawDataN.map(point => {
    return [point[0], convertForce(point[1], displayUnit)];
  });

  chart.updateSeries([{
    data: newData
  }]);

  chart.updateOptions({
    yaxis: {
      labels: {
        formatter: (val) => val.toFixed(3) + ' ' + displayUnit
      }
    }
  });

  updateForceDisplays(lastForcaN, lastEmaN, maxForceInN, minForceInN);
}

function setChartMode(mode) {
  // Salva se estava no modo acumulado antes de mudar
  if (chartMode === 'acumulado') {
    wasAccumulating = true;
  } else if (mode === 'deslizante') {
    // Se voltar para deslizante, reseta o flag
    wasAccumulating = false;
  }
  
  chartMode = mode;
  document.querySelectorAll('#btn-deslizante, #btn-acumulado, #btn-pausado').forEach(b => b.classList.remove('ativo'));
  document.getElementById(`btn-${mode}`).classList.add('ativo');
  isChartPaused = (mode === 'pausado');
  
  const maxPointsInput = document.getElementById('max-data-points-input');
  const maxPointsLabel = document.getElementById('max-data-points-label');
  
  if (mode === 'acumulado' || (mode === 'pausado' && wasAccumulating)) {
    // No modo acumulado ou pausado após acumular, desabilita o input e mostra a contagem atual
    maxPointsInput.disabled = true;
    maxPointsInput.style.fontWeight = 'bold';
    maxPointsInput.style.color = 'var(--cor-info)';
    if (maxPointsLabel) {
      if (mode === 'pausado') {
        maxPointsLabel.textContent = '⏸️ Pontos Acumulados (Pausado):';
      } else {
        maxPointsLabel.textContent = '📊 Pontos Acumulados:';
      }
      maxPointsLabel.style.color = 'var(--cor-info)';
      maxPointsLabel.style.fontWeight = 'bold';
    }
    updateAccumulatedPointsDisplay();
  } else {
    // Nos outros modos, habilita o input normalmente
    maxPointsInput.disabled = false;
    maxPointsInput.style.fontWeight = 'normal';
    maxPointsInput.style.color = '';
    maxPointsInput.value = MAX_DATA_POINTS;
    if (maxPointsLabel) {
      maxPointsLabel.textContent = 'Max Pontos:';
      maxPointsLabel.style.color = '';
      maxPointsLabel.style.fontWeight = 'normal';
    }
  }
}

function updateAccumulatedPointsDisplay() {
  if (chartMode === 'acumulado' || (chartMode === 'pausado' && wasAccumulating)) {
    const maxPointsInput = document.getElementById('max-data-points-input');
    if (maxPointsInput) {
      maxPointsInput.value = rawDataN.length;
    }
  }
}

function toggleChartPause(setPaused = null) {
  if (setPaused !== null) {
    isChartPaused = false;
  }
  if (isChartPaused) {
    setChartMode('deslizante');
    showNotification('info', 'Gráfico retomado (Deslizante). (Atalho: P)');
  } else {
    setChartMode('pausado');
    showNotification('info', 'Gráfico pausado. (Atalho: P)');
  }
}

// --- Comunicação com o Web Worker ---

/**
 * Conexão rápida do worker - chamada assim que o DOM começa a carregar
 * Não aguarda window.onload para iniciar a conexão WebSocket
 */
function conectarWorkerRapido() {
  if (window.Worker) {
    if (!dataWorker) {
      dataWorker = new Worker('dataWorker.js');
      dataWorker.onmessage = handleWorkerMessage;
      
      // Envia o status do GitHub Pages para o worker
      dataWorker.postMessage({ type: 'set_github_pages_mode', payload: { isGitHubPages: isGitHubPages() } });

      // Se estiver no GitHub Pages, não tenta conectar ao WebSocket
      if (isGitHubPages()) {
        console.warn('[Worker] WebSocket desabilitado no GitHub Pages. Não será feita conexão.');
        dataWorker.postMessage({ type: 'set_ws_url', payload: { url: null } }); // Envia null para o worker
        // Ainda pode solicitar dados se houver outra forma (e.g., mock data)
        // OTIMIZAÇÃO: Taxa de atualização mais rápida e agressiva na inicialização
        // Começa com 50ms para melhor responsividade inicial
        taxaAtualizacaoMs = 50;
        setInterval(() => dataWorker.postMessage({ type: 'solicitarDados' }), taxaAtualizacaoMs);
        return; // Sai da função, não tenta conectar
      }

      // Envia a URL do WebSocket IMEDIATAMENTE
      const savedWsUrl = localStorage.getItem('wsUrl');
      if (savedWsUrl) {
        dataWorker.postMessage({ type: 'set_ws_url', payload: { url: savedWsUrl } });
      } else {
        // Construir URL padrão mesmo sem localStorage (acelera primeira conexão)
        let defaultHost = location.hostname;
        if (location.port === '5500' || defaultHost === '127.0.0.1') {
          defaultHost = 'localhost';
        }
        const defaultUrl = 'ws://' + defaultHost + ':81';
        dataWorker.postMessage({ type: 'set_ws_url', payload: { url: defaultUrl } });
      }
      
      // OTIMIZAÇÃO: Taxa de atualização mais rápida e agressiva na inicialização
      // Começa com 50ms para melhor responsividade inicial
      taxaAtualizacaoMs = 50;
      setInterval(() => dataWorker.postMessage({ type: 'solicitarDados' }), taxaAtualizacaoMs);
      
      console.log('[Worker] Conectado com taxa inicial de 50ms para responsividade');
    }
  } else {
    showNotification('error', 'Seu navegador não suporta Web Workers.');
  }
}

function conectarWorker() {
  if (window.Worker) {
    if (!dataWorker) {
      dataWorker = new Worker('dataWorker.js');
      dataWorker.onmessage = handleWorkerMessage;
      const savedWsUrl = localStorage.getItem('wsUrl');
      if (savedWsUrl) {
        dataWorker.postMessage({ type: 'set_ws_url', payload: { url: savedWsUrl } });
      }
      setInterval(() => dataWorker.postMessage({ type: 'solicitarDados' }), 200);
    }
  } else {
    showNotification('error', 'Seu navegador não suporta Web Workers.');
  }
}

function handleWorkerMessage(event) {
  const { type, payload, status, message } = event.data;
  let currentSessionId = null; // Declare it here
  let notificationMessage = message; // Use a new variable for notification message

  // Extract sessionId and update notificationMessage for specific cases
  if (type === 'mysql_save_success' || type === 'mysql_save_error') {
    currentSessionId = payload.sessionId;
    notificationMessage = payload.message; // Update message for notification
  }

  switch (type) {
    case 'dadosDisponiveis':
      payload.forEach(updateUIFromData);
      break;
    case 'rps':
      document.getElementById('leituras-por-segundo').textContent = payload;
      break;
    case 'config':
      console.log('Configuração recebida:', payload);
      updateConfigForm(payload);
      break;
    case 'status':
      document.getElementById('balanca-status').textContent = notificationMessage || status; // Use notificationMessage
      if (status === 'connected' || status === 'disconnected') {
        updateConnectionStatus(status === 'connected');
      }
      if (notificationMessage) { // Use notificationMessage
        const notificationType = (status === 'error' || status === 'disconnected') ? 'error' : 'info';
        showNotification(notificationType, notificationMessage);
      }
      verificarStatusEstabilizacao(notificationMessage); // Use notificationMessage
      break;
    case 'mysql_status_update': // NEW: Handle MySQL status updates
      isMysqlConnected = payload;
      updateMysqlIndicator(isMysqlConnected);
      break;
    case 'serial_status_update': // NEW: Handle Serial status updates
      handleSerialStatusUpdate(payload);
      break;
    case 'mysql_save_success':
      showNotification('success', `Sessão "${notificationMessage}" salva no MySQL!`); // Use notificationMessage
      loadAndDisplayAllSessions(); // Re-render the list
      break;
    case 'mysql_save_error':
      showNotification('error', `Erro ao salvar sessão "${notificationMessage}" no MySQL.`); // Use notificationMessage
      break;
    case 'debug':
      console.log("[Worker Debug]:", message);
      break;
    default:
      console.warn("Mensagem desconhecida do worker:", event.data);
  }
}

// NEW: Function to update the MySQL UI indicator
function updateMysqlIndicator(connected) {
  const indicator = document.getElementById('mysql-indicator');
  const textElement = document.getElementById('mysql-text');
  if (indicator) {
    indicator.className = 'status-indicator ' + (connected ? 'conectado' : 'desconectado');
    indicator.title = connected ? 'MySQL Conectado' : 'MySQL Desconectado';
  }
  if (textElement) {
    textElement.textContent = connected ? 'Conectado' : 'Desconectado';
  }
}

// NEW: Function to handle serial connection status updates
let serialModalShown = false;
function handleSerialStatusUpdate(payload) {
  const { connected, error, port, baudrate } = payload;

  // Update balança status in footer
  const balancaStatus = document.getElementById('balanca-status');
  if (balancaStatus) {
    if (connected) {
      balancaStatus.textContent = `Conectado (${port || 'USB'})`;
      balancaStatus.style.color = 'var(--cor-sucesso)';
    } else {
      balancaStatus.textContent = 'Desconectado';
      balancaStatus.style.color = 'var(--cor-alerta)';
    }
  }

  // Show/hide modal based on connection status
  const modal = document.getElementById('modal-serial-warning');
  const errorMessage = document.getElementById('serial-error-message');
  const reconnectStatus = document.getElementById('serial-reconnect-status');

  if (!connected && error) {
    // Show error modal
    if (errorMessage) {
      errorMessage.textContent = error;
    }
    if (reconnectStatus) {
      reconnectStatus.textContent = 'Tentando reconectar automaticamente...';
    }
    if (modal && !serialModalShown) {
      modal.style.display = 'block';
      serialModalShown = true;
    }
  } else if (connected) {
    // Hide modal and show success notification
    if (modal && serialModalShown) {
      modal.style.display = 'none';
      serialModalShown = false;
      showNotification('success', `✓ Conectado à balança via ${port || 'USB'}`);
    }
  }
}

function fecharModalSerial() {
  const modal = document.getElementById('modal-serial-warning');
  if (modal) {
    modal.style.display = 'none';
    serialModalShown = false;
  }
}

function sendCommandToWorker(command, value = null) {
  if (!dataWorker) {
    showNotification("error", "Worker não está conectado.");
    console.error(`[sendCommandToWorker] Worker não conectado ao enviar comando: ${command}`);
    return;
  }
  // NEW: Always send a JSON object as payload to the worker
  const messagePayload = { cmd: command };
  if (value !== null) {
    // For 'save_session_to_mysql', value is the entire session object
    if (command === 'save_session_to_mysql') {
      messagePayload.sessionData = value;
      console.log(`[sendCommandToWorker] Enviando comando 'save_session_to_mysql' com sessão:`, value.nome, `(ID: ${value.id})`);
    } else {
      // For other commands, value is a simple parameter
      messagePayload.value = value;
      console.log(`[sendCommandToWorker] Enviando comando '${command}' com valor:`, value);
    }
  } else {
    console.log(`[sendCommandToWorker] Enviando comando '${command}' sem valor adicional`);
  }
  dataWorker.postMessage({ type: 'sendCommand', payload: messagePayload });
  console.log(`[sendCommandToWorker] ✓ Mensagem enviada ao worker`);
}

// --- Atualização da UI ---

function updateUIFromData(dado) {
  if (isChartPaused) return;

  let { tempo, forca, ema } = dado;

  // === PIPELINE DE FILTROS ===
  // Ordem crítica: Zona Morta → Arredondamento → Anti-Noising
  // Zona morta remove valores dentro da margem de erro da célula (neutralização)
  
  // [1] Converter força de Newtons para gramas (base de cálculo de zona morta)
  // [2] Aplicar zona morta + arredondamento inteligente
  // [3] Converter de volta para Newtons
  const forcaGramas = (forca / 9.80665) * 1000;
  const forcaGramasFiltrada = aplicarFiltrosGramas(forcaGramas);
  forca = (forcaGramasFiltrada / 1000) * 9.80665;

  // Aplicar MESMOS filtros no EMA para manter consistência
  // O EMA é uma média móvel exponencial que também sofre com a imprecisão da célula
  // Sem zona morta aqui, o gráfico EMA mostraria oscilações indesejadas
  const emaGramas = (ema / 9.80665) * 1000;
  const emaGramasFiltrada = aplicarFiltrosGramas(emaGramas);
  ema = (emaGramasFiltrada / 1000) * 9.80665;

  // Anti-noising aplicado POR ÚLTIMO (após zona morta já ter neutralizado o ruído)
  // Evita amplificar artefatos que já foram filtrados
  let forcaFiltrada = antiNoisingAtivo ? applyAntiNoising(forca) : forca;

  if (isStabilityMode) {
    calculateNoiseStatistics(forca);
  }

  if (forcaFiltrada > maxForceInN) maxForceInN = forcaFiltrada;
  if (forcaFiltrada < minForceInN) minForceInN = forcaFiltrada;

  lastForcaN = forcaFiltrada;
  lastEmaN = ema;

  updateForceDisplays(forcaFiltrada, ema, maxForceInN, minForceInN);

  // NOVO: Atualizar força global para janelas filhas (Martelo do Thor)
  window.sharedState.forcaAtual = forcaFiltrada;

  // Disparar evento customizado para o jogo Martelo do Thor
  document.dispatchEvent(new CustomEvent('forca-atualizada', {
    detail: { forcaN: forcaFiltrada, unidade: displayUnit }
  }));

  // Calcula percentual para alertas
  const capacidadeGramas = parseFloat(document.getElementById("param-capacidade-maxima")?.value) || 5000;
  const capacidadeN = (capacidadeGramas / 1000) * 9.80665;
  const percentual = Math.abs((forcaFiltrada / capacidadeN) * 100);

  // Aplica alertas graduais de limite da célula
  aplicarAlertasLimite(forcaFiltrada);
  
  // Atualiza barra de progresso do esforço no display (passa força e percentual)
  atualizarBarraEsforcoDisplay(percentual, forcaFiltrada);
  
  // Verifica e atualiza modal de sobrecarga (80%+)
  verificarModalSobrecarga(forcaFiltrada, percentual);

  rawDataN.push([tempo, forcaFiltrada]);

  // No modo deslizante, mantém apenas os últimos MAX_DATA_POINTS
  // No modo acumulado, mantém todos os dados
  if (chartMode === 'deslizante' && rawDataN.length > MAX_DATA_POINTS) {
    rawDataN.shift();
  }

  // Adiciona o novo ponto ao buffer de atualização do gráfico
  chartUpdateBuffer.push([tempo, forcaFiltrada]);

  // Se não houver uma atualização de quadro de animação agendada, agende uma
  if (!animationFrameId) {
    animationFrameId = requestAnimationFrame(processChartUpdates);
  }

  if (isSessionActive) {
    const tbody = document.getElementById("tabela").querySelector("tbody");
    const linha = tbody.insertRow(0);

  // Normalizar tempo: começar do zero
  // O ESP envia tempo em ms, mas o servidor Python JÁ converte para segundos (t_ms / 1000.0)
  // Portanto, aqui o 'tempo' já está em segundos

  // Define o tempo inicial na primeira leitura
  if (sessionStartTime === null) {
    sessionStartTime = tempo;
    sessionRecordingStartTimestamp = new Date(); // Capture wall-clock start time
  }

  // Tempo normalizado começando do zero
  const tempoNormalizado = tempo - sessionStartTime;

  // Gera timestamp em GMT (UTC) no formato dd/mm/yyyy HH:MM:SS.mmm
  const agora = new Date();
  const dd = String(agora.getUTCDate()).padStart(2, '0');
  const mm = String(agora.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = agora.getUTCFullYear();
  const HH = String(agora.getUTCHours()).padStart(2, '0');
  const MM = String(agora.getUTCMinutes()).padStart(2, '0');
  const SS = String(agora.getUTCSeconds()).padStart(2, '0');
  const mmm = String(agora.getUTCMilliseconds()).padStart(3, '0');
  const timestamp = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}.${mmm}`;

  linha.insertCell(0).innerText = timestamp;
  linha.insertCell(1).innerText = Number(tempoNormalizado).toFixed(3);
  linha.insertCell(2).innerText = Number(forcaFiltrada).toFixed(6);
  linha.insertCell(3).innerText = Number((forcaFiltrada / 9.80665) * 1000).toFixed(casasDecimais);
  linha.insertCell(4).innerText = Number(forcaFiltrada / 9.80665).toFixed(6);

    if (tbody.rows.length > 5000) {
      tbody.deleteRow(tbody.rows.length - 1);
    }
  }
}

function processChartUpdates() {
  if (chartUpdateBuffer.length === 0) {
    animationFrameId = null;
    return;
  }

  // Converte todos os pontos do buffer para a unidade de exibição
  const displayData = rawDataN.map(p => [p[0], convertForce(p[1], displayUnit)]);

  // Atualiza o gráfico uma única vez com todos os dados acumulados
  chart.updateSeries([{ data: displayData }]);
  
  // Atualiza o contador de pontos se estiver no modo acumulado
  updateAccumulatedPointsDisplay();

  // Limpa o buffer e redefine o ID do quadro de animação
  chartUpdateBuffer = [];
  animationFrameId = null;
}

function updateConnectionStatus(isConnected) {
  const indicator = document.getElementById('ws-indicator');
  const text = document.getElementById('ws-text');
  document.body.classList.toggle('desconectado', !isConnected);
  indicator.classList.toggle('conectado', isConnected);
  indicator.title = isConnected ? 'Conectado' : 'Desconectado';
  if (text) text.textContent = isConnected ? 'Conectado' : 'Desconectado';
  if (isConnected) tocarAlertaReconexao(); else tocarAlertaDesconexao();
}

function updateReadingsPerSecond() {
  if (dataWorker) {
    dataWorker.postMessage({ type: 'getRPS' });
  }
}

function updateConfigForm(config) {
  const getValue = (val) => (val !== null && val !== undefined) ? val : '';
  document.getElementById("param-conversao").value = getValue(config.conversionFactor);
  document.getElementById("param-gravidade").value = getValue(config.gravity);
  document.getElementById("param-offset").value = getValue(config.tareOffset);
  document.getElementById("param-leituras-estaveis").value = getValue(config.leiturasEstaveis);
  document.getElementById("param-tolerancia").value = getValue(config.toleranciaEstabilidade);
  document.getElementById("param-num-amostras").value = getValue(config.numAmostrasMedia);
  document.getElementById("param-timeout").value = getValue(config.timeoutCalibracao);
  document.getElementById("param-capacidade-maxima").value = getValue(config.capacidadeMaximaGramas);
  document.getElementById("param-acuracia").value = getValue(config.percentualAcuracia);

  // Validação robusta com logs para debug
  const novaCapacidade = parseFloat(config.capacidadeMaximaGramas);
  const novaAcuracia = parseFloat(config.percentualAcuracia);
  const novaTol = parseFloat(config.toleranciaEstabilidade);
  const novoTimeout = parseFloat(config.timeoutCalibracao);
  
  capacidadeMaximaGramas = (!isNaN(novaCapacidade) && novaCapacidade > 0) ? novaCapacidade : 5000.0;
  percentualAcuracia = (!isNaN(novaAcuracia) && novaAcuracia > 0) ? novaAcuracia : 0.05;

  console.log('[updateConfigForm] Valores recebidos do ESP:');
  console.log('  Capacidade:', config.capacidadeMaximaGramas, '→', capacidadeMaximaGramas);
  console.log('  Acurácia:', config.percentualAcuracia, '→', percentualAcuracia);
  console.log('  Tolerância:', config.toleranciaEstabilidade, '→', novaTol.toFixed(2));
  console.log('  Timeout (ms):', config.timeoutCalibracao, '→', novoTimeout.toFixed(0));
  console.log('  Erro Absoluto calculado:', (capacidadeMaximaGramas * percentualAcuracia).toFixed(2), 'g');

  atualizarToleranciaEmGramas();
  atualizarCapacidadeEmKg();
  atualizarErroAbsoluto();
  atualizarStatusFiltros();

  // Remove loading class after updating form
  document.getElementById('abaControles').classList.remove('config-loading');
}

// ===================================================================================

/**
 * Carrega sessões de exemplo de arquivos JSON se não existirem no localStorage.
 * Isso é útil para demonstrações, especialmente em ambientes web como GitHub Pages.
 */
async function carregarSessoesExemplo() {
  // Executa apenas em ambiente web (http/https) e não em arquivos locais
  if (!window.location.protocol.startsWith('http')) {
    return;
  }

  const nomesArquivosExemplo = ['G60.json', 'BFB_14.json', 'NFB_14.json', 'PF_5.json'];
  const caminhoBase = 'data/json/';

  try {
    let sessoesLocais = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    const idsSessoesLocais = new Set(sessoesLocais.map(s => s.id));
    let novasSessoesAdicionadas = false;

    for (const nomeArquivo of nomesArquivosExemplo) {
      // O ID da sessão é derivado do nome do arquivo sem a extensão .json
      const idSessaoExemplo = nomeArquivo.replace('.json', '');

      if (!idsSessoesLocais.has(idSessaoExemplo)) {
        console.log(`Sessão de exemplo '${idSessaoExemplo}' não encontrada. Importando...`);
        const response = await fetch(caminhoBase + nomeArquivo);
        if (response.ok) {
          const sessaoExemplo = await response.json();
          // Garante que o ID no arquivo corresponde ao nome do arquivo
          if (sessaoExemplo.id === idSessaoExemplo) {
            sessoesLocais.push(sessaoExemplo);
            novasSessoesAdicionadas = true;
          } else {
            console.warn(`ID no arquivo '${nomeArquivo}' ('${sessaoExemplo.id}') não corresponde ao nome do arquivo ('${idSessaoExemplo}').`);
          }
        } else {
          console.error(`Falha ao carregar sessão de exemplo: ${nomeArquivo}`);
        }
      }
    }

    if (novasSessoesAdicionadas) {
      console.log('Novas sessões de exemplo foram adicionadas ao localStorage.');
      localStorage.setItem('balancaGravacoes', JSON.stringify(sessoesLocais));
      // Retorna true para que a chamada possa recarregar a lista na UI
      return true;
    }
  } catch (error) {
    console.error('Erro ao carregar sessões de exemplo:', error);
  }

  return false;
}


// Função para carregar e exibir todas as sessões salvas
async function loadAndDisplayAllSessions() {
  // Carrega exemplos primeiro e verifica se algo novo foi adicionado
  const exemplosAdicionados = await carregarSessoesExemplo();

  const gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes') || '[]');
  const listaGravacoesDiv = document.getElementById('lista-gravacoes');
  if (!listaGravacoesDiv) {
    console.error('[loadAndDisplayAllSessions] Elemento #lista-gravacoes não encontrado no DOM');
    return;
  }
  
  listaGravacoesDiv.innerHTML = '<p>Carregando sessões...</p>';

  try {
    let localSessions = [];
    try {
      localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    } catch (e) {
      console.error('[loadAndDisplayAllSessions] Erro ao fazer parse do localStorage:', e);
      localSessions = [];
    }
    
    const dbSessions = await fetchDbSessions(); // This now returns sessions with summary data

    console.log(`[loadAndDisplayAllSessions] Sessões locais encontradas: ${localSessions.length}`);
    console.log(`[loadAndDisplayAllSessions] Sessões no DB encontradas: ${dbSessions.length}`);

    const allSessionsMap = new Map();

    // Process local sessions: they need local calculation
    localSessions.forEach((session, index) => {
      try {
        if (session.dadosTabela && session.dadosTabela.length > 0) {
            const dados = processarDadosSimples(session.dadosTabela);
            const impulsoData = calcularAreaSobCurva(dados.tempos, dados.newtons, false);
            const metricasPropulsao = calcularMetricasPropulsao(impulsoData);
            session.impulsoTotal = impulsoData.impulsoTotal;
            session.motorClass = metricasPropulsao.classificacaoMotor.classe;
            session.classColor = metricasPropulsao.classificacaoMotor.cor;
        } else {
            session.impulsoTotal = 0;
            session.motorClass = 'N/A';
            session.classColor = '#95a5a6';
        }
        allSessionsMap.set(session.id, { ...session, source: 'local', inLocal: true });
      } catch (error) {
        console.error(`[loadAndDisplayAllSessions] Erro ao processar sessão local ${index} (ID: ${session.id}):`, error);
        // Ainda assim adiciona a sessão ao mapa com dados padrão
        session.impulsoTotal = 0;
        session.motorClass = 'Erro';
        session.classColor = '#e74c3c';
        allSessionsMap.set(session.id, { ...session, source: 'local', inLocal: true });
      }
    });

    console.log(`[loadAndDisplayAllSessions] Sessões locais processadas e adicionadas ao mapa`);

    // Process DB sessions: they should have summary data from the server
    dbSessions.forEach(dbSession => {
      try {
        const existingSession = allSessionsMap.get(dbSession.id);
        if (existingSession) {
          // Conflict detection logic (can be kept)
          const localModified = existingSession.data_modificacao ? new Date(existingSession.data_modificacao) : new Date(0);
          const dbModified = dbSession.data_modificacao ? new Date(dbSession.data_modificacao) : new Date(0);
          const hasConflict = Math.abs(localModified - dbModified) > 1000;

          allSessionsMap.set(dbSession.id, {
            ...existingSession,
            ...dbSession, // DB data (with summary) overwrites local
            source: 'both',
            inDb: true,
            hasConflict: hasConflict,
            localModified: existingSession.data_modificacao,
            dbModified: dbSession.data_modificacao
          });
        } else {
          allSessionsMap.set(dbSession.id, { ...dbSession, source: 'db', inDb: true });
        }
      } catch (error) {
        console.error(`[loadAndDisplayAllSessions] Erro ao processar sessão do DB (ID: ${dbSession.id}):`, error);
      }
    });

    const combinedSessions = Array.from(allSessionsMap.values()).sort((a, b) => b.id - a.id);

    console.log(`[loadAndDisplayAllSessions] Total de sessões combinadas (local + DB): ${combinedSessions.length}`);

    if (combinedSessions.length === 0) {
      console.log(`[loadAndDisplayAllSessions] Nenhuma sessão encontrada`);
      listaGravacoesDiv.innerHTML = '<p>Nenhuma gravação encontrada (local ou no banco de dados).</p>';
      return;
    }

  // THE LOOP THAT FETCHED READINGS IS NOW GONE.

  listaGravacoesDiv.innerHTML = combinedSessions.map(session => {
    try {
      // Função auxiliar para escapar caracteres HTML
      const escapeHtml = (text) => {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      };
      
      const sourceIcons = `${session.inLocal ? '<span title="Salvo Localmente" style="margin-right: 5px;">💾</span>' : ''}${session.inDb ? '<span title="Salvo no Banco de Dados" style="margin-right: 5px;">☁️</span>' : ''}`;
      const baseStart = session.data_inicio || session.timestamp;
      const dataInicio = baseStart ? parseDbTimestampToUTC(baseStart).toLocaleString('pt-BR') : 'N/D';

      // Use the pre-calculated values directly
      const impulsoTotal = session.impulsoTotal ? Number(session.impulsoTotal).toFixed(2) : 'N/A';
      const motorClass = session.motorClass || 'N/A';
      const classColor = session.classColor || '#95a5a6';

      // Metadados do motor
      const meta = session.metadadosMotor || {};
      const hasMeta = meta.diameter || meta.length || meta.manufacturer || meta.propweight || meta.totalweight;
      const hasConditions = meta.temperatura !== null && meta.temperatura !== undefined ||
                           meta.umidade !== null && meta.umidade !== undefined ||
                           meta.pressao !== null && meta.pressao !== undefined;

      const motorInfo = hasMeta ? `
        <p style="font-size: 0.75rem; color: var(--cor-texto-secundario); margin-top: 5px;">
          🚀 Motor: ${escapeHtml(meta.description) || escapeHtml(meta.manufacturer) || 'N/D'} • ⌀${meta.diameter || 'N/D'}mm • L${meta.length || 'N/D'}mm •
          Prop: ${meta.propweight || 'N/D'}kg • Total: ${meta.totalweight || 'N/D'}kg
        </p>
      ` : '';

      const conditionsInfo = hasConditions ? `
        <p style="font-size: 0.75rem; color: var(--cor-texto-secundario); margin-top: 3px;">
          ${meta.temperatura !== null && meta.temperatura !== undefined ? `🌡️ ${meta.temperatura}°C` : ''}
          ${meta.umidade !== null && meta.umidade !== undefined ? `• 💧 ${meta.umidade}%` : ''}
          ${meta.pressao !== null && meta.pressao !== undefined ? `• 🔵 ${meta.pressao} hPa` : ''}
        </p>
      ` : '';

      const metadadosDisplay = motorInfo + conditionsInfo;

      // Indicador de conflito
      const conflictIndicator = session.hasConflict ? `
        <span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 8px;">
          ⚠️ CONFLITO
        </span>
      ` : '';

      return `
        <div class="card-gravacao" style="display: flex; justify-content: space-between; align-items: center; background: var(--cor-fundo-card); padding: 15px; border-radius: 8px; box-shadow: rgba(0, 0, 0, 0.1) 0px 2px 10px; margin-bottom: 10px; border-left: 5px solid ${classColor};" id="session-${session.id}">
          <div style="flex: 1;">
              <p style="font-weight: 600; margin-bottom: 5px;">${sourceIcons}${escapeHtml(session.nome)} <span style="font-size: 0.75rem; background: ${classColor}; color: white; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">CLASSE ${motorClass}</span>${conflictIndicator}</p>
              <p style="font-size: 0.875rem; color: var(--cor-texto-secundario);">
                  ${dataInicio} • Impulso Total: ${impulsoTotal} N⋅s
              </p>
              ${metadadosDisplay}
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${session.hasConflict
          ? `<button onclick="resolverConflito(${session.id})" title="Resolver Conflito de Sincronização" class="btn btn-aviso">⚠️ Resolver Conflito</button>`
          : ''}
              <button onclick="visualizarSessao(${session.id}, '${session.source}')" title="Carregar para Análise/Gráfico" class="btn btn-info">️ Ver</button>
              <button onclick="abrirModalBurnAnalysis(${session.id}, '${session.source}')" title="Analisar Pontos de Queima" class="btn btn-aviso">🔥 Análise</button>
              <button onclick="editarMetadadosMotor(${session.id})" title="Editar Metadados do Motor" class="btn btn-secundario">⚙️ Metadados</button>
              <button onclick="exportarImagemSessao(${session.id}, '${session.source}')" title="Exportar Gráfico em PNG" class="btn btn-primario">️ PNG</button>
              <button onclick="gerarRelatorioPdf(${session.id}, '${session.source}')" title="Exportar Relatório PDF" class="btn btn-secundario"> PDF</button>
              <button onclick="exportarJSON(${session.id}, '${session.source}')" title="Exportar Dados em JSON" class="btn btn-sucesso"> JSON</button>
              <button onclick="exportarCSV(${session.id}, '${session.source}')" title="Exportar Dados em CSV" class="btn btn-sucesso"> CSV</button>
              <button onclick="exportarEng(${session.id}, '${session.source}')" title="Exportar Curva de Empuxo para OpenRocket/RASAero" class="btn btn-aviso"> ENG</button>
              ${session.inLocal && !session.inDb
          ? `<button class="btn btn-info btn-small"
                  ${!isMysqlConnected ? 'disabled title="MySQL desconectado"' : 'title="Salvar do LocalStorage para o Banco de Dados"'}
                onclick="salvarNoDB(${session.id})">
                💾 ➜ ☁️ Salvar no BD
             </button>
             <button class="btn btn-perigo btn-small" title="Excluir do LocalStorage" onclick="deleteLocalSession(${session.id})">🗑️ Excluir do Local</button>`
        : ''}
            ${session.inDb && !session.inLocal
        ? `<button class="btn btn-perigo btn-small" title="Excluir do Banco de Dados" onclick="deleteDbSession(${session.id})">🗑️ Excluir do BD</button>
             <button class="btn btn-info btn-small"
                title="Salvar do Banco de Dados para o LocalStorage"
                onclick="salvarNoLocalStorage(${session.id})">
                ☁️ ➜ 💾 Salvar Local
             </button>`
        : ''}
            ${session.inDb && session.inLocal
        ? `<button class="btn btn-perigo btn-small" title="Excluir do Banco de Dados" onclick="deleteDbSession(${session.id})">🗑️ Excluir do BD</button>
             <button class="btn btn-perigo btn-small" title="Excluir do LocalStorage" onclick="deleteLocalSession(${session.id})">🗑️ Excluir do Local</button>`
        : ''}
        </div>
      </div>
    `;
    } catch (error) {
      console.error(`[loadAndDisplayAllSessions] Erro ao renderizar sessão ${session.id}:`, error);
      return `
        <div class="card-gravacao" style="background: var(--cor-fundo-card); padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 5px solid #e74c3c;">
          <p style="color: #e74c3c;">Erro ao carregar sessão: ${session.nome}</p>
        </div>
      `;
    }
  }).join('');
  } catch (error) {
    console.error('[loadAndDisplayAllSessions] Erro ao renderizar sessões:', error);
    listaGravacoesDiv.innerHTML = `<p style="color: #e74c3c;">Erro ao carregar sessões. Verifique o console para mais detalhes.</p>`;
  }
}

/** Ordem dos botões  para salvar 
Só no LocalStorage:       💾 ➜ ☁️ Salvar no BD e 🗑️ Excluir do Local
Só no BD:                🗑️ Excluir do BD e  ☁️ ➜ 💾 Salvar Local
Em ambos:                🗑️ Excluir do BD e 🗑️ Excluir do Local

 */

function salvarNoLocalStorage(sessionId) {
  saveDbSessionToLocal(sessionId);
}

function salvarNoDB(sessionId) {
  saveLocalSessionToDb(sessionId);
}

async function editarMetadadosMotor(sessionId) {
  // Busca a sessão (local ou DB)
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  let session = localSessions.find(s => s.id === sessionId);

  // Se não está localmente, tenta buscar do DB
  if (!session) {
    try {
      const resp = await apiFetch(`/api/sessoes/${sessionId}`);
      if (resp.ok) {
        session = await resp.json();
      }
    } catch (e) {
      console.error('Erro ao buscar sessão do DB:', e);
    }
  }

  if (!session) {
    showNotification('error', 'Sessão não encontrada para editar metadados.');
    return;
  }

  const meta = session.metadadosMotor || {};

  // Formata datas para exibição com milissegundos
  const formatarData = (dataStr) => {
    if (!dataStr) return '---';
    try {
      const data = new Date(dataStr);
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      const horas = String(data.getHours()).padStart(2, '0');
      const minutos = String(data.getMinutes()).padStart(2, '0');
      const segundos = String(data.getSeconds()).padStart(2, '0');
      const milisegundos = String(data.getMilliseconds()).padStart(3, '0');
      return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}.${milisegundos}`;
    } catch {
      return dataStr;
    }
  };

  // Cria um modal para edição
  const modalHtml = `
    <div id="modal-metadados" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; overflow-y: auto;">
      <div style="background: var(--cor-fundo); padding: 1rem; border-radius: 12px; max-width: 1000px; width: 95%; box-shadow: 0 10px 40px rgba(0,0,0,0.3); margin: 1rem; max-height: 90vh; overflow-y: auto;">
        <h2 style="margin: 0 0 0.75rem 0; color: var(--cor-titulo); font-size: 1.25rem;">⚙️ Metadados do Motor - ${session.nome.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>

        <!-- Seção de Datas da Sessão (Somente Visualização) -->
        <div style="background: rgba(100,150,200,0.1); padding: 0.75rem; border-radius: 8px; margin-bottom: 0.75rem; border-left: 4px solid var(--cor-info, #3498db);">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 600; font-size: 0.85rem; color: var(--cor-titulo);">📅 Data de Início</label>
              <div style="padding: 0.5rem; background: var(--cor-fundo); border-radius: 4px; font-size: 0.9rem; border: 1px solid var(--cor-borda); font-family: 'Courier New', monospace;">
                ${formatarData(session.data_inicio || session.timestamp)}
              </div>
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 600; font-size: 0.85rem; color: var(--cor-titulo);">🏁 Data de Término</label>
              <div style="padding: 0.5rem; background: var(--cor-fundo); border-radius: 4px; font-size: 0.9rem; border: 1px solid var(--cor-borda); font-family: 'Courier New', monospace;">
                ${formatarData(session.data_fim)}
              </div>
            </div>
            <div>
              <label style="display: block; margin-bottom: 0.25rem; font-weight: 600; font-size: 0.85rem; color: var(--cor-titulo);">✏️ Última Modificação</label>
              <div style="padding: 0.5rem; background: var(--cor-fundo); border-radius: 4px; font-size: 0.9rem; border: 1px solid var(--cor-borda); font-family: 'Courier New', monospace;">
                ${formatarData(session.data_modificacao)}
              </div>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Nome do Motor</label>
            <input type="text" id="meta-name" value="${meta.name || ''}" placeholder="NFB_20" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Diâmetro (mm)</label>
            <input type="number" id="meta-diameter" value="${meta.diameter || 45}" step="0.1" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Comprimento (mm)</label>
            <input type="number" id="meta-length" value="${meta.length || 200}" step="1" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Delay (s)</label>
            <input type="number" id="meta-delay" value="${meta.delay || 0}" step="0.1" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Prop. (kg)</label>
            <input type="number" id="meta-propweight" value="${meta.propweight || 0.1}" step="0.001" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Total (kg)</label>
            <input type="number" id="meta-totalweight" value="${meta.totalweight || 0.25}" step="0.001" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">🌡️ Temp. (°C)</label>
            <input type="number" id="meta-temperatura" value="${meta.temperatura !== undefined && meta.temperatura !== null ? meta.temperatura : ''}" step="0.1" placeholder="25.5" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">💧 Umid. (%)</label>
            <input type="number" id="meta-umidade" value="${meta.umidade !== undefined && meta.umidade !== null ? meta.umidade : ''}" min="0" max="100" step="0.1" placeholder="65" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">🔵 Pressão (hPa)</label>
            <input type="number" id="meta-pressao" value="${meta.pressao !== undefined && meta.pressao !== null ? meta.pressao : ''}" step="0.01" placeholder="1013.25" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Fabricante</label>
            <input type="text" id="meta-manufacturer" value="${meta.manufacturer || 'GFIG - Campus Gaspar IFSC'}" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">📝 Descrição</label>
            <textarea id="meta-description" placeholder="Descrição do motor..." style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px; min-height: 60px; resize: vertical; font-family: inherit;">${meta.description || ''}</textarea>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.75rem;">
          <button onclick="fecharModalMetadados()" class="btn btn-secundario">Cancelar</button>
          <button onclick="salvarMetadadosMotor(${sessionId})" class="btn btn-sucesso">💾 Salvar Metadados</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharModalMetadados() {
  const modal = document.getElementById('modal-metadados');
  if (modal) modal.remove();
}

async function salvarMetadadosMotor(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const sessionIndex = localSessions.findIndex(s => s.id === sessionId);

  // Captura os valores do formulário
  const metadadosMotor = {
    name: document.getElementById('meta-name').value.trim(),
    manufacturer: document.getElementById('meta-manufacturer').value.trim(),
    diameter: parseFloat(document.getElementById('meta-diameter').value) || 45,
    length: parseFloat(document.getElementById('meta-length').value) || 200,
    delay: parseFloat(document.getElementById('meta-delay').value) || 0,
    propweight: parseFloat(document.getElementById('meta-propweight').value) || 0.1,
    totalweight: parseFloat(document.getElementById('meta-totalweight').value) || 0.25,
    description: document.getElementById('meta-description').value.trim(),
    observations: document.getElementById('meta-observations').value.trim(),
    temperatura: document.getElementById('meta-temperatura').value ? parseFloat(document.getElementById('meta-temperatura').value) : null,
    umidade: document.getElementById('meta-umidade').value ? parseFloat(document.getElementById('meta-umidade').value) : null,
    pressao: document.getElementById('meta-pressao').value ? parseFloat(document.getElementById('meta-pressao').value) : null
  };

  let sessionToUpdate = null;
  let isInLocal = sessionIndex !== -1;

  // Se existe localmente, atualiza no local storage

  if (isInLocal) {
    localSessions[sessionIndex].metadadosMotor = metadadosMotor;
    localSessions[sessionIndex].data_modificacao = new Date().toISOString();
    sessionToUpdate = localSessions[sessionIndex];

    try {
      localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));
      showNotification('success', 'Metadados do motor salvos localmente!');
    } catch (e) {
      showNotification('error', 'Erro ao salvar metadados localmente: ' + e.message);
      fecharModalMetadados();
      return;
    }
  }

  // Se não está localmente, busca do DB para ter os dados completos
  if (!sessionToUpdate) {
    try {
      const resp = await apiFetch(`/api/sessoes/${sessionId}`);
      if (resp.ok) {
        sessionToUpdate = await resp.json();
        sessionToUpdate.metadadosMotor = metadadosMotor;

        // Normaliza campos do DB para o formato esperado pelo worker
        if (sessionToUpdate.data_inicio && !sessionToUpdate.timestamp) {
          sessionToUpdate.timestamp = sessionToUpdate.data_inicio;
        }
        if (!sessionToUpdate.nome) {
          sessionToUpdate.nome = 'Sessão ' + sessionId;
        }
      }
    } catch (e) {
      console.error('Erro ao buscar sessão do DB:', e);
    }
  } else {
    // Atualiza os metadados na sessão local se já temos ela
    sessionToUpdate.metadadosMotor = metadadosMotor;
  }

  // Tenta salvar no DB se MySQL está conectado e temos a sessão
  if (isMysqlConnected && sessionToUpdate) {
    // Busca as leituras se não estiverem presentes
    if (!sessionToUpdate.dadosTabela || sessionToUpdate.dadosTabela.length === 0) {
      try {
        const readingsResp = await apiFetch(`/api/sessoes/${sessionId}/leituras`);
        if (readingsResp.ok) {
          const dbReadings = await readingsResp.json();
          sessionToUpdate.dadosTabela = dbReadings.map(r => ({
            timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
            tempo_esp: r.tempo,
            newtons: r.forca,
            grama_forca: (r.forca / 9.80665 * 1000),
            quilo_forca: (r.forca / 9.80665)
          }));
        }
      } catch (e) {
        console.warn('Não foi possível carregar leituras:', e);
      }
    }

    console.log('Enviando para o banco:', sessionToUpdate); // Debug
    sendCommandToWorker('save_session_to_mysql', sessionToUpdate);
    showNotification('info', 'Atualizando metadados no banco de dados...');
  } else if (!isMysqlConnected) {
    showNotification('warning', 'MySQL desconectado. Metadados salvos apenas localmente.');
  }

  fecharModalMetadados();

  // Recarrega a lista para mostrar os novos metadados
  setTimeout(() => loadAndDisplayAllSessions(), 500);
}


async function exportarPNG(sessionId, source) {
  // NOVA VERSÃO: Usa o sistema avançado de exportação PNG com configurações
  showNotification('info', 'Gerando relatório PNG com análise de propulsão...');

  const session = await getSessionDataForExport(sessionId, source);
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportar PNG.');
    return;
  }

  // Chama a função avançada de exportação PNG (de script_grafico_sessao.js)
  if (typeof exportarImagemSessao === 'function') {
    exportarImagemSessao(session.id);
  } else {
    // Fallback para versão antiga caso a função nova não esteja carregada
    console.warn('[PNG] Função exportarImagemSessao não encontrada, usando método legado');

    const chartData = session.dadosTabela.map(d => [d.tempo_esp, d.newtons]);

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '800px';
    tempDiv.style.height = '600px';
    document.body.appendChild(tempDiv);

    const tempChartOptions = {
      series: [{ name: 'Força', data: chartData }],
      chart: { type: 'line', height: '100%', width: '100%', background: '#fff' },
      title: { text: 'Gráfico da Sessão: ' + session.nome, align: 'center' },
      xaxis: { title: { text: 'Tempo (s)' } },
      yaxis: { title: { text: 'Força (N)' } }
    };

    const tempChart = new ApexCharts(tempDiv, tempChartOptions);

    tempChart.render().then(() => {
      tempChart.dataURI().then(({ imgURI }) => {
        const a = document.createElement('a');
        a.href = imgURI;
        a.download = 'grafico_' + session.nome.replace(/[^a-zA-Z0-9_]/g, '_') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        tempChart.destroy();
        document.body.removeChild(tempDiv);
        showNotification('success', 'Gráfico exportado como PNG!');
      });
    });
  }
}

async function exportarJSON(sessionId, source) {
  const session = await getSessionDataForExport(sessionId, source);
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportar JSON.');
    return;
  }

  const jsonContent = JSON.stringify(session, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = session.nome.replace(/[^a-zA-Z0-9_]/g, '_') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('success', 'Arquivo JSON para "' + session.nome + '" gerado!');
}


async function getSessionDataForExport(sessionId, source) {
  let sessionData = null;
  if (source === 'local' || source === 'both') {
    const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    sessionData = localSessions.find(s => s.id === sessionId);
  }

  if (!sessionData && (source === 'db' || source === 'both')) { // Try DB if local not found or explicitly DB
    try {
      showLoading(); // Mostra loader enquanto busca dados
      
      const dbSessionResponse = await apiFetch(`/api/sessoes/${sessionId}`);
      if (!dbSessionResponse.ok) throw new Error('Falha ao carregar detalhes da sessão do DB para exportação.');
      const dbSession = await dbSessionResponse.json();

      if (dbSession) {
        const readingsResponse = await apiFetch('/api/sessoes/' + sessionId + '/leituras');
        if (readingsResponse.ok) {
          const dbReadings = await readingsResponse.json();
          dbSession.dadosTabela = dbReadings.map(r => ({
            timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
            tempo_esp: r.tempo,
            newtons: r.forca,
            grama_forca: (r.forca / 9.80665 * 1000),
            quilo_forca: (r.forca / 9.80665)
          }));
        }
      }
      
      hideLoading(); // Esconde loader após sucesso
    } catch (error) {
      hideLoading(); // Esconde loader em caso de erro
      console.error('Erro ao buscar sessão do DB para exportação:', error);
      showNotification('error', 'Erro ao carregar sessão ' + sessionId + ' do DB para exportação.');
      return null;
    }
  }
  
  // Se carregou localmente, esconde o loader também
  if (sessionData && !source.includes('db')) {
    hideLoading();
  }
  
  return sessionData;
}
// Visualiza uma sessão salva (gráfico + tabela) garantindo eixo X numérico e ordenado
// Localizado em script.js

// Visualiza uma sessão salva (gráfico + tabela) garantindo eixo X numérico e ordenado
async function visualizarSessao(sessionId) {
  try {
    // 1) Obter sessão (LocalStorage → API)
    const gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes') || '[]');
    let sessao = gravacoes.find(g => String(g.id) === String(sessionId));

    // Se não for encontrada localmente, tenta buscar o registro no DB
    if (!sessao) {
      try {
        const resp = await apiFetch(`/api/sessoes/${sessionId}`, { cache: 'no-store' });
        if (resp.ok) sessao = await resp.json();
      } catch (e) {
        console.error("Erro ao buscar metadados da sessão no DB:", e);
      }
    }

    // Se o registro da sessão foi encontrado (local ou DB), mas os dadosTabela estão ausentes ou vazios,
    // E a sessão *pode* estar no DB (checar se tem os campos do DB, ex: data_inicio), buscamos as leituras no DB.
    if (sessao && (!Array.isArray(sessao.dadosTabela) || sessao.dadosTabela.length === 0)) {
      // Tentativa de buscar leituras do DB, caso o registro da sessão tenha vindo da API.
      // Assumimos que a sessão é do DB se ela veio da API e não tem dadosTabela.
      try {
        const readingsResp = await apiFetch(`/api/sessoes/${sessionId}/leituras`, { cache: 'no-store' });
        if (readingsResp.ok) {
          const dbReadings = await readingsResp.json();
          sessao.dadosTabela = dbReadings.map(r => ({
            timestamp: new Date(r.timestamp).toLocaleString('pt-BR', { hour12: false }).replace(', ', ' '),
            tempo_esp: r.tempo,
            newtons: r.forca,
            grama_forca: (r.forca / 9.80665 * 1000).toFixed(3),
            quilo_forca: (r.forca / 9.80665).toFixed(6)
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar leituras da sessão no DB:", e);
        // Continua, mas com um alerta
      }
    }


    if (!sessao || !Array.isArray(sessao.dadosTabela) || sessao.dadosTabela.length === 0) {
      showNotification('error', 'Sessão não encontrada ou sem dados.');
      return;
    }

    // 2) Normalizar → [tempo: number, newtons: number], filtrar NaN e ORDENAR por tempo
    const parsed = sessao.dadosTabela
      .map(l => [Number(l.tempo_esp), Number(l.newtons)])
      .filter(([t, f]) => Number.isFinite(t) && Number.isFinite(f))
      .sort((a, b) => a[0] - b[0]);

    if (parsed.length < 2) {
      showNotification('error', 'Dados insuficientes para plotagem.');
      return;
    }

    // 3) Atualizar buffers internos e estatísticas
    rawDataN = parsed.map(([t, f]) => [t, f]); // mantém base em Newtons
    maxForceInN = Math.max(...parsed.map(p => p[1]));
    minForceInN = Math.min(...parsed.map(p => p[1]));

    // 4) Atualizar gráfico (convertendo para a unidade atual de exibição)
    const displayData = parsed.map(([t, f]) => [t, convertForce(f, displayUnit)]);
    chart.updateSeries([{ data: displayData }]);

    // 5) Atualizar textos de métricas no header, se existirem
    const forceNow = parsed[parsed.length - 1][1];
    const displayForceNow = convertForce(forceNow, displayUnit);
    const maxDisplayForce = convertForce(maxForceInN, displayUnit);
    const minDisplayForce = convertForce(minForceInN, displayUnit);

    const elAtual = document.getElementById('forca-atual');
    const elEms = document.getElementById('forca-ems');
    const elMax = document.getElementById('forca-maxima');
    const elMin = document.getElementById('forca-minima');

    if (elAtual) elAtual.textContent = displayForceNow.toFixed(3);
    if (elEms) elEms.textContent = displayForceNow.toFixed(3); // não recomputa EMA aqui
    if (elMax) elMax.textContent = maxDisplayForce.toFixed(3);
    if (elMin) elMin.textContent = `mín: ${minDisplayForce.toFixed(3)}`;

    // 6) Repopular a tabela
    const tbody = document.querySelector('#tabela tbody');
    if (tbody) {
      tbody.innerHTML = '';
      // Evita travar a UI em sessões muito grandes — renderiza em blocos
      const renderChunk = (startIdx, chunkSize = 1000) => {
        const end = Math.min(startIdx + chunkSize, parsed.length);
        const frag = document.createDocumentFragment();

        for (let i = startIdx; i < end; i++) {
          const [t, N] = parsed[i];
          const gf = (N / 9.80665) * 1000;
          const kgf = (N / 9.80665);

          const tr = document.createElement('tr');
          const ts = (sessao.dadosTabela[i] && sessao.dadosTabela[i].timestamp) || '';

          const tdTs = document.createElement('td'); tdTs.textContent = ts;
          const tdT = document.createElement('td'); tdT.textContent = t.toFixed(3);
          const tdN = document.createElement('td'); tdN.textContent = N.toFixed(6);
          const tdGf = document.createElement('td'); tdGf.textContent = gf.toFixed(3);
          const tdKgf = document.createElement('td'); tdKgf.textContent = kgf.toFixed(6);

          tr.appendChild(tdTs);
          tr.appendChild(tdT);
          tr.appendChild(tdN);
          tr.appendChild(tdGf);
          tr.appendChild(tdKgf);
          frag.appendChild(tr);
        }

        tbody.appendChild(frag);

        if (end < parsed.length) {
          // Próximo bloco na próxima iteração do event loop
          setTimeout(() => renderChunk(end, chunkSize), 0);
        }
      };

      renderChunk(0);
    }

    // 7) Ajustes visuais/UX
    // Garantir que a aba do gráfico esteja ativa para o usuário ver o resultado
    const btnAbaGrafico = document.getElementById('padrao');
    if (btnAbaGrafico && typeof abrirAba === 'function') {
      abrirAba(btnAbaGrafico, 'abaGrafico');
    }

    // Atualiza range do eixo Y para "auto" por padrão ao visualizar sessão
    if (typeof setYAxisRange === 'function') {
      setYAxisRange('auto');
    }

    showNotification('success', `Sessão "${sessao.nome || sessionId}" carregada.`);

  } catch (err) {
    console.error('Erro em visualizarSessao:', err);
    showNotification('error', 'Falha ao carregar a sessão: ' + (err && err.message ? err.message : 'erro desconhecido'));
  }
  //pausa  
  toggleChartPause(true);
}

async function exportarEng(sessionId, source) {
  const session = await getSessionDataForExport(sessionId, source); // Try both sources
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportação .ENG.');
    return;
  }

  // Aplica pontos de queima salvos pelo usuário (se existirem)
  const burnData = aplicarPontosDeQueima(session);

  if (!burnData) {
    showNotification('error', 'Erro ao processar dados da sessão.');
    return;
  }

  // Extrai metadados do motor
  const metadados = session.metadadosMotor || {};
  const nomeArquivo = (metadados.name || session.nome.replace(/[^a-zA-Z0-9_]/g, '_')) + '.eng';

  // Constrói cabeçalho no formato RASP/OpenRocket
  // Comentário com especificação dos campos
  let engContent = ';name\tdiameter\tlength\tdelay\tpropweight\ttotalweight\tmanufacturer\n';

  // Linha de metadados do motor (em mm, s, kg)
  engContent += (metadados.name || 'Motor').trim() + '\t';
  engContent += (metadados.diameter || 45).toFixed(1) + '\t';      // mm
  engContent += (metadados.length || 200).toFixed(1) + '\t';       // mm
  engContent += (metadados.delay || 0).toFixed(1) + '\t';          // s
  engContent += (metadados.propweight || 0.1).toFixed(5) + '\t';   // kg
  engContent += (metadados.totalweight || 0.25).toFixed(5) + '\t'; // kg
  engContent += (metadados.manufacturer || 'Grupo de Foguetes - Campus Gaspar IFSC').trim() + '\n';

  // Comentários informativos
  engContent += ';\n';
  engContent += '; Arquivo gerado pelo Sistema de Teste de Motores Foguete\n';
  engContent += '; Grupo de Foguetes do Campus Gaspar - IFSC\n';
  engContent += '; Projeto de Controle e Automação - Campus Gaspar IFSC 2025\n';
  engContent += '; Data: ' + new Date().toLocaleString('pt-BR') + '\n';
  engContent += '; Sessão: ' + session.nome + '\n';

  // Se houver massa de propelente, adiciona informação
  if (metadados.massaPropelente) {
    engContent += '; Massa de propelente informada: ' + metadados.massaPropelente.toFixed(2) + ' g\n';
  }

  // Informação sobre pontos de queima
  if (burnData.usandoPontosPersonalizados) {
    engContent += '; USANDO PONTOS DE QUEIMA PERSONALIZADOS\n';
    engContent += '; Início da queima: ' + burnData.startTime.toFixed(3) + ' s\n';
    engContent += '; Fim da queima: ' + burnData.endTime.toFixed(3) + ' s\n';
    engContent += '; Duração da queima: ' + burnData.duration.toFixed(3) + ' s\n';
  } else {
    engContent += '; Pontos de queima detectados automaticamente\n';
    engContent += '; Início: ' + burnData.startTime.toFixed(3) + ' s, Fim: ' + burnData.endTime.toFixed(3) + ' s\n';
  }

  engContent += '; Número de leituras (filtradas): ' + burnData.dadosFiltrados.tempos.length + '\n';
  engContent += ';\n';

  // Dados de impulso (tempo em segundos, força em Newtons) - APENAS DO INTERVALO DE QUEIMA
  // Formato: tempo(s)  força(N)
  for (let i = 0; i < burnData.dadosFiltrados.tempos.length; i++) {
    const tempo = burnData.dadosFiltrados.tempos[i];
    const newtons = burnData.dadosFiltrados.newtons[i];
    engContent += tempo.toFixed(5) + '\t' + newtons.toFixed(5) + '\n';
  }
  
  // Download do arquivo
  const blob = new Blob([engContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('success', 'Arquivo .ENG compatível com OpenRocket gerado!');
}



async function gerarRelatorioPdf(sessionId, source) {
  try {
    const session = await getSessionDataForExport(sessionId, source);
    if (!session) {
      showNotification('error', 'Sessão não encontrada para relatório PDF.');
      return;
    }

    showNotification('info', 'Gerando relatório PDF com gráfico...', 2000);

    // Aplica pontos de queima salvos pelo usuário (se existirem)
    const burnData = aplicarPontosDeQueima(session);

    if (!burnData) {
      showNotification('error', 'Erro ao processar dados da sessão.');
      return;
    }

    // Dados totais do teste (não filtrados)
    const dadosTotais = processarDadosSimples(session.dadosTabela);

    // Usa dados filtrados pelos pontos de queima
    const dados = burnData.dadosFiltrados;

    console.log('[PDF DEBUG] dados:', {
      tempos: dados.tempos?.length,
      newtons: dados.newtons?.length,
      hasTempos: !!dados.tempos,
      hasNewtons: !!dados.newtons
    });

    if (!dados.tempos || !dados.newtons || dados.tempos.length === 0) {
      showNotification('error', 'Dados filtrados estão vazios ou inválidos.');
      return;
    }

    const impulsoData = calcularAreaSobCurva(dados.tempos, dados.newtons, false);

  // Obtém massa do propelente em kg (converte de gramas se necessário)
  let massaPropelente = null;
  if (session.metadadosMotor && session.metadadosMotor.massaPropelente) {
    massaPropelente = session.metadadosMotor.massaPropelente / 1000; // Converte de gramas para kg
  }

  const metricasPropulsao = calcularMetricasPropulsao(impulsoData, massaPropelente);

  // Adiciona informação sobre pontos personalizados
  const burnInfo = {
    usandoPontosPersonalizados: burnData.usandoPontosPersonalizados,
    startTime: burnData.startTime,
    endTime: burnData.endTime,
    duration: burnData.endTime - burnData.startTime
  };

  // Cria uma cópia temporária da sessão com dados filtrados
  const sessionParaPDF = { ...session };

  console.log('[PDF DEBUG] session.dadosTabela:', session.dadosTabela?.length, 'items');
  console.log('[PDF DEBUG] burnData times:', burnData.startTime, 'to', burnData.endTime);

  sessionParaPDF.dadosTabela = session.dadosTabela.filter(d => {
    const tempo = parseFloat(d.tempo_esp) || 0;
    return tempo >= burnData.startTime && tempo <= burnData.endTime;
  });

  console.log('[PDF DEBUG] sessionParaPDF.dadosTabela filtered:', sessionParaPDF.dadosTabela?.length, 'items');

  if (!sessionParaPDF.dadosTabela || sessionParaPDF.dadosTabela.length === 0) {
    showNotification('error', 'Nenhum dado encontrado no intervalo de queima.');
    return;
  }

  // Gera o gráfico em canvas e converte para imagem
  gerarGraficoParaPDF(sessionParaPDF, dados, impulsoData, metricasPropulsao, (imagemBase64) => {
    // Cria janela de impressão com o gráfico
    const printWindow = window.open('', '_blank');

    // Gera HTML do relatório COM a imagem do gráfico
    const html = gerarHTMLRelatorioCompleto(sessionParaPDF, dados, impulsoData, metricasPropulsao, imagemBase64, burnInfo, dadosTotais);

    printWindow.document.write(html);
    printWindow.document.close();

    showNotification('success', 'Relatório PDF gerado com sucesso!', 3000);
  });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    showNotification('error', 'Erro ao gerar PDF: ' + error.message);
  }
}

async function exportarCSV(sessionId, source) {
  const session = await getSessionDataForExport(sessionId, source);
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportação CSV.');
    return;
  }

  let csvContent = "Timestamp,Tempo ESP (s),Newtons (N),Grama-força (gf),Quilo-força (kgf)\n";
  session.dadosTabela.forEach(leitura => {
    csvContent += leitura.timestamp + ',' + leitura.tempo_esp + ',' + leitura.newtons + ',' + leitura.grama_forca + ',' + leitura.quilo_forca + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = session.nome.replace(/[^a-zA-Z0-9_]/g, '_') + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('success', 'Arquivo CSV para "' + session.nome + '" gerado!');
}

function deleteLocalSession(sessionId) {
  if (!confirm('Tem certeza que deseja excluir a sessão ' + sessionId + ' do Local Storage?')) {
    return;
  }
  let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  gravacoes = gravacoes.filter(s => s.id !== sessionId);
  localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
  showNotification('success', 'Sessão ' + sessionId + ' excluída do Local Storage.');
  loadAndDisplayAllSessions(); // Re-render the list
}

async function deleteDbSession(sessionId) {
  if (!confirm('Tem certeza que deseja excluir a sessão ' + sessionId + ' do banco de dados? Esta ação não pode ser desfeita.')) {
    return;
  }
  try {
    const response = await apiFetch(`/api/sessoes/${sessionId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao excluir a sessão do DB.');

    showNotification('success', 'Sessão ' + sessionId + ' excluída do banco de dados.');
    loadAndDisplayAllSessions(); // Re-render the list
  } catch (error) {
    console.error('Erro ao excluir sessão do DB:', error);
    showNotification('error', 'Erro ao excluir a sessão ' + sessionId + ' do DB.');
  }
}

async function saveDbSessionToLocal(sessionId) {
  try {
    // Fetch session details from DB
    const dbSessionResponse = await apiFetch('/api/sessoes');
    if (!dbSessionResponse.ok) throw new Error('Falha ao carregar detalhes da sessão do DB para salvar localmente.');
    const allDbSessions = await dbSessionResponse.json();
    const dbSession = allDbSessions.find(s => s.id === sessionId);

    if (!dbSession) {
      showNotification('error', 'Sessão do DB não encontrada para salvar localmente.');
      return;
    }

    // Fetch readings from DB
    const readingsResponse = await apiFetch('/api/sessoes/' + sessionId + '/leituras');
    if (!readingsResponse.ok) throw new Error('Falha ao carregar leituras do DB para salvar localmente.');
    const dbReadings = await readingsResponse.json();

    const gravacao = {
      id: dbSession.id,
      nome: dbSession.nome,
      timestamp: dbSession.data_inicio,
      data_inicio: dbSession.data_inicio,
      data_fim: dbSession.data_fim,
      data_modificacao: dbSession.data_modificacao || new Date().toISOString(),
      dadosTabela: dbReadings.map(r => ({
        timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
        tempo_esp: r.tempo,
        newtons: r.forca,
        grama_forca: (r.forca / 9.80665 * 1000),
        quilo_forca: (r.forca / 9.80665)
      })),
      metadadosMotor: dbSession.metadadosMotor || {},
      burnMetadata: dbSession.burnMetadata || {},
      savedToMysql: true // Mark as saved to MySQL since it came from there
    };

    let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    // Check if already exists in local storage to avoid duplicates
    const existingIndex = gravacoes.findIndex(s => s.id === sessionId);
    if (existingIndex === -1) {
      gravacoes.push(gravacao);
      showNotification('success', 'Sessão "' + dbSession.nome + '" salva localmente!');
    } else {
      // Atualiza a sessão existente
      gravacoes[existingIndex] = gravacao;
      showNotification('success', 'Sessão "' + dbSession.nome + '" atualizada localmente!');
    }
    localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
    loadAndDisplayAllSessions(); // Re-render to update status

  } catch (error) {
    console.error('Erro ao salvar sessão do DB localmente:', error);
    showNotification('error', 'Erro ao salvar sessão ' + sessionId + ' localmente.');
  }
}

async function saveLocalSessionToDb(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const sessionToSave = localSessions.find(s => s.id === sessionId);

  if (!sessionToSave) {
    showNotification('error', 'Sessão local não encontrada para salvar no DB.');
    return;
  }

  if (isMysqlConnected) {
    showNotification('info', 'Enviando sessão "' + sessionToSave.nome + '" para o MySQL...');
    sendCommandToWorker('save_session_to_mysql', sessionToSave);
    // The worker will send back mysql_save_success/error, which will trigger loadAndDisplayAllSessions
  } else {
    showNotification('error', 'Não foi possível salvar no MySQL: Banco de dados desconectado.');
  }
}

async function resolverConflito(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const localSession = localSessions.find(s => s.id === sessionId);

  let dbSession = null;
  try {
    const resp = await apiFetch(`/api/sessoes/${sessionId}`);
    if (resp.ok) {
      dbSession = await resp.json();
    }
  } catch (e) {
    console.error('Erro ao buscar sessão do DB:', e);
    showNotification('error', 'Erro ao buscar dados do banco para comparação.');
    return;
  }

  if (!localSession || !dbSession) {
    showNotification('error', 'Não foi possível carregar ambas as versões para comparação.');
    return;
  }

  const localDate = localSession.data_modificacao ? new Date(localSession.data_modificacao).toLocaleString('pt-BR') : 'Desconhecida';
  const dbDate = dbSession.data_modificacao ? new Date(dbSession.data_modificacao).toLocaleString('pt-BR') : 'Desconhecida';

  // Metadados do motor para comparação
  const localMeta = localSession.metadadosMotor || {};
  const dbMeta = dbSession.metadadosMotor || {};

  const formatMetaValue = (val) => val !== undefined && val !== null && val !== '' ? val : 'N/D';

  const metadadosLocalHtml = `
    <div style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.85rem;">
      <strong style="color: #3498db;">🚀 Metadados do Motor:</strong>
      <div style="margin-top: 5px; line-height: 1.6;">
        <div><strong>Nome:</strong> ${formatMetaValue(localMeta.name)}</div>
        <div><strong>Diâmetro:</strong> ${formatMetaValue(localMeta.diameter)} mm</div>
        <div><strong>Comprimento:</strong> ${formatMetaValue(localMeta.length)} mm</div>
        <div><strong>Delay:</strong> ${formatMetaValue(localMeta.delay)} s</div>
        <div><strong>Peso Propelente:</strong> ${formatMetaValue(localMeta.propweight)} kg</div>
        <div><strong>Peso Total:</strong> ${formatMetaValue(localMeta.totalweight)} kg</div>
        <div><strong>Fabricante:</strong> ${formatMetaValue(localMeta.manufacturer)}</div>
        ${localMeta.description ? `<div style="margin-top: 5px;"><strong>Descrição:</strong> ${localMeta.description}</div>` : ''}
        ${localMeta.observations ? `<div style="margin-top: 5px;"><strong>Observações:</strong> ${localMeta.observations}</div>` : ''}
      </div>
    </div>
  `;

  const metadadosDbHtml = `
    <div style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.85rem;">
      <strong style="color: #9b59b6;">🚀 Metadados do Motor:</strong>
      <div style="margin-top: 5px; line-height: 1.6;">
        <div><strong>Nome:</strong> ${formatMetaValue(dbMeta.name)}</div>
        <div><strong>Diâmetro:</strong> ${formatMetaValue(dbMeta.diameter)} mm</div>
        <div><strong>Comprimento:</strong> ${formatMetaValue(dbMeta.length)} mm</div>
        <div><strong>Delay:</strong> ${formatMetaValue(dbMeta.delay)} s</div>
        <div><strong>Peso Propelente:</strong> ${formatMetaValue(dbMeta.propweight)} kg</div>
        <div><strong>Peso Total:</strong> ${formatMetaValue(dbMeta.totalweight)} kg</div>
        <div><strong>Fabricante:</strong> ${formatMetaValue(dbMeta.manufacturer)}</div>
        ${dbMeta.description ? `<div style="margin-top: 5px;"><strong>Descrição:</strong> ${dbMeta.description}</div>` : ''}
        ${dbMeta.observations ? `<div style="margin-top: 5px;"><strong>Observações:</strong> ${dbMeta.observations}</div>` : ''}
      </div>
    </div>
  `;

  const modalHtml = `
    <div id="modal-conflito" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
      <div style="background: var(--cor-fundo); padding: 30px; border-radius: 12px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <h2 style="margin-top: 0; color: #e74c3c;">⚠️ Conflito de Sincronização Detectado</h2>
        <p style="color: var(--cor-texto); margin-bottom: 15px;">
          A sessão "<strong>${localSession.nome}</strong>" possui versões diferentes no LocalStorage e no Banco de Dados.
          Escolha qual versão deseja manter:
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
          <div style="border: 2px solid #3498db; border-radius: 8px; padding: 15px; background: rgba(52, 152, 219, 0.1);">
            <h3 style="margin-top: 0; color: #3498db; font-size: 1.1rem;">💾 Versão Local</h3>
            <p style="margin: 5px 0;"><strong>Modificada em:</strong> ${localDate}</p>
            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--cor-texto-secundario);">
              Dados salvos no navegador deste dispositivo.
            </p>
            ${metadadosLocalHtml}
            <button onclick="resolverConflito_UsarLocal(${sessionId})" class="btn btn-primario" style="width: 100%; margin-top: 10px;">
              ✓ Usar Versão Local
            </button>
          </div>

          <div style="border: 2px solid #9b59b6; border-radius: 8px; padding: 15px; background: rgba(155, 89, 182, 0.1);">
            <h3 style="margin-top: 0; color: #9b59b6; font-size: 1.1rem;">☁️ Versão do Banco</h3>
            <p style="margin: 5px 0;"><strong>Modificada em:</strong> ${dbDate}</p>
            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--cor-texto-secundario);">
              Dados salvos no banco de dados (sincronizados).
            </p>
            ${metadadosDbHtml}
            <button onclick="resolverConflito_UsarDB(${sessionId})" class="btn btn-secundario" style="width: 100%; margin-top: 10px;">
              ✓ Usar Versão do Banco
            </button>
          </div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button onclick="fecharModalConflito()" class="btn btn-perigo">✗ Cancelar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharModalConflito() {
  const modal = document.getElementById('modal-conflito');
  if (modal) modal.remove();
}

async function resolverConflito_UsarLocal(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const localSession = localSessions.find(s => s.id === sessionId);

  if (!localSession) {
    showNotification('error', 'Sessão local não encontrada.');
    fecharModalConflito();
    return;
  }

  // Atualiza data de modificação e envia para o banco
  localSession.data_modificacao = new Date().toISOString();

  // Atualiza no localStorage
  const sessionIndex = localSessions.findIndex(s => s.id === sessionId);
  localSessions[sessionIndex] = localSession;
  localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));

  if (isMysqlConnected) {
    sendCommandToWorker('save_session_to_mysql', localSession);
    showNotification('success', 'Versão local enviada para o banco de dados.');
  } else {
    showNotification('warning', 'MySQL desconectado. Versão local mantida, mas não sincronizada.');
  }

  fecharModalConflito();
  setTimeout(() => loadAndDisplayAllSessions(), 500);
}

async function resolverConflito_UsarDB(sessionId) {
  try {
    const resp = await apiFetch(`/api/sessoes/${sessionId}`);
    if (!resp.ok) {
      throw new Error('Erro ao buscar sessão do banco');
    }

    const dbSession = await resp.json();

    // Busca as leituras
    const readingsResp = await apiFetch(`/api/sessoes/${sessionId}/leituras`);
    if (readingsResp.ok) {
      const dbReadings = await readingsResp.json();
      dbSession.dadosTabela = dbReadings.map(r => ({
        timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
        tempo_esp: r.tempo,
        newtons: r.forca,
        grama_forca: (r.forca / 9.80665 * 1000),
        quilo_forca: (r.forca / 9.80665)
      }));
    }

    // Normaliza os campos
    if (dbSession.data_inicio && !dbSession.timestamp) {
      dbSession.timestamp = dbSession.data_inicio;
    }
    if (!dbSession.data_modificacao) {
      dbSession.data_modificacao = new Date().toISOString();
    }

    // Atualiza no localStorage
    const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    const sessionIndex = localSessions.findIndex(s => s.id === sessionId);

    if (sessionIndex !== -1) {
      localSessions[sessionIndex] = dbSession;
    } else {
      localSessions.push(dbSession);
    }

    localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));
    showNotification('success', 'Versão do banco baixada para o LocalStorage.');

    fecharModalConflito();
    setTimeout(() => loadAndDisplayAllSessions(), 500);

  } catch (error) {
    console.error('Erro ao buscar sessão do DB:', error);
    showNotification('error', 'Erro ao baixar versão do banco de dados.');
    fecharModalConflito();
  }
}

async function importarGravacaoExterna() {
  const fileInput = document.getElementById('importar-arquivo-motor');
  const nomeImportacaoInput = document.getElementById('nome-importacao');
  const file = fileInput.files[0];
  const nome = nomeImportacaoInput.value.trim();

  if (!file || !nome) {
    showNotification('error', 'Por favor, selecione um arquivo e insira um nome para a importação.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    const linhas = content.split('\n').filter(line => line.trim() !== '');
    const dadosTabela = linhas.map((linha, index) => {
      const partes = linha.trim().split(/\s+/);
      if (partes.length >= 2) {
        return {
          timestamp: new Date(Date.now() + index).toLocaleString('pt-BR', { hour12: false }).replace(', ', ' '), // Unique timestamp
          tempo_esp: parseFloat(partes[0]),
          newtons: parseFloat(partes[1]),
          grama_forca: parseFloat(partes[1]) / 9.80665 * 1000,
          quilo_forca: parseFloat(partes[1]) / 9.80665
        };
      }
      return null;
    }).filter(Boolean);

    if (dadosTabela.length === 0) {
      showNotification('error', 'Nenhum dado válido encontrado no arquivo importado.');
      return;
    }

    const gravacao = {
      id: Date.now(),
      nome: nome,
      timestamp: new Date().toISOString(),
      data_modificacao: new Date().toISOString(),
      dadosTabela: dadosTabela,
      metadadosMotor: {},
      source: 'local', // Initially local
      inLocal: true,
      inDb: false
    };

    try {
      let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
      gravacoes.push(gravacao);
      localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
      showNotification('success', 'Sessão "' + nome + '" importada e salva localmente!');

      // Also save to DB if connected
      if (isMysqlConnected) {
        showNotification('info', 'Enviando sessão importada "' + nome + '" para o MySQL...');
        sendCommandToWorker('save_session_to_mysql', gravacao);
      }

      loadAndDisplayAllSessions(); // Re-render the list
      fileInput.value = '';
      nomeImportacaoInput.value = '';
    } catch (e) {
      showNotification('error', 'Erro ao salvar importação. O Local Storage pode estar cheio.');
    }
  };
  reader.readAsText(file);
}

// --- Função para Importar Gravação JSON Exportada ---
async function importarGravacaoJSON() {
  const fileInput = document.getElementById('importar-json');
  const file = fileInput.files[0];

  if (!file) {
    showNotification('error', 'Por favor, selecione um arquivo JSON para importar.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const gravacaoImportada = JSON.parse(content);

      // Validar estrutura básica do JSON
      if (!gravacaoImportada.nome || !gravacaoImportada.dadosTabela || !Array.isArray(gravacaoImportada.dadosTabela)) {
        showNotification('error', 'Arquivo JSON inválido. Certifique-se de que é uma exportação válida.');
        return;
      }

      // Gerar novo ID e atualizar timestamps
      const novaGravacao = {
        ...gravacaoImportada,
        id: Date.now(), // Novo ID único
        data_modificacao: new Date().toISOString(),
        source: 'local', // Marcar como local
        inLocal: true,
        inDb: false
      };

      // Se não tiver timestamp, adicionar
      if (!novaGravacao.timestamp) {
        novaGravacao.timestamp = new Date().toISOString();
      }

      // Salvar no localStorage
      let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
      
      // Verificar se já existe uma gravação com o mesmo nome
      const nomeExistente = gravacoes.some(g => g.nome === novaGravacao.nome);
      if (nomeExistente) {
        const confirmar = confirm(`Já existe uma gravação com o nome "${novaGravacao.nome}". Deseja importar mesmo assim com um nome diferente?`);
        if (confirmar) {
          novaGravacao.nome = `${novaGravacao.nome} (importada ${new Date().toLocaleTimeString('pt-BR')})`;
        } else {
          fileInput.value = '';
          return;
        }
      }

      gravacoes.push(novaGravacao);
      localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
      
      showNotification('success', `Gravação "${novaGravacao.nome}" importada com sucesso! (${novaGravacao.dadosTabela.length} pontos)`);

      // Também salvar no MySQL se conectado
      if (isMysqlConnected) {
        showNotification('info', `Enviando gravação "${novaGravacao.nome}" para o MySQL...`);
        sendCommandToWorker('save_session_to_mysql', novaGravacao);
      }

      // Recarregar lista de gravações
      loadAndDisplayAllSessions();
      fileInput.value = '';

    } catch (error) {
      console.error('Erro ao importar JSON:', error);
      showNotification('error', `Erro ao importar arquivo JSON: ${error.message}`);
      fileInput.value = '';
    }
  };
  
  reader.readAsText(file);
}

// --- Funções do Relógio do Servidor ---

async function updateServerClock() {
  try {
    const response = await apiFetch('/api/time');
    if (response.ok) {
      const data = await response.json();
      const serverTime = new Date(data.time);
      const clientTime = new Date();

      // Calcula o offset entre servidor e cliente
      serverTimeOffset = serverTime.getTime() - clientTime.getTime();

      // Atualiza o display
      updateClockDisplay();
    }
  } catch (error) {
    console.error('Erro ao buscar hora do servidor:', error);
    document.getElementById('server-clock').textContent = 'Erro';
  }
}

function updateClockDisplay() {
  // Cria um Date object com a hora do servidor ajustada
  const now = new Date(Date.now() + serverTimeOffset);
  
  // getHours(), getMinutes(), getSeconds() já retornam no timezone LOCAL do navegador
  // Isso está correto! Se o servidor está em UTC e retorna 10:00, e o navegador
  // está em GMT-3, o Date object automaticamente mostra 07:00 localmente
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const clockElement = document.getElementById('server-clock');
  if (clockElement) {
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

async function syncServerTime() {
  // Pega a hora LOCAL do navegador (a hora real que o usuário está vendo)
  const clientTime = new Date();
  
  // Obtém o timezone offset do cliente em minutos (diferença em relação a UTC)
  const timezoneOffset = clientTime.getTimezoneOffset(); // Retorna em minutos
  const timezoneOffsetSeconds = timezoneOffset * 60; // Converter para segundos
  
  // Obtém o nome do timezone do cliente
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Formata a hora local para exibição (HH:MM:SS)
  const hours = String(clientTime.getHours()).padStart(2, '0');
  const minutes = String(clientTime.getMinutes()).padStart(2, '0');
  const seconds = String(clientTime.getSeconds()).padStart(2, '0');
  const displayedTime = `${hours}:${minutes}:${seconds}`;
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Delay (s)</label>
            <input type="number" id="meta-delay" value="${meta.delay || 0}" step="0.1" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Prop. (kg)</label>
            <input type="number" id="meta-propweight" value="${meta.propweight || 0.1}" step="0.001" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Total (kg)</label>
            <input type="number" id="meta-totalweight" value="${meta.totalweight || 0.25}" step="0.001" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">🌡️ Temp. (°C)</label>
            <input type="number" id="meta-temperatura" value="${meta.temperatura !== undefined && meta.temperatura !== null ? meta.temperatura : ''}" step="0.1" placeholder="25.5" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">💧 Umid. (%)</label>
            <input type="number" id="meta-umidade" value="${meta.umidade !== undefined && meta.umidade !== null ? meta.umidade : ''}" min="0" max="100" step="0.1" placeholder="65" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">Fabricante</label>
            <input type="text" id="meta-manufacturer" value="${meta.manufacturer || 'GFIG - Campus Gaspar IFSC'}" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">🔵 Pressão (hPa)</label>
            <input type="number" id="meta-pressao" value="${meta.pressao !== undefined && meta.pressao !== null ? meta.pressao : ''}" step="0.01" placeholder="1013.25" style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px;">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">📝 Descrição</label>
            <textarea id="meta-description" placeholder="Descrição do motor..." style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px; min-height: 60px; resize: vertical; font-family: inherit;">${meta.description || ''}</textarea>
          </div>
          <div>
            <label style="display: block; margin-bottom: 0.2rem; font-weight: 600; font-size: 0.85rem;">💬 Observações</label>
            <textarea id="meta-observations" placeholder="Observações do teste..." style="width: 100%; padding: 0.4rem; border: 1px solid var(--cor-borda); border-radius: 4px; min-height: 60px; resize: vertical; font-family: inherit;">${meta.observations || ''}</textarea>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.75rem;">
          <button onclick="fecharModalMetadados()" class="btn btn-secundario">Cancelar</button>
          <button onclick="salvarMetadadosMotor(${sessionId})" class="btn btn-sucesso">💾 Salvar Metadados</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharModalMetadados() {
  const modal = document.getElementById('modal-metadados');
  if (modal) modal.remove();
}

async function salvarMetadadosMotor(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const sessionIndex = localSessions.findIndex(s => s.id === sessionId);

  // Captura os valores do formulário
  const metadadosMotor = {
    name: document.getElementById('meta-name').value.trim(),
    manufacturer: document.getElementById('meta-manufacturer').value.trim(),
    diameter: parseFloat(document.getElementById('meta-diameter').value) || 45,
    length: parseFloat(document.getElementById('meta-length').value) || 200,
    delay: parseFloat(document.getElementById('meta-delay').value) || 0,
    propweight: parseFloat(document.getElementById('meta-propweight').value) || 0.1,
    totalweight: parseFloat(document.getElementById('meta-totalweight').value) || 0.25,
    description: document.getElementById('meta-description').value.trim(),
    observations: document.getElementById('meta-observations').value.trim(),
    temperatura: document.getElementById('meta-temperatura').value ? parseFloat(document.getElementById('meta-temperatura').value) : null,
    umidade: document.getElementById('meta-umidade').value ? parseFloat(document.getElementById('meta-umidade').value) : null,
    pressao: document.getElementById('meta-pressao').value ? parseFloat(document.getElementById('meta-pressao').value) : null
  };

  let sessionToUpdate = null;
  let isInLocal = sessionIndex !== -1;

  // Se existe localmente, atualiza no local storage

  if (isInLocal) {
    localSessions[sessionIndex].metadadosMotor = metadadosMotor;
    localSessions[sessionIndex].data_modificacao = new Date().toISOString();
    sessionToUpdate = localSessions[sessionIndex];

    try {
      localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));
      showNotification('success', 'Metadados do motor salvos localmente!');
    } catch (e) {
      showNotification('error', 'Erro ao salvar metadados localmente: ' + e.message);
      fecharModalMetadados();
      return;
    }
  }

  // Se não está localmente, busca do DB para ter os dados completos
  if (!sessionToUpdate) {
    try {
      const resp = await apiFetch(`/api/sessoes/${sessionId}`);
      if (resp.ok) {
        sessionToUpdate = await resp.json();
        sessionToUpdate.metadadosMotor = metadadosMotor;

        // Normaliza campos do DB para o formato esperado pelo worker
        if (sessionToUpdate.data_inicio && !sessionToUpdate.timestamp) {
          sessionToUpdate.timestamp = sessionToUpdate.data_inicio;
        }
        if (!sessionToUpdate.nome) {
          sessionToUpdate.nome = 'Sessão ' + sessionId;
        }
      }
    } catch (e) {
      console.error('Erro ao buscar sessão do DB:', e);
    }
  } else {
    // Atualiza os metadados na sessão local se já temos ela
    sessionToUpdate.metadadosMotor = metadadosMotor;
  }

  // Tenta salvar no DB se MySQL está conectado e temos a sessão
  if (isMysqlConnected && sessionToUpdate) {
    // Busca as leituras se não estiverem presentes
    if (!sessionToUpdate.dadosTabela || sessionToUpdate.dadosTabela.length === 0) {
      try {
        const readingsResp = await apiFetch(`/api/sessoes/${sessionId}/leituras`);
        if (readingsResp.ok) {
          const dbReadings = await readingsResp.json();
          sessionToUpdate.dadosTabela = dbReadings.map(r => ({
            timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
            tempo_esp: r.tempo,
            newtons: r.forca,
            grama_forca: (r.forca / 9.80665 * 1000),
            quilo_forca: (r.forca / 9.80665)
          }));
        }
      } catch (e) {
        console.warn('Não foi possível carregar leituras:', e);
      }
    }

    console.log('Enviando para o banco:', sessionToUpdate); // Debug
    sendCommandToWorker('save_session_to_mysql', sessionToUpdate);
    showNotification('info', 'Atualizando metadados no banco de dados...');
  } else if (!isMysqlConnected) {
    showNotification('warning', 'MySQL desconectado. Metadados salvos apenas localmente.');
  }

  fecharModalMetadados();

  // Recarrega a lista para mostrar os novos metadados
  setTimeout(() => loadAndDisplayAllSessions(), 500);
}


async function exportarPNG(sessionId, source) {
  // NOVA VERSÃO: Usa o sistema avançado de exportação PNG com configurações
  showNotification('info', 'Gerando relatório PNG com análise de propulsão...');

  const session = await getSessionDataForExport(sessionId, source);
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportar PNG.');
    return;
  }

  // Chama a função avançada de exportação PNG (de script_grafico_sessao.js)
  if (typeof exportarImagemSessao === 'function') {
    exportarImagemSessao(session.id);
  } else {
    // Fallback para versão antiga caso a função nova não esteja carregada
    console.warn('[PNG] Função exportarImagemSessao não encontrada, usando método legado');

    const chartData = session.dadosTabela.map(d => [d.tempo_esp, d.newtons]);

    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.width = '800px';
    tempDiv.style.height = '600px';
    document.body.appendChild(tempDiv);

    const tempChartOptions = {
      series: [{ name: 'Força', data: chartData }],
      chart: { type: 'line', height: '100%', width: '100%', background: '#fff' },
      title: { text: 'Gráfico da Sessão: ' + session.nome, align: 'center' },
      xaxis: { title: { text: 'Tempo (s)' } },
      yaxis: { title: { text: 'Força (N)' } }
    };

    const tempChart = new ApexCharts(tempDiv, tempChartOptions);

    tempChart.render().then(() => {
      tempChart.dataURI().then(({ imgURI }) => {
        const a = document.createElement('a');
        a.href = imgURI;
        a.download = 'grafico_' + session.nome.replace(/[^a-zA-Z0-9_]/g, '_') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        tempChart.destroy();
        document.body.removeChild(tempDiv);
        showNotification('success', 'Gráfico exportado como PNG!');
      });
    });
  }
}

async function exportarJSON(sessionId, source) {
  const session = await getSessionDataForExport(sessionId, source);
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportar JSON.');
    return;
  }

  const jsonContent = JSON.stringify(session, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = session.nome.replace(/[^a-zA-Z0-9_]/g, '_') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('success', 'Arquivo JSON para "' + session.nome + '" gerado!');
}


async function getSessionDataForExport(sessionId, source) {
  let sessionData = null;
  if (source === 'local' || source === 'both') {
    const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    sessionData = localSessions.find(s => s.id === sessionId);
  }

  if (!sessionData && (source === 'db' || source === 'both')) { // Try DB if local not found or explicitly DB
    try {
      showLoading(); // Mostra loader enquanto busca dados
      
      const dbSessionResponse = await apiFetch(`/api/sessoes/${sessionId}`);
      if (!dbSessionResponse.ok) throw new Error('Falha ao carregar detalhes da sessão do DB para exportação.');
      const dbSession = await dbSessionResponse.json();

      if (dbSession) {
        const readingsResponse = await apiFetch('/api/sessoes/' + sessionId + '/leituras');
        if (!readingsResponse.ok) throw new Error('Falha ao carregar leituras do DB para exportação.');
        const dbReadings = await readingsResponse.json();

        sessionData = {
          id: dbSession.id,
          nome: dbSession.nome,
          timestamp: dbSession.data_inicio,
          data_inicio: dbSession.data_inicio,
          data_fim: dbSession.data_fim,
          data_modificacao: dbSession.data_modificacao || new Date().toISOString(),
          dadosTabela: dbReadings.map(r => ({
            timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
            tempo_esp: r.tempo,
            newtons: r.forca,
            grama_forca: (r.forca / 9.80665 * 1000),
            quilo_forca: (r.forca / 9.80665)
          })),
          metadadosMotor: dbSession.metadadosMotor || {},
          burnMetadata: dbSession.burnMetadata || {},
          savedToMysql: true
        };
      }
      
      hideLoading(); // Esconde loader após sucesso
    } catch (error) {
      hideLoading(); // Esconde loader em caso de erro
      console.error('Erro ao buscar sessão do DB para exportação:', error);
      showNotification('error', 'Erro ao carregar sessão ' + sessionId + ' do DB para exportação.');
      return null;
    }
  }
  
  // Se carregou localmente, esconde o loader também
  if (sessionData && !source.includes('db')) {
    hideLoading();
  }
  
  return sessionData;
}
// Visualiza uma sessão salva (gráfico + tabela) garantindo eixo X numérico e ordenado
// Localizado em script.js

// ... (resto do código)

// Visualiza uma sessão salva (gráfico + tabela) garantindo eixo X numérico e ordenado
async function visualizarSessao(sessionId) {
  try {
    // 1) Obter sessão (LocalStorage → API)
    const gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes') || '[]');
    let sessao = gravacoes.find(g => String(g.id) === String(sessionId));

    // Se não for encontrada localmente, tenta buscar o registro no DB
    if (!sessao) {
      try {
        const resp = await apiFetch(`/api/sessoes/${sessionId}`, { cache: 'no-store' });
        if (resp.ok) sessao = await resp.json();
      } catch (e) {
        console.error("Erro ao buscar metadados da sessão no DB:", e);
      }
    }

    // Se o registro da sessão foi encontrado (local ou DB), mas os dadosTabela estão ausentes ou vazios,
    // E a sessão *pode* estar no DB (checar se tem os campos do DB, ex: data_inicio), buscamos as leituras no DB.
    if (sessao && (!Array.isArray(sessao.dadosTabela) || sessao.dadosTabela.length === 0)) {
      // Tentativa de buscar leituras do DB, caso o registro da sessão tenha vindo da API.
      // Assumimos que a sessão é do DB se ela veio da API e não tem dadosTabela.
      try {
        const readingsResp = await apiFetch(`/api/sessoes/${sessionId}/leituras`, { cache: 'no-store' });
        if (readingsResp.ok) {
          const dbReadings = await readingsResp.json();

          // Anexa os dados lidos do DB ao objeto 'sessao'
          sessao.dadosTabela = dbReadings.map(r => ({
            timestamp: new Date(r.timestamp).toLocaleString('pt-BR', { hour12: false }).replace(', ', ' '),
            tempo_esp: r.tempo,
            newtons: r.forca,
            grama_forca: (r.forca / 9.80665 * 1000).toFixed(3),
            quilo_forca: (r.forca / 9.80665).toFixed(6)
          }));
        }
      } catch (e) {
        console.error("Erro ao buscar leituras da sessão no DB:", e);
        // Continua, mas com um alerta
      }
    }


    if (!sessao || !Array.isArray(sessao.dadosTabela) || sessao.dadosTabela.length === 0) {
      showNotification('error', 'Sessão não encontrada ou sem dados.');
      return;
    }

    // 2) Normalizar → [tempo: number, newtons: number], filtrar NaN e ORDENAR por tempo
    const parsed = sessao.dadosTabela
      .map(l => [Number(l.tempo_esp), Number(l.newtons)])
      .filter(([t, f]) => Number.isFinite(t) && Number.isFinite(f))
      .sort((a, b) => a[0] - b[0]);

    if (parsed.length < 2) {
      showNotification('error', 'Dados insuficientes para plotagem.');
      return;
    }

    // 3) Atualizar buffers internos e estatísticas
    rawDataN = parsed.map(([t, f]) => [t, f]); // mantém base em Newtons
    maxForceInN = Math.max(...parsed.map(p => p[1]));
    minForceInN = Math.min(...parsed.map(p => p[1]));

    // 4) Atualizar gráfico (convertendo para a unidade atual de exibição)
    const displayData = parsed.map(([t, f]) => [t, convertForce(f, displayUnit)]);
    chart.updateSeries([{ data: displayData }]);

    // 5) Atualizar textos de métricas no header, se existirem
    const forceNow = parsed[parsed.length - 1][1];
    const displayForceNow = convertForce(forceNow, displayUnit);
    const maxDisplayForce = convertForce(maxForceInN, displayUnit);
    const minDisplayForce = convertForce(minForceInN, displayUnit);

    const elAtual = document.getElementById('forca-atual');
    const elEms = document.getElementById('forca-ems');
    const elMax = document.getElementById('forca-maxima');
    const elMin = document.getElementById('forca-minima');

    if (elAtual) elAtual.textContent = displayForceNow.toFixed(3);
    if (elEms) elEms.textContent = displayForceNow.toFixed(3); // não recomputa EMA aqui
    if (elMax) elMax.textContent = maxDisplayForce.toFixed(3);
    if (elMin) elMin.textContent = `mín: ${minDisplayForce.toFixed(3)}`;

    // 6) Repopular a tabela
    const tbody = document.querySelector('#tabela tbody');
    if (tbody) {
      tbody.innerHTML = '';
      // Evita travar a UI em sessões muito grandes — renderiza em blocos
      const renderChunk = (startIdx, chunkSize = 1000) => {
        const end = Math.min(startIdx + chunkSize, parsed.length);
        const frag = document.createDocumentFragment();

        for (let i = startIdx; i < end; i++) {
          const [t, N] = parsed[i];
          const gf = (N / 9.80665) * 1000;
          const kgf = (N / 9.80665);

          const tr = document.createElement('tr');
          const ts = (sessao.dadosTabela[i] && sessao.dadosTabela[i].timestamp) || '';

          const tdTs = document.createElement('td'); tdTs.textContent = ts;
          const tdT = document.createElement('td'); tdT.textContent = t.toFixed(3);
          const tdN = document.createElement('td'); tdN.textContent = N.toFixed(6);
          const tdGf = document.createElement('td'); tdGf.textContent = gf.toFixed(3);
          const tdKgf = document.createElement('td'); tdKgf.textContent = kgf.toFixed(6);

          tr.appendChild(tdTs);
          tr.appendChild(tdT);
          tr.appendChild(tdN);
          tr.appendChild(tdGf);
          tr.appendChild(tdKgf);
          frag.appendChild(tr);
        }

        tbody.appendChild(frag);

        if (end < parsed.length) {
          // Próximo bloco na próxima iteração do event loop
          setTimeout(() => renderChunk(end, chunkSize), 0);
        }
      };

      renderChunk(0);
    }

    // 7) Ajustes visuais/UX
    // Garantir que a aba do gráfico esteja ativa para o usuário ver o resultado
    const btnAbaGrafico = document.getElementById('padrao');
    if (btnAbaGrafico && typeof abrirAba === 'function') {
      abrirAba(btnAbaGrafico, 'abaGrafico');
    }

    // Atualiza range do eixo Y para "auto" por padrão ao visualizar sessão
    if (typeof setYAxisRange === 'function') {
      setYAxisRange('auto');
    }

    showNotification('success', `Sessão "${sessao.nome || sessionId}" carregada.`);

  } catch (err) {
    console.error('Erro em visualizarSessao:', err);
    showNotification('error', 'Falha ao carregar a sessão: ' + (err && err.message ? err.message : 'erro desconhecido'));
  }
  //pausa  
  toggleChartPause(true);
}

async function exportarEng(sessionId, source) {
  const session = await getSessionDataForExport(sessionId, source); // Try both sources
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportação .ENG.');
    return;
  }

  // Aplica pontos de queima salvos pelo usuário (se existirem)
  const burnData = aplicarPontosDeQueima(session);

  if (!burnData) {
    showNotification('error', 'Erro ao processar dados da sessão.');
    return;
  }

  // Extrai metadados do motor
  const metadados = session.metadadosMotor || {};
  const nomeArquivo = (metadados.name || session.nome.replace(/[^a-zA-Z0-9_]/g, '_')) + '.eng';

  // Constrói cabeçalho no formato RASP/OpenRocket
  // Comentário com especificação dos campos
  let engContent = ';name\tdiameter\tlength\tdelay\tpropweight\ttotalweight\tmanufacturer\n';

  // Linha de metadados do motor (em mm, s, kg)
  engContent += (metadados.name || 'Motor').trim() + '\t';
  engContent += (metadados.diameter || 45).toFixed(1) + '\t';      // mm
  engContent += (metadados.length || 200).toFixed(1) + '\t';       // mm
  engContent += (metadados.delay || 0).toFixed(1) + '\t';          // s
  engContent += (metadados.propweight || 0.1).toFixed(5) + '\t';   // kg
  engContent += (metadados.totalweight || 0.25).toFixed(5) + '\t'; // kg
  engContent += (metadados.manufacturer || 'Grupo de Foguetes - Campus Gaspar IFSC').trim() + '\n';

  // Comentários informativos
  engContent += ';\n';
  engContent += '; Arquivo gerado pelo Sistema de Teste de Motores Foguete\n';
  engContent += '; Grupo de Foguetes do Campus Gaspar - IFSC\n';
  engContent += '; Projeto de Controle e Automação - Campus Gaspar IFSC 2025\n';
  engContent += '; Data: ' + new Date().toLocaleString('pt-BR') + '\n';
  engContent += '; Sessão: ' + session.nome + '\n';

  // Se houver massa de propelente, adiciona informação
  if (metadados.massaPropelente) {
    engContent += '; Massa de propelente informada: ' + metadados.massaPropelente.toFixed(2) + ' g\n';
  }

  // Informação sobre pontos de queima
  if (burnData.usandoPontosPersonalizados) {
    engContent += '; USANDO PONTOS DE QUEIMA PERSONALIZADOS\n';
    engContent += '; Início da queima: ' + burnData.startTime.toFixed(3) + ' s\n';
    engContent += '; Fim da queima: ' + burnData.endTime.toFixed(3) + ' s\n';
    engContent += '; Duração da queima: ' + burnData.duration.toFixed(3) + ' s\n';
  } else {
    engContent += '; Pontos de queima detectados automaticamente\n';
    engContent += '; Início: ' + burnData.startTime.toFixed(3) + ' s, Fim: ' + burnData.endTime.toFixed(3) + ' s\n';
  }

  engContent += '; Número de leituras (filtradas): ' + burnData.dadosFiltrados.tempos.length + '\n';
  engContent += ';\n';

  // Dados de impulso (tempo em segundos, força em Newtons) - APENAS DO INTERVALO DE QUEIMA
  // Formato: tempo(s)  força(N)
  for (let i = 0; i < burnData.dadosFiltrados.tempos.length; i++) {
    const tempo = burnData.dadosFiltrados.tempos[i];
    const newtons = burnData.dadosFiltrados.newtons[i];
    engContent += tempo.toFixed(5) + '\t' + newtons.toFixed(5) + '\n';
  }
  
  // Download do arquivo
  const blob = new Blob([engContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('success', 'Arquivo .ENG compatível com OpenRocket gerado!');
}



async function gerarRelatorioPdf(sessionId, source) {
  try {
    const session = await getSessionDataForExport(sessionId, source);
    if (!session) {
      showNotification('error', 'Sessão não encontrada para relatório PDF.');
      return;
    }

    showNotification('info', 'Gerando relatório PDF com gráfico...', 2000);

    // Aplica pontos de queima salvos pelo usuário (se existirem)
    const burnData = aplicarPontosDeQueima(session);

    if (!burnData) {
      showNotification('error', 'Erro ao processar dados da sessão.');
      return;
    }

    // Dados totais do teste (não filtrados)
    const dadosTotais = processarDadosSimples(session.dadosTabela);

    // Usa dados filtrados pelos pontos de queima
    const dados = burnData.dadosFiltrados;

    console.log('[PDF DEBUG] dados:', {
      tempos: dados.tempos?.length,
      newtons: dados.newtons?.length,
      hasTempos: !!dados.tempos,
      hasNewtons: !!dados.newtons
    });

    if (!dados.tempos || !dados.newtons || dados.tempos.length === 0) {
      showNotification('error', 'Dados filtrados estão vazios ou inválidos.');
      return;
    }

    const impulsoData = calcularAreaSobCurva(dados.tempos, dados.newtons, false);

  // Obtém massa do propelente em kg (converte de gramas se necessário)
  let massaPropelente = null;
  if (session.metadadosMotor && session.metadadosMotor.massaPropelente) {
    massaPropelente = session.metadadosMotor.massaPropelente / 1000; // Converte de gramas para kg
  }

  const metricasPropulsao = calcularMetricasPropulsao(impulsoData, massaPropelente);

  // Adiciona informação sobre pontos personalizados
  const burnInfo = {
    usandoPontosPersonalizados: burnData.usandoPontosPersonalizados,
    startTime: burnData.startTime,
    endTime: burnData.endTime,
    duration: burnData.endTime - burnData.startTime
  };

  // Cria uma cópia temporária da sessão com dados filtrados
  const sessionParaPDF = { ...session };

  console.log('[PDF DEBUG] session.dadosTabela:', session.dadosTabela?.length, 'items');
  console.log('[PDF DEBUG] burnData times:', burnData.startTime, 'to', burnData.endTime);

  sessionParaPDF.dadosTabela = session.dadosTabela.filter(d => {
    const tempo = parseFloat(d.tempo_esp) || 0;
    return tempo >= burnData.startTime && tempo <= burnData.endTime;
  });

  console.log('[PDF DEBUG] sessionParaPDF.dadosTabela filtered:', sessionParaPDF.dadosTabela?.length, 'items');

  if (!sessionParaPDF.dadosTabela || sessionParaPDF.dadosTabela.length === 0) {
    showNotification('error', 'Nenhum dado encontrado no intervalo de queima.');
    return;
  }

  // Gera o gráfico em canvas e converte para imagem
  gerarGraficoParaPDF(sessionParaPDF, dados, impulsoData, metricasPropulsao, (imagemBase64) => {
    // Cria janela de impressão com o gráfico
    const printWindow = window.open('', '_blank');

    // Gera HTML do relatório COM a imagem do gráfico
    const html = gerarHTMLRelatorioCompleto(sessionParaPDF, dados, impulsoData, metricasPropulsao, imagemBase64, burnInfo, dadosTotais);

    printWindow.document.write(html);
    printWindow.document.close();

    showNotification('success', 'Relatório PDF gerado com sucesso!', 3000);
  });
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    showNotification('error', 'Erro ao gerar PDF: ' + error.message);
  }
}

async function exportarCSV(sessionId, source) {
  const session = await getSessionDataForExport(sessionId, source);
  if (!session) {
    showNotification('error', 'Sessão não encontrada para exportação CSV.');
    return;
  }

  let csvContent = "Timestamp,Tempo ESP (s),Newtons (N),Grama-força (gf),Quilo-força (kgf)\n";
  session.dadosTabela.forEach(leitura => {
    csvContent += leitura.timestamp + ',' + leitura.tempo_esp + ',' + leitura.newtons + ',' + leitura.grama_forca + ',' + leitura.quilo_forca + '\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = session.nome.replace(/[^a-zA-Z0-9_]/g, '_') + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showNotification('success', 'Arquivo CSV para "' + session.nome + '" gerado!');
}

function deleteLocalSession(sessionId) {
  if (!confirm('Tem certeza que deseja excluir a sessão ' + sessionId + ' do Local Storage?')) {
    return;
  }
  let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  gravacoes = gravacoes.filter(s => s.id !== sessionId);
  localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
  showNotification('success', 'Sessão ' + sessionId + ' excluída do Local Storage.');
  loadAndDisplayAllSessions(); // Re-render the list
}

async function deleteDbSession(sessionId) {
  if (!confirm('Tem certeza que deseja excluir a sessão ' + sessionId + ' do banco de dados? Esta ação não pode ser desfeita.')) {
    return;
  }
  try {
    const response = await apiFetch(`/api/sessoes/${sessionId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Falha ao excluir a sessão do DB.');

    showNotification('success', 'Sessão ' + sessionId + ' excluída do banco de dados.');
    loadAndDisplayAllSessions(); // Re-render the list
  } catch (error) {
    console.error('Erro ao excluir sessão do DB:', error);
    showNotification('error', 'Erro ao excluir a sessão ' + sessionId + ' do DB.');
  }
}

async function saveDbSessionToLocal(sessionId) {
  try {
    // Fetch session details from DB
    const dbSessionResponse = await apiFetch('/api/sessoes');
    if (!dbSessionResponse.ok) throw new Error('Falha ao carregar detalhes da sessão do DB para salvar localmente.');
    const allDbSessions = await dbSessionResponse.json();
    const dbSession = allDbSessions.find(s => s.id === sessionId);

    if (!dbSession) {
      showNotification('error', 'Sessão do DB não encontrada para salvar localmente.');
      return;
    }

    // Fetch readings from DB
    const readingsResponse = await apiFetch('/api/sessoes/' + sessionId + '/leituras');
    if (!readingsResponse.ok) throw new Error('Falha ao carregar leituras do DB para salvar localmente.');
    const dbReadings = await readingsResponse.json();

    const gravacao = {
      id: dbSession.id,
      nome: dbSession.nome,
      timestamp: dbSession.data_inicio,
      data_inicio: dbSession.data_inicio,
      data_fim: dbSession.data_fim,
      data_modificacao: dbSession.data_modificacao || new Date().toISOString(),
      dadosTabela: dbReadings.map(r => ({
        timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
        tempo_esp: r.tempo,
        newtons: r.forca,
        grama_forca: (r.forca / 9.80665 * 1000),
        quilo_forca: (r.forca / 9.80665)
      })),
      metadadosMotor: dbSession.metadadosMotor || {},
      burnMetadata: dbSession.burnMetadata || {},
      savedToMysql: true // Mark as saved to MySQL since it came from there
    };

    let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    // Check if already exists in local storage to avoid duplicates
    const existingIndex = gravacoes.findIndex(s => s.id === sessionId);
    if (existingIndex === -1) {
      gravacoes.push(gravacao);
      showNotification('success', 'Sessão "' + dbSession.nome + '" salva localmente!');
    } else {
      // Atualiza a sessão existente
      gravacoes[existingIndex] = gravacao;
      showNotification('success', 'Sessão "' + dbSession.nome + '" atualizada localmente!');
    }
    localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
    loadAndDisplayAllSessions(); // Re-render to update status

  } catch (error) {
    console.error('Erro ao salvar sessão do DB localmente:', error);
    showNotification('error', 'Erro ao salvar sessão ' + sessionId + ' localmente.');
  }
}

async function saveLocalSessionToDb(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const sessionToSave = localSessions.find(s => s.id === sessionId);

  if (!sessionToSave) {
    showNotification('error', 'Sessão local não encontrada para salvar no DB.');
    return;
  }

  if (isMysqlConnected) {
    showNotification('info', 'Enviando sessão "' + sessionToSave.nome + '" para o MySQL...');
    sendCommandToWorker('save_session_to_mysql', sessionToSave);
    // The worker will send back mysql_save_success/error, which will trigger loadAndDisplayAllSessions
  } else {
    showNotification('error', 'Não foi possível salvar no MySQL: Banco de dados desconectado.');
  }
}

async function resolverConflito(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const localSession = localSessions.find(s => s.id === sessionId);

  let dbSession = null;
  try {
    const resp = await apiFetch(`/api/sessoes/${sessionId}`);
    if (resp.ok) {
      dbSession = await resp.json();
    }
  } catch (e) {
    console.error('Erro ao buscar sessão do DB:', e);
    showNotification('error', 'Erro ao buscar dados do banco para comparação.');
    return;
  }

  if (!localSession || !dbSession) {
    showNotification('error', 'Não foi possível carregar ambas as versões para comparação.');
    return;
  }

  const localDate = localSession.data_modificacao ? new Date(localSession.data_modificacao).toLocaleString('pt-BR') : 'Desconhecida';
  const dbDate = dbSession.data_modificacao ? new Date(dbSession.data_modificacao).toLocaleString('pt-BR') : 'Desconhecida';

  // Metadados do motor para comparação
  const localMeta = localSession.metadadosMotor || {};
  const dbMeta = dbSession.metadadosMotor || {};

  const formatMetaValue = (val) => val !== undefined && val !== null && val !== '' ? val : 'N/D';

  const metadadosLocalHtml = `
    <div style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.85rem;">
      <strong style="color: #3498db;">🚀 Metadados do Motor:</strong>
      <div style="margin-top: 5px; line-height: 1.6;">
        <div><strong>Nome:</strong> ${formatMetaValue(localMeta.name)}</div>
        <div><strong>Diâmetro:</strong> ${formatMetaValue(localMeta.diameter)} mm</div>
        <div><strong>Comprimento:</strong> ${formatMetaValue(localMeta.length)} mm</div>
        <div><strong>Delay:</strong> ${formatMetaValue(localMeta.delay)} s</div>
        <div><strong>Peso Propelente:</strong> ${formatMetaValue(localMeta.propweight)} kg</div>
        <div><strong>Peso Total:</strong> ${formatMetaValue(localMeta.totalweight)} kg</div>
        <div><strong>Fabricante:</strong> ${formatMetaValue(localMeta.manufacturer)}</div>
        ${localMeta.description ? `<div style="margin-top: 5px;"><strong>Descrição:</strong> ${localMeta.description}</div>` : ''}
        ${localMeta.observations ? `<div style="margin-top: 5px;"><strong>Observações:</strong> ${localMeta.observations}</div>` : ''}
      </div>
    </div>
  `;

  const metadadosDbHtml = `
    <div style="margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 4px; font-size: 0.85rem;">
      <strong style="color: #9b59b6;">🚀 Metadados do Motor:</strong>
      <div style="margin-top: 5px; line-height: 1.6;">
        <div><strong>Nome:</strong> ${formatMetaValue(dbMeta.name)}</div>
        <div><strong>Diâmetro:</strong> ${formatMetaValue(dbMeta.diameter)} mm</div>
        <div><strong>Comprimento:</strong> ${formatMetaValue(dbMeta.length)} mm</div>
        <div><strong>Delay:</strong> ${formatMetaValue(dbMeta.delay)} s</div>
        <div><strong>Peso Propelente:</strong> ${formatMetaValue(dbMeta.propweight)} kg</div>
        <div><strong>Peso Total:</strong> ${formatMetaValue(dbMeta.totalweight)} kg</div>
        <div><strong>Fabricante:</strong> ${formatMetaValue(dbMeta.manufacturer)}</div>
        ${dbMeta.description ? `<div style="margin-top: 5px;"><strong>Descrição:</strong> ${dbMeta.description}</div>` : ''}
        ${dbMeta.observations ? `<div style="margin-top: 5px;"><strong>Observações:</strong> ${dbMeta.observations}</div>` : ''}
      </div>
    </div>
  `;

  const modalHtml = `
    <div id="modal-conflito" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
      <div style="background: var(--cor-fundo); padding: 30px; border-radius: 12px; max-width: 900px; width: 95%; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <h2 style="margin-top: 0; color: #e74c3c;">⚠️ Conflito de Sincronização Detectado</h2>
        <p style="color: var(--cor-texto); margin-bottom: 20px;">
          A sessão "<strong>${localSession.nome}</strong>" possui versões diferentes no LocalStorage e no Banco de Dados.
          Escolha qual versão deseja manter:
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
          <div style="border: 2px solid #3498db; border-radius: 8px; padding: 15px; background: rgba(52, 152, 219, 0.1);">
            <h3 style="margin-top: 0; color: #3498db; font-size: 1.1rem;">💾 Versão Local</h3>
            <p style="margin: 5px 0;"><strong>Modificada em:</strong> ${localDate}</p>
            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--cor-texto-secundario);">
              Dados salvos no navegador deste dispositivo.
            </p>
            ${metadadosLocalHtml}
            <button onclick="resolverConflito_UsarLocal(${sessionId})" class="btn btn-primario" style="width: 100%; margin-top: 10px;">
              ✓ Usar Versão Local
            </button>
          </div>

          <div style="border: 2px solid #9b59b6; border-radius: 8px; padding: 15px; background: rgba(155, 89, 182, 0.1);">
            <h3 style="margin-top: 0; color: #9b59b6; font-size: 1.1rem;">☁️ Versão do Banco</h3>
            <p style="margin: 5px 0;"><strong>Modificada em:</strong> ${dbDate}</p>
            <p style="margin: 5px 0; font-size: 0.9rem; color: var(--cor-texto-secundario);">
              Dados salvos no banco de dados (sincronizados).
            </p>
            ${metadadosDbHtml}
            <button onclick="resolverConflito_UsarDB(${sessionId})" class="btn btn-secundario" style="width: 100%; margin-top: 10px;">
              ✓ Usar Versão do Banco
            </button>
          </div>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button onclick="fecharModalConflito()" class="btn btn-perigo">✗ Cancelar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharModalConflito() {
  const modal = document.getElementById('modal-conflito');
  if (modal) modal.remove();
}

async function resolverConflito_UsarLocal(sessionId) {
  const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
  const localSession = localSessions.find(s => s.id === sessionId);

  if (!localSession) {
    showNotification('error', 'Sessão local não encontrada.');
    fecharModalConflito();
    return;
  }

  // Atualiza data de modificação e envia para o banco
  localSession.data_modificacao = new Date().toISOString();

  // Atualiza no localStorage
  const sessionIndex = localSessions.findIndex(s => s.id === sessionId);
  localSessions[sessionIndex] = localSession;
  localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));

  if (isMysqlConnected) {
    sendCommandToWorker('save_session_to_mysql', localSession);
    showNotification('success', 'Versão local enviada para o banco de dados.');
  } else {
    showNotification('warning', 'MySQL desconectado. Versão local mantida, mas não sincronizada.');
  }

  fecharModalConflito();
  setTimeout(() => loadAndDisplayAllSessions(), 500);
}

async function resolverConflito_UsarDB(sessionId) {
  try {
    const resp = await apiFetch(`/api/sessoes/${sessionId}`);
    if (!resp.ok) {
      throw new Error('Erro ao buscar sessão do banco');
    }

    const dbSession = await resp.json();

    // Busca as leituras
    const readingsResp = await apiFetch(`/api/sessoes/${sessionId}/leituras`);
    if (readingsResp.ok) {
      const dbReadings = await readingsResp.json();
      dbSession.dadosTabela = dbReadings.map(r => ({
        timestamp: formatUtcDdMm(parseDbTimestampToUTC(r.timestamp)),
        tempo_esp: r.tempo,
        newtons: r.forca,
        grama_forca: (r.forca / 9.80665 * 1000),
        quilo_forca: (r.forca / 9.80665)
      }));
    }

    // Normaliza os campos
    if (dbSession.data_inicio && !dbSession.timestamp) {
      dbSession.timestamp = dbSession.data_inicio;
    }
    if (!dbSession.data_modificacao) {
      dbSession.data_modificacao = new Date().toISOString();
    }

    // Atualiza no localStorage
    const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    const sessionIndex = localSessions.findIndex(s => s.id === sessionId);

    if (sessionIndex !== -1) {
      localSessions[sessionIndex] = dbSession;
    } else {
      localSessions.push(dbSession);
    }

    localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));
    showNotification('success', 'Versão do banco baixada para o LocalStorage.');

    fecharModalConflito();
    setTimeout(() => loadAndDisplayAllSessions(), 500);

  } catch (error) {
    console.error('Erro ao buscar sessão do DB:', error);
    showNotification('error', 'Erro ao baixar versão do banco de dados.');
    fecharModalConflito();
  }
}

async function importarGravacaoExterna() {
  const fileInput = document.getElementById('importar-arquivo-motor');
  const nomeImportacaoInput = document.getElementById('nome-importacao');
  const file = fileInput.files[0];
  const nome = nomeImportacaoInput.value.trim();

  if (!file || !nome) {
    showNotification('error', 'Por favor, selecione um arquivo e insira um nome para a importação.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    const linhas = content.split('\n').filter(line => line.trim() !== '');
    const dadosTabela = linhas.map((linha, index) => {
      const partes = linha.trim().split(/\s+/);
      if (partes.length >= 2) {
        return {
          timestamp: new Date(Date.now() + index).toLocaleString('pt-BR', { hour12: false }).replace(', ', ' '), // Unique timestamp
          tempo_esp: parseFloat(partes[0]),
          newtons: parseFloat(partes[1]),
          grama_forca: parseFloat(partes[1]) / 9.80665 * 1000,
          quilo_forca: parseFloat(partes[1]) / 9.80665
        };
      }
      return null;
    }).filter(Boolean);

    if (dadosTabela.length === 0) {
      showNotification('error', 'Nenhum dado válido encontrado no arquivo importado.');
      return;
    }

    const gravacao = {
      id: Date.now(),
      nome: nome,
      timestamp: new Date().toISOString(),
      data_modificacao: new Date().toISOString(),
      dadosTabela: dadosTabela,
      metadadosMotor: {},
      source: 'local', // Initially local
      inLocal: true,
      inDb: false
    };

    try {
      let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
      gravacoes.push(gravacao);
      localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
      showNotification('success', 'Sessão "' + nome + '" importada e salva localmente!');

      // Also save to DB if connected
      if (isMysqlConnected) {
        showNotification('info', 'Enviando sessão importada "' + nome + '" para o MySQL...');
        sendCommandToWorker('save_session_to_mysql', gravacao);
      }

      loadAndDisplayAllSessions(); // Re-render the list
      fileInput.value = '';
      nomeImportacaoInput.value = '';
    } catch (e) {
      showNotification('error', 'Erro ao salvar importação. O Local Storage pode estar cheio.');
    }
  };
  reader.readAsText(file);
}

// --- Função para Importar Gravação JSON Exportada ---
async function importarGravacaoJSON() {
  const fileInput = document.getElementById('importar-json');
  const file = fileInput.files[0];

  if (!file) {
    showNotification('error', 'Por favor, selecione um arquivo JSON para importar.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const content = e.target.result;
      const gravacaoImportada = JSON.parse(content);

      // Validar estrutura básica do JSON
      if (!gravacaoImportada.nome || !gravacaoImportada.dadosTabela || !Array.isArray(gravacaoImportada.dadosTabela)) {
        showNotification('error', 'Arquivo JSON inválido. Certifique-se de que é uma exportação válida.');
        return;
      }

      // Gerar novo ID e atualizar timestamps
      const novaGravacao = {
        ...gravacaoImportada,
        id: Date.now(), // Novo ID único
        data_modificacao: new Date().toISOString(),
        source: 'local', // Marcar como local
        inLocal: true,
        inDb: false
      };

      // Se não tiver timestamp, adicionar
      if (!novaGravacao.timestamp) {
        novaGravacao.timestamp = new Date().toISOString();
      }

      // Salvar no localStorage
      let gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
      
      // Verificar se já existe uma gravação com o mesmo nome
      const nomeExistente = gravacoes.some(g => g.nome === novaGravacao.nome);
      if (nomeExistente) {
        const confirmar = confirm(`Já existe uma gravação com o nome "${novaGravacao.nome}". Deseja importar mesmo assim com um nome diferente?`);
        if (confirmar) {
          novaGravacao.nome = `${novaGravacao.nome} (importada ${new Date().toLocaleTimeString('pt-BR')})`;
        } else {
          fileInput.value = '';
          return;
        }
      }

      gravacoes.push(novaGravacao);
      localStorage.setItem('balancaGravacoes', JSON.stringify(gravacoes));
      
      showNotification('success', `Gravação "${novaGravacao.nome}" importada com sucesso! (${novaGravacao.dadosTabela.length} pontos)`);

      // Também salvar no MySQL se conectado
      if (isMysqlConnected) {
        showNotification('info', `Enviando gravação "${novaGravacao.nome}" para o MySQL...`);
        sendCommandToWorker('save_session_to_mysql', novaGravacao);
      }

      // Recarregar lista de gravações
      loadAndDisplayAllSessions();
      fileInput.value = '';

    } catch (error) {
      console.error('Erro ao importar JSON:', error);
      showNotification('error', `Erro ao importar arquivo JSON: ${error.message}`);
      fileInput.value = '';
    }
  };
  
  reader.readAsText(file);
}

// --- Funções do Relógio do Servidor ---

async function updateServerClock() {
  try {
    const response = await apiFetch('/api/time');
    if (response.ok) {
      const data = await response.json();
      const serverTime = new Date(data.time);
      const clientTime = new Date();

      // Calcula o offset entre servidor e cliente
      serverTimeOffset = serverTime.getTime() - clientTime.getTime();

      // Atualiza o display
      updateClockDisplay();
    }
  } catch (error) {
    console.error('Erro ao buscar hora do servidor:', error);
    document.getElementById('server-clock').textContent = 'Erro';
  }
}

function updateClockDisplay() {
  // Cria um Date object com a hora do servidor ajustada
  const now = new Date(Date.now() + serverTimeOffset);
  
  // getHours(), getMinutes(), getSeconds() já retornam no timezone LOCAL do navegador
  // Isso está correto! Se o servidor está em UTC e retorna 10:00, e o navegador
  // está em GMT-3, o Date object automaticamente mostra 07:00 localmente
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const clockElement = document.getElementById('server-clock');
  if (clockElement) {
    clockElement.textContent = `${hours}:${minutes}:${seconds}`;
  }
}

async function syncServerTime() {
  // Pega a hora LOCAL do navegador (a hora real que o usuário está vendo)
  const clientTime = new Date();
  
  // Obtém o timezone offset do cliente em minutos (diferença em relação a UTC)
  const timezoneOffset = clientTime.getTimezoneOffset(); // Retorna em minutos
  const timezoneOffsetSeconds = timezoneOffset * 60; // Converter para segundos
  
  // Obtém o nome do timezone do cliente
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Formata a hora local para exibição (HH:MM:SS)
  const hours = String(clientTime.getHours()).padStart(2, '0');
  const minutes = String(clientTime.getMinutes()).padStart(2, '0');
  const seconds = String(clientTime.getSeconds()).padStart(2, '0');
  const displayedTime = `${hours}:${minutes}:${seconds}`;

  if (!confirm(`Sincronizar hora do servidor com a hora atual do navegador?\n\nHora do Navegador: ${displayedTime}\nTimezone: ${timezoneName}\n\nATENÇÃO: Isso irá ajustar a hora do sistema do servidor!`)) {
    return;
  }

  try {
    // Envia a hora LOCAL do navegador junto com informações de timezone
    const response = await apiFetch('/api/time/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        time: clientTime.toISOString(),
        timezoneOffset: timezoneOffsetSeconds,  // offset em segundos
        timezoneName: timezoneName,
        localTime: displayedTime  // hora formatada localmente para referência
      })
    });

    if (response.ok) {
      const data = await response.json();

      // Verifica se há warning (sincronização simulada)
      if (data.warning) {
        showNotification('warning', data.message);
      } else {
        showNotification('success', data.message || 'Hora do servidor sincronizada com sucesso!');
      }

      // Atualiza imediatamente
      await updateServerClock();
    } else {
      // Tenta ler como JSON primeiro, depois como texto
      try {
        const errorData = await response.json();

        // Se for erro de permissão, mostra modal com instruções
        if (response.status === 403 && errorData.message) {
          showPermissionErrorModal(errorData.message, errorData.requested_time);
        } else {
          const errorMsg = errorData.error || errorData.message || JSON.stringify(errorData);
          console.error('Erro completo:', errorMsg);
          showNotification('error', `Erro ao sincronizar: ${errorMsg}`);
        }
      } catch {
        const errorText = await response.text();
        // Extrai a mensagem de erro do HTML se possível
        const match = errorText.match(/<title>.*?(\d+)\s+([^<]+)<\/title>/);
        if (match) {
          showNotification('error', `Erro ao sincronizar: ${match[1]} - ${match[2]}`);
        } else {
          showNotification('error', `Erro ao sincronizar: Erro ${response.status}`);
        }
        console.error('Erro completo:', errorText);
      }
    }
  } catch (error) {
    console.error('Erro ao sincronizar hora:', error);
    showNotification('error', 'Erro de conexão ao sincronizar hora do servidor.');
  }
}

function showPermissionErrorModal(message, requestedTime) {
  const requestedDate = requestedTime ? new Date(requestedTime).toLocaleString('pt-BR') : 'N/D';

  const modalHtml = `
    <div id="modal-permission-error" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;">
      <div style="background: var(--cor-fundo); padding: 30px; border-radius: 12px; max-width: 650px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <h2 style="margin-top: 0; color: #e67e22;">🔒 Permissão Necessária</h2>
        <p style="color: var(--cor-texto); margin-bottom: 15px;">
          <strong>Hora solicitada:</strong> ${requestedDate}
        </p>

        <div style="background: #34495e; color: #ecf0f1; padding: 15px; border-radius: 8px; margin-bottom: 20px; white-space: pre-wrap; font-family: monospace; font-size: 0.85rem; line-height: 1.6;">
${message}
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button onclick="closePermissionErrorModal()" class="btn btn-primario">Entendido</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closePermissionErrorModal() {
  const modal = document.getElementById('modal-permission-error');
  if (modal) modal.remove();
}

// Inicializa o relógio
window.addEventListener('load', () => {
  // Busca a hora inicial
  updateServerClock();

  // Atualiza o display a cada segundo (independente de buscar do servidor)
  setInterval(updateClockDisplay, 1000);
  
  // Listener para fechar modal ao clicar fora dele
  const modalSobrecarga = document.getElementById('modal-alerta-sobrecarga');
  if (modalSobrecarga) {
    modalSobrecarga.addEventListener('click', (e) => {
      if (e.target === modalSobrecarga) {
        fecharModalSobrecarga();
      }
    });
  }

  // Busca a hora do servidor a cada 5 minutos para corrigir drift
  setInterval(updateServerClock, 5 * 60 * 1000);
});