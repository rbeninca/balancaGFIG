/**
 * WIZARD DE CALIBRAÇÃO - MODELO MATEMÁTICO CLÁSSICO
 *
 * Modelo: m = α·N + β
 * onde:
 *   m = massa (kg)
 *   N = leitura bruta (contagens/Newtons do ADC)
 *   α = ganho (kg por contagem)
 *   β = offset (kg equivalente ao zero falso)
 *
 * Método: Regressão linear por mínimos quadrados
 */

// Estado do wizard
let wizardStateSimple = {
  passo0: {
    nZero: 0,                    // N_zero: leitura sem peso (contagens)
    ruidoStd: 0,                 // Desvio padrão do ruído
    amostrasColetadas: 0
  },
  passo1: {
    capacidadeKg: 0,             // Capacidade nominal da célula
    acuraciaPercent: 0.03,       // Acurácia desejada (0.03% = classe C3)
    erroMaximoKg: 0              // Erro máximo tolerável
  },
  passo2: {
    pontosCalibr: [],            // Array de {m_kg, N_leitura}
    pesoAtualKg: 0,
    calibracaoCompleta: false
  },
  passo3: {
    alpha: 0,                    // Ganho calculado (kg/contagem)
    beta: 0,                     // Offset calculado (kg)
    erroMaximoMedido: 0,        // Maior erro encontrado
    r2: 0,                       // Coeficiente de determinação
    toleranciaN: 0              // Tolerância em N para ESP32
  }
};

let wizardCurrentStepSimple = 0;
const WIZARD_TOTAL_STEPS_SIMPLE = 4;
let wizardRealtimeInterval = null;

/**
 * PASSO 0: Medir N_zero (sem peso) e ruído
 */
async function wizardPasso0_Avancar() {
  console.log('[Wizard] Passo 0: Medindo N_zero e ruído...');

  const btnNext = document.getElementById('wizard-btn-next');
  const originalText = btnNext.textContent;
  btnNext.disabled = true;
  btnNext.textContent = '⏳ Analisando (5s)...';

  try {

    // Faz tara inicial
    await enviarComandoPromise('t');
    await sleep(1000);

    // Coleta 100 amostras em 5 segundos
    console.log('[Wizard] Coletando 100 amostras...');
    const amostras = await coletarAmostrasRuido(5000);

    if (amostras.length < 10) {
      throw new Error('Poucas amostras coletadas. Verifique conexão.');
    }

    // Calcula N_zero (média) e ruído (desvio padrão)
    const nZero = amostras.reduce((a, b) => a + b, 0) / amostras.length;
    const variancia = amostras.reduce((sum, val) => sum + Math.pow(val - nZero, 2), 0) / amostras.length;
    const ruidoStd = Math.sqrt(variancia);

    // Salva
    wizardStateSimple.passo0.nZero = nZero;
    wizardStateSimple.passo0.ruidoStd = ruidoStd;
    wizardStateSimple.passo0.amostrasColetadas = amostras.length;

    // Exibe apenas o ruído medido (em N, não convertido)
    document.getElementById('wizard-ruido-medido').textContent = `${ruidoStd.toFixed(6)} N (σ)`;
    document.getElementById('wizard-analise-status').style.display = 'block';

    console.log(`[Wizard] Passo 0 completo: N_zero=${nZero.toFixed(4)}N, σ=${ruidoStd.toFixed(6)}N (${amostras.length} amostras)`);

    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return true;

  } catch (error) {
    console.error('[Wizard] Erro no Passo 0:', error);
    showNotification('error', 'Erro na análise: ' + error.message);
    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return false;
  }
}

/**
 * PASSO 1: Definir capacidade e erro desejado
 */
function wizardCalcularAcuracia() {
  const capacidadeKg = parseFloat(document.getElementById('wizard-capacidade-kg').value) || 0;

  if (capacidadeKg > 0) {
    const acuraciaPercent = 0.03; // Classe C3
    const erroMaximoKg = (capacidadeKg * acuraciaPercent) / 100;

    wizardStateSimple.passo1.capacidadeKg = capacidadeKg;
    wizardStateSimple.passo1.acuraciaPercent = acuraciaPercent;
    wizardStateSimple.passo1.erroMaximoKg = erroMaximoKg;

    document.getElementById('wizard-acuracia-valor').textContent = acuraciaPercent + '%';
    document.getElementById('wizard-erro-maximo-valor').textContent = (erroMaximoKg * 1000).toFixed(2);
    document.getElementById('wizard-acuracia-calculada').style.display = 'block';

    console.log(`[Wizard] Capacidade=${capacidadeKg}kg, Erro máx=±${(erroMaximoKg*1000).toFixed(2)}g`);
  } else {
    document.getElementById('wizard-acuracia-calculada').style.display = 'none';
  }
}

