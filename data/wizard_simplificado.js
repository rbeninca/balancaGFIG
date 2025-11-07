/**
 * WIZARD SIMPLIFICADO DE CALIBRAÇÃO
 * Sistema guiado passo-a-passo para configuração da célula de carga
 */

// Estado do wizard
let wizardStateSimple = {
  passo0: {
    ruidoMedidoG: 0,
    toleranciaCalculadaG: 0,
    leituraInicialN: 0
  },
  passo1: {
    capacidadeKg: 0,
    acuraciaPercent: 0.02,
    erroMaximoG: 0
  },
  passo2: {
    pesoConhecidoG: 0,
    leituraComPesoN: 0,
    leituraSemPesoN: 0,
    fatorConversao: 0,
    calibracaoCompleta: false
  },
  passo3: {
    taraFinalCompleta: false
  }
};

let wizardCurrentStepSimple = 0;
const WIZARD_TOTAL_STEPS_SIMPLE = 4;
let wizardRealtimeInterval = null;

/**
 * PASSO 0: Análise automática de ruído e tara
 */
async function wizardPasso0_Avancar() {
  console.log('[Wizard] Executando Passo 0...');

  // Desabilita botão de avançar temporariamente
  const btnNext = document.getElementById('wizard-btn-next');
  const originalText = btnNext.textContent;
  btnNext.disabled = true;
  btnNext.textContent = '⏳ Processando...';

  try {
    // 1. Faz tara
    console.log('[Wizard] Fazendo tara...');
    await enviarComandoPromise('t');
    await sleep(500);

    // 2. Aguarda estabilização (2 segundos)
    console.log('[Wizard] Aguardando estabilização...');
    await sleep(2000);

    // 3. Coleta amostras para análise de ruído (5 segundos)
    console.log('[Wizard] Coletando amostras de ruído...');
    const amostras = await coletarAmostrasRuido(5000);

    // 4. Calcula desvio padrão e média
    const media = amostras.reduce((a, b) => a + b, 0) / amostras.length;
    const variancia = amostras.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / amostras.length;
    const desvioPadrao = Math.sqrt(variancia);

    // Converte para gramas
    const desvioPadraoG = (desvioPadrao * 1000) / 9.80665;
    const toleranciaG = desvioPadraoG * 1.5; // 1.5x o ruído medido

    // Salva no estado
    wizardStateSimple.passo0.ruidoMedidoG = desvioPadraoG;
    wizardStateSimple.passo0.toleranciaCalculadaG = toleranciaG;
    wizardStateSimple.passo0.leituraInicialN = media;

    // Exibe resultados
    document.getElementById('wizard-ruido-medido').textContent = desvioPadraoG.toFixed(2);
    document.getElementById('wizard-tolerancia-calculada').textContent = toleranciaG.toFixed(2);
    document.getElementById('wizard-analise-status').style.display = 'block';

    console.log(`[Wizard] Passo 0 concluído: Ruído=${desvioPadraoG.toFixed(2)}g, Tolerância=${toleranciaG.toFixed(2)}g`);

    // Re-habilita botão
    btnNext.disabled = false;
    btnNext.textContent = originalText;

    return true;
  } catch (error) {
    console.error('[Wizard] Erro no Passo 0:', error);
    showNotification('error', 'Erro na análise automática. Verifique a conexão com a balança.');
    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return false;
  }
}

/**
 * PASSO 1: Capacidade da célula
 */
function wizardCalcularAcuracia() {
  const capacidadeKg = parseFloat(document.getElementById('wizard-capacidade-kg').value) || 0;

  if (capacidadeKg > 0) {
    // Acurácia estimada: 0.02% (padrão para células comuns)
    const acuraciaPercent = 0.02;
    const capacidadeG = capacidadeKg * 1000;
    const erroMaximoG = (capacidadeG * acuraciaPercent) / 100;

    // Salva no estado
    wizardStateSimple.passo1.capacidadeKg = capacidadeKg;
    wizardStateSimple.passo1.acuraciaPercent = acuraciaPercent;
    wizardStateSimple.passo1.erroMaximoG = erroMaximoG;

    // Exibe
    document.getElementById('wizard-acuracia-valor').textContent = acuraciaPercent + '%';
    document.getElementById('wizard-erro-maximo-valor').textContent = erroMaximoG.toFixed(2);
    document.getElementById('wizard-acuracia-calculada').style.display = 'block';
  } else {
    document.getElementById('wizard-acuracia-calculada').style.display = 'none';
  }
}

function wizardPasso1_Validar() {
  const capacidadeKg = parseFloat(document.getElementById('wizard-capacidade-kg').value) || 0;

  if (capacidadeKg <= 0) {
    showNotification('error', 'Informe a capacidade da célula em kg (ex: 5)');
    return false;
  }

  return true;
}

/**
 * PASSO 2: Calibração com peso conhecido
 */