function wizardPasso1_Validar() {
  const capacidadeKg = parseFloat(document.getElementById('wizard-capacidade-kg').value) || 0;
  if (capacidadeKg <= 0) {
    showNotification('error', 'Informe a capacidade da célula');
    return false;
  }
  return true;
}

/**
 * PASSO 2: Coletar pontos (N, m) para calibração
 * Usuário pode adicionar vários pesos
 */
async function wizardAdicionarPonto() {
  const pesoG = parseFloat(document.getElementById('wizard-peso-conhecido').value) || 0;

  if (pesoG < 0) {
    showNotification('error', 'Peso deve ser ≥ 0');
    return;
  }

  const pesoKg = pesoG / 1000;

  try {
    // Coleta média de leituras (3 segundos)
    const amostras = await coletarAmostrasRuido(3000);
    const nLeitura = amostras.reduce((a, b) => a + b, 0) / amostras.length;

    // Adiciona ponto
    wizardStateSimple.passo2.pontosCalibr.push({
      m_kg: pesoKg,
      N_leitura: nLeitura
    });

    console.log(`[Wizard] Ponto adicionado: m=${pesoKg}kg, N=${nLeitura.toFixed(4)}N`);
    showNotification('success', `✅ Ponto ${wizardStateSimple.passo2.pontosCalibr.length}: ${pesoG}g = ${nLeitura.toFixed(3)}N`);

    // Atualiza lista visual
    atualizarListaPontos();

    // Limpa campo
    document.getElementById('wizard-peso-conhecido').value = '';

  } catch (error) {
    console.error('[Wizard] Erro ao adicionar ponto:', error);
    showNotification('error', 'Erro ao coletar dados');
  }
}

function atualizarListaPontos() {
  const listaEl = document.getElementById('wizard-lista-pontos');
  if (!listaEl) return;

  const pontos = wizardStateSimple.passo2.pontosCalibr;

  if (pontos.length === 0) {
    listaEl.innerHTML = '<p style="color: var(--cor-texto-secundario);">Nenhum ponto coletado ainda</p>';
    return;
  }

  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
  html += '<tr><th>#</th><th>Massa (kg)</th><th>Leitura (N)</th><th>Ação</th></tr>';

  pontos.forEach((p, i) => {
    html += `<tr>
      <td>${i + 1}</td>
      <td>${p.m_kg.toFixed(3)}</td>
      <td>${p.N_leitura.toFixed(4)}</td>
      <td><button onclick="removerPonto(${i})" class="btn btn-secundario" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">🗑️</button></td>
    </tr>`;
  });

  html += '</table>';
  listaEl.innerHTML = html;
}

function removerPonto(index) {
  wizardStateSimple.passo2.pontosCalibr.splice(index, 1);
  atualizarListaPontos();
  showNotification('info', 'Ponto removido');
}

async function wizardPasso2_Avancar() {
  const pontos = wizardStateSimple.passo2.pontosCalibr;

  if (pontos.length < 2) {
    showNotification('error', 'Adicione pelo menos 2 pontos (ex: 0kg e um peso conhecido)');
    return false;
  }

  // Verifica se tem ponto zero
  const temZero = pontos.some(p => p.m_kg === 0);
  if (!temZero) {
    const confirma = confirm('⚠️ Recomenda-se ter um ponto com 0kg. Continuar mesmo assim?');
    if (!confirma) return false;
  }

  console.log(`[Wizard] Prosseguindo com ${pontos.length} pontos`);
  wizardStateSimple.passo2.calibracaoCompleta = true;
  return true;
}

/**
 * PASSO 3: Calcular α e β por regressão linear
 *
 * Fórmulas:
 * α = S_Nm / S_NN
 * β = m̄ - α·N̄
 *
 * onde:
 * N̄ = média das leituras
 * m̄ = média das massas
 * S_NN = Σ(N_i - N̄)²
 * S_Nm = Σ(N_i - N̄)(m_i - m̄)
 */
async function wizardPasso3_Avancar() {
  const pontos = wizardStateSimple.passo2.pontosCalibr;

  console.log('[Wizard] Calculando regressão linear...');

  // 1. Médias
  const n = pontos.length;
  const N_mean = pontos.reduce((sum, p) => sum + p.N_leitura, 0) / n;
  const m_mean = pontos.reduce((sum, p) => sum + p.m_kg, 0) / n;

  console.log(`  N̄=${N_mean.toFixed(4)}, m̄=${m_mean.toFixed(4)}`);

  // 2. Somas de quadrados
  let S_NN = 0;
  let S_Nm = 0;

  pontos.forEach(p => {
    const dN = p.N_leitura - N_mean;
    const dm = p.m_kg - m_mean;
    S_NN += dN * dN;
    S_Nm += dN * dm;
  });

  console.log(`  S_NN=${S_NN.toFixed(4)}, S_Nm=${S_Nm.toFixed(4)}`);

  // 3. Calcula α e β
  const alpha = S_Nm / S_NN;  // kg/N
  const beta = m_mean - alpha * N_mean;  // kg

  console.log(`  α=${alpha.toFixed(6)} kg/N`);
  console.log(`  β=${beta.toFixed(6)} kg`);

  // 4. Avalia qualidade (R² e erro máximo)
  let SS_res = 0;  // Soma dos quadrados dos resíduos
  let SS_tot = 0;  // Soma total dos quadrados
  let erroMax = 0;

  pontos.forEach(p => {
    const m_pred = alpha * p.N_leitura + beta;
    const erro = p.m_kg - m_pred;

    SS_res += erro * erro;
    SS_tot += Math.pow(p.m_kg - m_mean, 2);

    if (Math.abs(erro) > Math.abs(erroMax)) {
      erroMax = erro;
    }
  });

  const r2 = 1 - (SS_res / SS_tot);

  console.log(`  R²=${r2.toFixed(6)}, Erro máx=${(erroMax*1000).toFixed(2)}g`);

  // 5. Calcula tolerância para estabilização
  // tolerância = max(3·σ, ΔN_erro_desejado)
  // onde ΔN_erro_desejado = erro_desejado / α

  const ruidoStd = wizardStateSimple.passo0.ruidoStd;  // σ em N
  const erroDesejadomKg = wizardStateSimple.passo1.erroMaximoKg;

  const toleranciaRuido = 3 * ruidoStd;  // 3σ em N
  const toleranciaErro = erroDesejadomKg / alpha;  // Converte erro de kg para N

  // Usa o maior valor para garantir estabilidade
  const toleranciaN = Math.max(toleranciaRuido, toleranciaErro);

  console.log(`  Tolerância ruído (3σ)=${toleranciaRuido.toFixed(6)}N`);
  console.log(`  Tolerância erro desejado=${toleranciaErro.toFixed(6)}N`);
  console.log(`  Tolerância final=max(${toleranciaRuido.toFixed(6)}, ${toleranciaErro.toFixed(6)})=${toleranciaN.toFixed(6)}N`);

  // Salva
  wizardStateSimple.passo3.alpha = alpha;
  wizardStateSimple.passo3.beta = beta;
  wizardStateSimple.passo3.erroMaximoMedido = erroMax;
  wizardStateSimple.passo3.r2 = r2;
  wizardStateSimple.passo3.toleranciaN = toleranciaN;

  // Exibe resultados
  document.getElementById('wizard-alpha-valor').textContent = alpha.toFixed(8);
  document.getElementById('wizard-beta-valor').textContent = beta.toFixed(8);
  document.getElementById('wizard-r2-valor').textContent = r2.toFixed(6);
  document.getElementById('wizard-erro-max-valor').textContent = (Math.abs(erroMax) * 1000).toFixed(2);

  // Exibe tolerância calculada
  const toleranciaKgCalc = toleranciaN / 9.80665;      // N → kg
  const toleranciaG = toleranciaKgCalc * 1000;         // kg → g
  const conversionFactorCalc = 1000 / (alpha * 9.80665);  // contagens/g (ESP32 usa g, não kg!)
  const toleranciaADC_display = toleranciaG * conversionFactorCalc;  // g → contagens HX711

  document.getElementById('wizard-tolerancia-final').textContent =
    `${toleranciaN.toFixed(6)} N (≈${toleranciaG.toFixed(2)} g) = ${toleranciaADC_display.toFixed(0)} contagens`;

  document.getElementById('wizard-resultado-regressao').style.display = 'block';

  // Verifica qualidade
  if (r2 < 0.999) {
    showNotification('warning', `⚠️ R²=${r2.toFixed(4)} baixo. Verifique linearidade da célula.`);
  }

  if (Math.abs(erroMax) > erroDesejadomKg) {
    showNotification('warning', `⚠️ Erro máximo (${(Math.abs(erroMax)*1000).toFixed(2)}g) excede meta (${(erroDesejadomKg*1000).toFixed(2)}g)`);
  }

  // Faz tara final
  await enviarComandoPromise('t');
  await sleep(500);

  console.log('[Wizard] Regressão concluída!');
  return true;
}