async function wizardPasso2_Avancar() {
  const pesoConhecidoG = parseFloat(document.getElementById('wizard-peso-conhecido').value) || 0;

  if (pesoConhecidoG <= 0) {
    showNotification('error', 'Informe o peso do objeto em gramas (ex: 1000)');
    return false;
  }

  const btnNext = document.getElementById('wizard-btn-next');
  const originalText = btnNext.textContent;
  btnNext.disabled = true;
  btnNext.textContent = '⏳ Calibrando...';

  try {
    // Aguarda estabilização
    await sleep(1000);

    // Lê valor atual (com peso)
    const leituraComPesoN = await lerValorAtualBalanca();

    // Converte peso conhecido para Newtons
    const pesoConhecidoN = (pesoConhecidoG * 9.80665) / 1000;

    // Calcula fator de conversão
    const fatorConversao = pesoConhecidoN / leituraComPesoN;

    // Salva calibração no ESP
    await enviarComandoPromise('c', pesoConhecidoG);

    // Salva no estado
    wizardStateSimple.passo2.pesoConhecidoG = pesoConhecidoG;
    wizardStateSimple.passo2.leituraComPesoN = leituraComPesoN;
    wizardStateSimple.passo2.fatorConversao = fatorConversao;
    wizardStateSimple.passo2.calibracaoCompleta = true;

    // Exibe resultado
    document.getElementById('wizard-fator-conversao').textContent = fatorConversao.toFixed(6);
    document.getElementById('wizard-calibracao-resultado').style.display = 'block';

    console.log(`[Wizard] Calibração: Peso=${pesoConhecidoG}g, Leitura=${leituraComPesoN.toFixed(3)}N, Fator=${fatorConversao.toFixed(6)}`);

    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return true;
  } catch (error) {
    console.error('[Wizard] Erro na calibração:', error);
    showNotification('error', 'Erro na calibração. Tente novamente.');
    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return false;
  }
}

/**
 * PASSO 3: Tara Final
 */
async function wizardPasso3_Avancar() {
  const btnNext = document.getElementById('wizard-btn-next');
  const originalText = btnNext.textContent;
  btnNext.disabled = true;
  btnNext.textContent = '⏳ Fazendo tara final...';

  try {
    await enviarComandoPromise('t');
    await sleep(1000);

    wizardStateSimple.passo3.taraFinalCompleta = true;
    document.getElementById('wizard-tara-final-status').style.display = 'block';

    console.log('[Wizard] Tara final concluída');

    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return true;
  } catch (error) {
    console.error('[Wizard] Erro na tara final:', error);
    showNotification('error', 'Erro na tara final. Tente novamente.');
    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return false;
  }
}

/**
 * Navegação entre passos
 */
async function wizardGoToStepSimple(direction) {
  // Se estiver avançando, executa ações automáticas do passo atual
  if (direction > 0) {
    let sucesso = true;

    switch (wizardCurrentStepSimple) {
      case 0:
        sucesso = await wizardPasso0_Avancar();
        break;
      case 1:
        sucesso = wizardPasso1_Validar();
        break;
      case 2:
        sucesso = await wizardPasso2_Avancar();
        break;
      case 3:
        sucesso = await wizardPasso3_Avancar();
        break;
    }

    if (!sucesso) return; // Não avança se falhou
  }

  const newStep = wizardCurrentStepSimple + direction;

  if (newStep >= 0 && newStep <= WIZARD_TOTAL_STEPS_SIMPLE) {
    wizardCurrentStepSimple = newStep;
    wizardGoToStepDisplay(newStep);
  }
}

function wizardGoToStepDisplay(stepNumber) {
  // Esconde todos os passos
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.style.display = 'none';
  });

  // Mostra o passo atual
  const currentStepEl = document.getElementById(`wizard-step-${stepNumber}`);
  if (currentStepEl) {
    currentStepEl.style.display = 'block';
  }

  // Atualiza UI
  wizardUpdateUISimple();

  // Inicia leitura em tempo real se necessário
  if ([0, 2, 3].includes(stepNumber)) {
    wizardStartRealtimeReading(stepNumber);
  } else {
    wizardStopRealtimeReading();
  }
}

function wizardUpdateUISimple() {
  // Atualiza barra de progresso
  const progressBar = document.querySelector('.wizard-progress-bar');
  const progress = (wizardCurrentStepSimple / WIZARD_TOTAL_STEPS_SIMPLE) * 100;
  progressBar.style.width = `${progress}%`;

  // Atualiza botões
  const btnPrev = document.getElementById('wizard-btn-prev');
  const btnNext = document.getElementById('wizard-btn-next');
  const btnFinish = document.getElementById('wizard-btn-finish');

  btnPrev.style.display = wizardCurrentStepSimple > 0 ? 'inline-block' : 'none';
  btnNext.style.display = wizardCurrentStepSimple < WIZARD_TOTAL_STEPS_SIMPLE ? 'inline-block' : 'none';
  btnFinish.style.display = wizardCurrentStepSimple === WIZARD_TOTAL_STEPS_SIMPLE ? 'inline-block' : 'none';
}

/**
 * Leitura em tempo real
 */
function wizardStartRealtimeReading(passo) {
  wizardStopRealtimeReading();

  const elementId = `wizard-leitura-passo${passo}`;
  const leituraEl = document.getElementById(elementId);

  if (!leituraEl) return;

  wizardRealtimeInterval = setInterval(async () => {
    try {
      const forcaN = await lerValorAtualBalanca();
      const kgf = (forcaN / 9.80665).toFixed(3);
      leituraEl.textContent = `${forcaN.toFixed(3)} N (${kgf} kgf)`;
    } catch (e) {
      leituraEl.textContent = '--- N';
    }
  }, 200);
}

function wizardStopRealtimeReading() {
  if (wizardRealtimeInterval) {
    clearInterval(wizardRealtimeInterval);
    wizardRealtimeInterval = null;
  }
}

/**
 * Finalização
 */
async function wizardFinishSimple() {
  // Exibe resumo
  document.getElementById('wizard-resumo-capacidade').textContent = wizardStateSimple.passo1.capacidadeKg.toFixed(2);
  document.getElementById('wizard-resumo-tolerancia').textContent = wizardStateSimple.passo0.toleranciaCalculadaG.toFixed(2);
  document.getElementById('wizard-resumo-fator').textContent = wizardStateSimple.passo2.fatorConversao.toFixed(6);

  // Salva configurações no ESP32
  try {
    const capacidadeG = wizardStateSimple.passo1.capacidadeKg * 1000;
    const toleranciaN = (wizardStateSimple.passo0.toleranciaCalculadaG * 9.80665) / 1000;
    const acuracia = wizardStateSimple.passo1.acuraciaPercent / 100;

    await enviarComandoPromise('set', { param: 'capacidadeMaximaGramas', value: capacidadeG });
    await sleep(100);
    await enviarComandoPromise('set', { param: 'percentualAcuracia', value: acuracia });
    await sleep(100);
    await enviarComandoPromise('set', { param: 'toleranciaEstabilidade', value: toleranciaN });
    await sleep(100);

    showNotification('success', 'Configuração concluída com sucesso!');

    setTimeout(() => {
      closeWizard();
    }, 2000);
  } catch (error) {
    console.error('[Wizard] Erro ao salvar configurações:', error);
    showNotification('error', 'Erro ao salvar configurações no ESP32');
  }
}

/**
 * Funções auxiliares
 */
async function coletarAmostrasRuido(duracaoMs) {
  return new Promise((resolve) => {
    const amostras = [];
    const inicio = Date.now();

    const coletar = (event) => {
      const { type, payload } = event.data;
      if (type === 'dadosDisponiveis' && payload && payload[0]) {
        amostras.push(payload[0].forca);
      }
    };

    if (typeof dataWorker !== 'undefined') {
      dataWorker.addEventListener('message', coletar);
    }

    setTimeout(() => {
      if (typeof dataWorker !== 'undefined') {
        dataWorker.removeEventListener('message', coletar);
      }
      resolve(amostras);
    }, duracaoMs);
  });
}

async function lerValorAtualBalanca() {
  return new Promise((resolve, reject) => {
    let timeout = setTimeout(() => reject(new Error('Timeout')), 3000);

    const ler = (event) => {
      const { type, payload } = event.data;
      if (type === 'dadosDisponiveis' && payload && payload[0]) {
        clearTimeout(timeout);
        if (typeof dataWorker !== 'undefined') {
          dataWorker.removeEventListener('message', ler);
        }
        resolve(payload[0].forca);
      }
    };

    if (typeof dataWorker !== 'undefined') {
      dataWorker.addEventListener('message', ler);
    } else {
      reject(new Error('dataWorker não definido'));
    }
  });
}

function enviarComandoPromise(comando, parametro) {
  return new Promise((resolve) => {
    sendCommandToWorker(comando, parametro);
    setTimeout(resolve, 300); // Aguarda processamento
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Sobrescreve função de abertura do wizard
window.openWizardSimplificado = function() {
  const modal = document.getElementById('wizard-modal');
  modal.style.display = 'block';
  wizardCurrentStepSimple = 0;
  wizardGoToStepDisplay(0);

  // Reseta estado
  wizardStateSimple = {
    passo0: { ruidoMedidoG: 0, toleranciaCalculadaG: 0, leituraInicialN: 0 },
    passo1: { capacidadeKg: 0, acuraciaPercent: 0.02, erroMaximoG: 0 },
    passo2: { pesoConhecidoG: 0, leituraComPesoN: 0, leituraSemPesoN: 0, fatorConversao: 0, calibracaoCompleta: false },
    passo3: { taraFinalCompleta: false }
  };
};

console.log('[Wizard Simplificado] Carregado');