/**
 * Navegação
 */
async function wizardGoToStepSimple(direction) {
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

    if (!sucesso) return;
  }

  const newStep = wizardCurrentStepSimple + direction;

  if (newStep >= 0 && newStep <= WIZARD_TOTAL_STEPS_SIMPLE) {
    wizardCurrentStepSimple = newStep;
    wizardGoToStepDisplay(newStep);
  }
}

function wizardGoToStepDisplay(stepNumber) {
  document.querySelectorAll('.wizard-step').forEach(step => {
    step.style.display = 'none';
  });

  const currentStepEl = document.getElementById(`wizard-step-${stepNumber}`);
  if (currentStepEl) {
    currentStepEl.style.display = 'block';
  }

  wizardUpdateUISimple();

  if ([0, 2].includes(stepNumber)) {
    wizardStartRealtimeReading(stepNumber);
  } else {
    wizardStopRealtimeReading();
  }
}

function wizardUpdateUISimple() {
  const progressBar = document.querySelector('.wizard-progress-bar');
  const progress = (wizardCurrentStepSimple / WIZARD_TOTAL_STEPS_SIMPLE) * 100;
  progressBar.style.width = `${progress}%`;

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
      leituraEl.textContent = `${forcaN.toFixed(4)} N (${kgf} kgf)`;
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
 * Finalização: Salvar α, β e tolerância no ESP32
 */
async function wizardFinishSimple() {
  const alpha = wizardStateSimple.passo3.alpha;
  const beta = wizardStateSimple.passo3.beta;
  const toleranciaN = wizardStateSimple.passo3.toleranciaN;
  const capacidadeKg = wizardStateSimple.passo1.capacidadeKg;
  const acuracia = wizardStateSimple.passo1.acuraciaPercent / 100;

  // Converte tolerância de N para contagens brutas do HX711
  //
  // Modelo do wizard: m = α·N + β, onde:
  //   - m está em kg
  //   - N está em Newtons (força medida)
  //   - α está em kg/N
  //
  // ESP32 usa: conversionFactor em contagens/grama
  //   - loadcell.get_units() = contagens_brutas / conversionFactor
  //   - Portanto: contagens = gramas × conversionFactor
  //
  // Conversão:
  //   1. toleranciaN (N) → toleranciaKg (kg): dividir por g = 9.80665
  //   2. toleranciaKg (kg) → toleranciaG (g): multiplicar por 1000
  //   3. toleranciaG (g) → contagens HX711: multiplicar por conversionFactor
  //
  // Cálculo do conversionFactor a partir de α:
  //   - α = kg/N, então α·g = kg/(kg·g/kg) = 1/g em kg/N
  //   - Para 1 grama: força = 0.001 kg × g = 0.00981 N
  //   - ΔN para 1g = 0.00981 N
  //   - Δcontagens = 1g × conversionFactor
  //   - α relaciona kg com N: m(kg) = α × F(N)
  //   - Para obter conversionFactor: 1g causa ΔN = g/1000 × 1/α
  //   - conversionFactor = Δcontagens / Δgramas
  //   - Simplificando: conversionFactor ≈ 1 / (α × g × 1000)

  const toleranciaKg = toleranciaN / 9.80665;      // N → kg
  const toleranciaG = toleranciaKg * 1000;         // kg → g
  const conversionFactor = 1000 / (alpha * 9.80665);  // contagens/g (corrigido!)
  let toleranciaADC = toleranciaG * conversionFactor;  // g → contagens HX711

  // SEGURANÇA: Garante valor mínimo de 50 contagens
  if (toleranciaADC < 50) {
    console.warn(`[Wizard] Tolerância muito baixa (${toleranciaADC.toFixed(1)}), usando mínimo de 50 contagens`);
    toleranciaADC = 50;
  }

  // Arredonda para inteiro
  toleranciaADC = Math.round(toleranciaADC);

  // Atualiza resumo no Passo 4
  document.getElementById('wizard-resumo-capacidade').textContent = capacidadeKg.toFixed(2);
  document.getElementById('wizard-resumo-alpha').textContent = alpha.toFixed(8);
  document.getElementById('wizard-resumo-beta').textContent = beta.toFixed(8);
  document.getElementById('wizard-resumo-tolerancia').textContent =
    `${(toleranciaN * 1000 / 9.80665).toFixed(2)} g (${toleranciaADC.toFixed(0)} contagens)`;

  console.log('[Wizard] Salvando no ESP32...');
  console.log(`  α=${alpha.toFixed(8)} kg/N, β=${beta.toFixed(8)} kg`);
  console.log(`  conversionFactor=${conversionFactor.toFixed(2)} contagens/g`);
  console.log(`  Tolerância=${toleranciaN.toFixed(6)}N = ${toleranciaG.toFixed(2)}g`);
  console.log(`  Tolerância ADC=${toleranciaADC} contagens HX711 (mín: 50)`);

  // Valida valores antes de enviar
  if (!isFinite(toleranciaADC) || toleranciaADC < 0) {
    throw new Error(`Tolerância inválida: ${toleranciaADC}`);
  }

  if (!isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new Error(`Fator de conversão inválido: ${conversionFactor}`);
  }

  try {
    // Salva configurações no ESP32
    await enviarComandoPromise('set', { param: 'capacidadeMaximaGramas', value: capacidadeKg * 1000 });
    await sleep(100);
    await enviarComandoPromise('set', { param: 'percentualAcuracia', value: acuracia });
    await sleep(100);
    await enviarComandoPromise('set', { param: 'toleranciaEstabilidade', value: toleranciaADC });
    await sleep(100);
    await enviarComandoPromise('set', { param: 'conversionFactor', value: conversionFactor });
    await sleep(100);

    // Se o ESP32 suportar salvar α e β diretamente:
    // await enviarComandoPromise('set', { param: 'alpha', value: alpha });
    // await enviarComandoPromise('set', { param: 'beta', value: beta });

    showNotification('success', '✅ Calibração salva no ESP32!');

    setTimeout(() => {
      closeWizard();
    }, 2000);

  } catch (error) {
    console.error('[Wizard] Erro ao salvar:', error);
    showNotification('error', 'Erro ao salvar configurações');
  }
}

/**
 * Funções auxiliares
 */
async function coletarAmostrasRuido(duracaoMs) {
  return new Promise((resolve) => {
    const amostras = [];

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
    setTimeout(resolve, 300);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Abertura do wizard
window.openWizardSimplificado = async function() {
  const modal = document.getElementById('wizard-modal');
  modal.style.display = 'block';
  wizardCurrentStepSimple = 0;

  // Reseta estado
  wizardStateSimple = {
    passo0: { nZero: 0, ruidoStd: 0, amostrasColetadas: 0 },
    passo1: { capacidadeKg: 0, acuraciaPercent: 0.03, erroMaximoKg: 0 },
    passo2: { pontosCalibr: [], pesoAtualKg: 0, calibracaoCompleta: false },
    passo3: { alpha: 0, beta: 0, erroMaximoMedido: 0, r2: 0, toleranciaN: 0 }
  };

  // Limpa lista de pontos
  const listaEl = document.getElementById('wizard-lista-pontos');
  if (listaEl) {
    listaEl.innerHTML = '<p style="color: var(--cor-texto-secundario);">Nenhum ponto coletado ainda</p>';
  }

  // CONFIGURAÇÃO INICIAL SEGURA - Previne travamento
  console.log('[Wizard] Aplicando configuração inicial segura...');

  // Mostra mensagem de carregamento
  const loadingMsg = document.createElement('div');
  loadingMsg.id = 'wizard-loading-config';
  loadingMsg.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--cor-fundo-secundario); padding: 2rem; border-radius: 8px; z-index: 10001; text-align: center;';
  loadingMsg.innerHTML = '<p style="margin: 0; font-size: 1.1rem;">⚙️ Configurando parâmetros seguros...</p><p style="margin-top: 0.5rem; color: var(--cor-texto-secundario); font-size: 0.9rem;">Aguarde...</p>';
  modal.appendChild(loadingMsg);

  try {
    // Aumenta tolerância para valor alto (previne timeout)
    await enviarComandoPromise('set', { param: 'toleranciaEstabilidade', value: 5000 });
    await sleep(50);

    // Reduz leituras estáveis necessárias
    await enviarComandoPromise('set', { param: 'leiturasEstaveis', value: 5 });
    await sleep(50);

    // Aumenta timeout de calibração
    await enviarComandoPromise('set', { param: 'timeoutCalibracao', value: 30000 });
    await sleep(50);

    console.log('[Wizard] ✅ Configuração inicial aplicada');
  } catch (error) {
    console.error('[Wizard] ⚠️ Erro ao aplicar config inicial:', error);
  } finally {
    // Remove mensagem de carregamento
    if (loadingMsg && loadingMsg.parentNode) {
      loadingMsg.parentNode.removeChild(loadingMsg);
    }
  }

  wizardGoToStepDisplay(0);
};

console.log('[Wizard Calibração - Modelo m=α·N+β] Carregado');
