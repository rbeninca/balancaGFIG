function closeWizard() {
  const modal = document.getElementById('wizard-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  // Para a leitura em tempo real se o wizard for fechado
  if (typeof wizardStopRealtimeReading === 'function') {
    wizardStopRealtimeReading();
  }
}

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
    ruidoStd: 0,                 // Desvio padrão do ruído (sem carga)
    amostrasColetadas: 0
  },
  passo1: {
    capacidadeKg: 0,             // Capacidade nominal da célula (informada)
    acuraciaPercent: 0.03,       // Acurácia (informada, ex: 0.03% = classe C3)
    erroMaximoKg: 0              // Erro máximo derivado
  },
  passo2: {
    nZero: 0,                    // N_zero: leitura com balança vazia
    massaZeroColetada: false
  },
  passo3: {
    pontosCalibr: [],            // Array de {m_kg, N_leitura} com massas conhecidas
    calibracaoCompleta: false
  },
  passo4: {
    alpha: 0,                    // Ganho calculado (kg/N)
    beta: 0,                     // Offset calculado (kg)
    erroMaximoMedido: 0,         // Maior erro encontrado nos pontos
    r2: 0,                       // Coeficiente de determinação (qualidade)
    regressaoCompleta: false
  },
  passo5: {
    toleranciaN: 0,              // Tolerância calculada (contagens ADC)
    salvarTolerancia: true,      // Checkbox: salvar tolerância
    salvarErroMaximo: false      // Checkbox: salvar erro máximo
  }
};

let wizardCurrentStepSimple = 0;
const WIZARD_TOTAL_STEPS_SIMPLE = 6;  // Agora são 7 passos (0-6)
let wizardRealtimeInterval = null;

/**
 * PASSO 0: Medir ruído do sistema (sem carga)
 */
async function wizardPasso0_Avancar() {
  console.log('[Wizard] Passo 0: Medindo ruído do sistema (sem carga)...');

  const btnNext = document.getElementById('wizard-btn-next');
  const originalText = btnNext.textContent;
  btnNext.disabled = true;
  btnNext.textContent = '⏳ Analisando (5s)...';

  try {
    // Coleta amostras em 5 segundos para medir ruído
    console.log('[Wizard] Coletando amostras para análise de ruído...');
    const amostras = await coletarAmostrasRuido(5000);

    if (amostras.length < 10) {
      throw new Error('Poucas amostras coletadas. Verifique conexão.');
    }

    // Calcula ruído (desvio padrão)
    const media = amostras.reduce((a, b) => a + b, 0) / amostras.length;
    const variancia = amostras.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / amostras.length;
    const ruidoStd = Math.sqrt(variancia);

    // Salva
    wizardStateSimple.passo0.ruidoStd = ruidoStd;
    wizardStateSimple.passo0.amostrasColetadas = amostras.length;

    // Exibe o ruído medido
    document.getElementById('wizard-ruido-medido').textContent = `${ruidoStd.toFixed(6)} N (σ)`;
    document.getElementById('wizard-analise-status').style.display = 'block';

    console.log(`[Wizard] Passo 0 completo: σ=${ruidoStd.toFixed(6)}N (${amostras.length} amostras)`);

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
 * PASSO 1: Definir capacidade e acurácia (especificações do fabricante)
 * Estes valores são INFORMADOS pelo usuário, não calculados.
 * Exemplos: 5kg/0.03% (classe C3), 10kg/0.02% (classe C4)
 * A tolerância será calculada no Passo 3 com base nestes valores + ruído medido
 */
function calculateStabilityParameters() {
    const capacityKgInput = document.getElementById('wizard-capacity-input');
    const accuracyPercentInput = document.getElementById('wizard-accuracy-input');

    const capacityKg = parseFloat(capacityKgInput.value) || 0; // Default to 0 if empty/NaN
    const accuracyPercent = parseFloat(accuracyPercentInput.value) || 0; // Default to 0 if empty/NaN

    // Se ambos forem 0, não exibe a tolerância calculada ainda
    if (capacityKg === 0 && accuracyPercent === 0) {
        document.getElementById('wizard-tolerancia-calculada').style.display = 'none';
        wizardStateSimple.passo1.capacidadeKg = 0;
        wizardStateSimple.passo1.acuraciaPercent = 0;
        wizardStateSimple.passo1.erroMaximoKg = 0;
        return;
    }

    // Salva os valores no estado do wizard
    wizardStateSimple.passo1.capacidadeKg = capacityKg;
    wizardStateSimple.passo1.acuraciaPercent = accuracyPercent;
    
    // Deriva o erro máximo aceitável da capacidade e acurácia informadas
    const maxErrorGrams = (capacityKg * 1000) * (accuracyPercent / 100);
    wizardStateSimple.passo1.erroMaximoKg = maxErrorGrams / 1000;

    // Exibe apenas o erro máximo esperado
    document.getElementById('wizard-erro-maximo-valor').textContent = `${maxErrorGrams.toFixed(2)}`;
    document.getElementById('wizard-tolerancia-valor').textContent = `Será calculada após calibração`;
    document.getElementById('wizard-tolerancia-calculada').style.display = 'block';

    console.log(`[Wizard] Especificações informadas (fabricante):`);
    console.log(`  Capacidade: ${capacityKg}kg`);
    console.log(`  Acurácia: ${accuracyPercent}%`);
    console.log(`  Erro máximo derivado: ${maxErrorGrams.toFixed(2)}g`);
    console.log(`[Wizard] A tolerância será calculada no Passo 3 (baseada em: erro + ruído medido)`);
}


function wizardPasso1_Validar() {
  const capacidadeKg = parseFloat(document.getElementById('wizard-capacity-input').value) || 0;
  const acuracia = parseFloat(document.getElementById('wizard-accuracy-input').value) || 0;
  if (capacidadeKg <= 0 || acuracia <= 0) {
    showNotification('error', 'Informe a capacidade e a acurácia da célula.');
    return false;
  }
  return true;
}

/**
 * PASSO 2: Coletar ponto zero (balança vazia)
 */
async function wizardPasso2_Avancar() {
  console.log('[Wizard] Passo 2: Coletando ponto zero (balança vazia)...');

  const btnNext = document.getElementById('wizard-btn-next');
  const originalText = btnNext.textContent;
  btnNext.disabled = true;
  btnNext.textContent = '⏳ Coletando (3s)...';

  try {
    // Faz tara
    await enviarComandoPromise('t');
    await sleep(500);

    // Coleta leitura com balança vazia
    const amostras = await coletarAmostrasRuido(3000);
    const nZero = amostras.reduce((a, b) => a + b, 0) / amostras.length;

    // Salva
    wizardStateSimple.passo2.nZero = nZero;
    wizardStateSimple.passo2.massaZeroColetada = true;

    // Adiciona automaticamente o ponto zero nos pontos de calibração
    wizardStateSimple.passo3.pontosCalibr.push({
      m_kg: 0,
      N_leitura: nZero
    });

    console.log(`[Wizard] Passo 2 completo: Leitura ADC zero=${nZero.toFixed(0)}`);
    showNotification('success', `✅ Ponto zero coletado: ${nZero.toFixed(0)} (ADC)`);

    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return true;

  } catch (error) {
    console.error('[Wizard] Erro no Passo 2:', error);
    showNotification('error', 'Erro ao coletar ponto zero');
    btnNext.disabled = false;
    btnNext.textContent = originalText;
    return false;
  }
}

/**
 * PASSO 3: Coletar massas conhecidas para calibração
 * Usuário adiciona vários pesos
 */
async function wizardAdicionarPonto() {
  const pesoG = parseFloat(document.getElementById('wizard-peso-conhecido').value) || 0;

  if (pesoG <= 0) {
    showNotification('error', 'Informe um peso maior que zero');
    return;
  }

  const pesoKg = pesoG / 1000;

  try {
    // Coleta média de leituras (3 segundos)
    const amostras = await coletarAmostrasRuido(3000);
    const nLeitura = amostras.reduce((a, b) => a + b, 0) / amostras.length;

    // Adiciona ponto
    wizardStateSimple.passo3.pontosCalibr.push({
      m_kg: pesoKg,
      N_leitura: nLeitura
    });

    console.log(`[Wizard] Ponto adicionado: m=${pesoKg}kg, Leitura ADC=${nLeitura.toFixed(0)}`);
    showNotification('success', `✅ Ponto ${wizardStateSimple.passo3.pontosCalibr.length}: ${pesoG}g = ${nLeitura.toFixed(0)} (ADC)`);

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

  const pontos = wizardStateSimple.passo3.pontosCalibr;

  if (pontos.length === 0) {
    listaEl.innerHTML = '<p style="color: var(--cor-texto-secundario);">Ponto zero já coletado. Adicione massas conhecidas.</p>';
    return;
  }

  let html = '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
  html += '<tr><th>#</th><th>Massa (kg)</th><th>Leitura (ADC)</th><th>Ação</th></tr>';

  pontos.forEach((p, i) => {
    const canDelete = p.m_kg > 0; // Não pode deletar o ponto zero
    html += `<tr>
      <td>${i + 1}</td>
      <td>${p.m_kg.toFixed(3)}</td>
      <td>${p.N_leitura.toFixed(0)}</td>
      <td>${canDelete ? `<button onclick="removerPonto(${i})" class="btn btn-secundario" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">🗑️</button>` : '-'}</td>
    </tr>`;
  });

  html += '</table>';
  listaEl.innerHTML = html;
}

function removerPonto(index) {
  const ponto = wizardStateSimple.passo3.pontosCalibr[index];
  if (ponto.m_kg === 0) {
    showNotification('error', 'Não é possível remover o ponto zero');
    return;
  }
  wizardStateSimple.passo3.pontosCalibr.splice(index, 1);
  atualizarListaPontos();
  showNotification('info', 'Ponto removido');
}

async function wizardPasso3_Avancar() {
  const pontos = wizardStateSimple.passo3.pontosCalibr;

  // Deve ter pelo menos 2 pontos (zero + 1 massa conhecida)
  if (pontos.length < 2) {
    showNotification('error', 'Adicione pelo menos um peso conhecido além do zero');
    return false;
  }

  console.log(`[Wizard] Prosseguindo com ${pontos.length} pontos para regressão`);
  wizardStateSimple.passo3.calibracaoCompleta = true;

  // Calcula a regressão ANTES de avançar para o Passo 4
  // Assim o usuário vê os resultados quando chegar no passo
  await calcularRegressao();

  return true;
}

/**
 * Calcula a regressão linear (chamada do Passo 3)
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
async function calcularRegressao() {
  const pontos = wizardStateSimple.passo3.pontosCalibr;

  console.log('[Wizard] Calculando regressão linear...');

  // 1. Médias
  const n = pontos.length;
  const N_mean = pontos.reduce((sum, p) => sum + p.N_leitura, 0) / n;
  const m_mean = pontos.reduce((sum, p) => sum + p.m_kg, 0) / n;

  console.log(`  N̄=${N_mean.toFixed(0)}, m̄=${m_mean.toFixed(4)}`);

  // 2. Somas de quadrados
  let S_NN = 0;
  let S_Nm = 0;

  pontos.forEach(p => {
    const dN = p.N_leitura - N_mean;
    const dm = p.m_kg - m_mean;
    S_NN += dN * dN;
    S_Nm += dN * dm;
  });

  console.log(`  S_NN=${S_NN.toFixed(0)}, S_Nm=${S_Nm.toFixed(4)}`);

  // 3. Calcula α e β
  const alpha = S_Nm / S_NN;  // kg/unidade_ADC
  const beta = m_mean - alpha * N_mean;  // kg

  console.log(`  α=${alpha.toFixed(8)} kg/ADC`);
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

  // 5. Calcula tolerância para estabilização com alpha REAL
  // Usa: capacidade e acurácia INFORMADAS (Passo 1) + ruído MEDIDO (Passo 0) + alpha CALCULADO (regressão)
  const capacidadeKg = wizardStateSimple.passo1.capacidadeKg;        // Informado pelo usuário
  const acuraciaPercent = wizardStateSimple.passo1.acuraciaPercent;  // Informado pelo usuário
  const ruidoStdN = wizardStateSimple.passo0.ruidoStd;              // Medido no Passo 0 (em N)

  // Fator de conversão real: contagens/grama (calculado com alpha da regressão)
  const conversionFactorReal = 1 / (alpha * 9.80665 / 1000); // contagens/g

  // === CÁLCULO DA TOLERÂNCIA MÍNIMA ===
  // A tolerância NUNCA pode ser inferior a: (capacidade × acurácia) + ruído
  // onde todos os valores são convertidos para a mesma unidade (gramas)

  // 1. Erro da célula (derivado das especificações do fabricante informadas)
  const erroCelulaGramas = (capacidadeKg * 1000) * (acuraciaPercent / 100);

  // 2. Ruído do sistema (medido no Passo 0, convertido para gramas)
  const ruidoGramas = (ruidoStdN / 9.80665) * 1000; // N → kgf → g

  // 3. Tolerância mínima = erro da célula + ruído medido
  // Multiplicamos por 1.5 para dar margem de segurança na estabilização
  const toleranciaMinGramas = (erroCelulaGramas + ruidoGramas) * 1.5;

  // 4. Converte para contagens ADC
  let toleranciaADC = toleranciaMinGramas * conversionFactorReal;

  // Garantir um mínimo absoluto (ruído típico do HX711)
  const minimoAbsoluto = 100; // contagens

  if (toleranciaADC < minimoAbsoluto) {
    toleranciaADC = minimoAbsoluto;
    console.warn(`[Wizard] Tolerância ajustada para mínimo absoluto: ${minimoAbsoluto} (ruído do HX711)`);
  }

  // Valores para exibição
  const toleranciaEmGramas = toleranciaADC / conversionFactorReal;

  console.log(`[Wizard] Tolerância calculada com alpha real:`);
  console.log(`  Erro da célula (fabricante): ${erroCelulaGramas.toFixed(2)}g`);
  console.log(`  Ruído medido: ${ruidoGramas.toFixed(2)}g (σ=${ruidoStdN.toFixed(6)}N)`);
  console.log(`  Tolerância mínima: (${erroCelulaGramas.toFixed(2)} + ${ruidoGramas.toFixed(2)}) × 1.5 = ${toleranciaMinGramas.toFixed(2)}g`);
  console.log(`  Fator conversão: ${conversionFactorReal.toFixed(2)} cont/g`);
  console.log(`  Tolerância final: ${toleranciaADC.toFixed(0)} contagens (≈ ${toleranciaEmGramas.toFixed(2)}g)`);

  // Salva
  wizardStateSimple.passo4.alpha = alpha;
  wizardStateSimple.passo4.beta = beta;
  wizardStateSimple.passo4.erroMaximoMedido = erroMax;
  wizardStateSimple.passo4.r2 = r2;
  wizardStateSimple.passo4.regressaoCompleta = true;
  wizardStateSimple.passo5.toleranciaN = toleranciaADC;

  // Exibe resultados
  document.getElementById('wizard-alpha-valor').textContent = alpha.toFixed(8);
  document.getElementById('wizard-beta-valor').textContent = beta.toFixed(8);
  document.getElementById('wizard-r2-valor').textContent = r2.toFixed(6);
  document.getElementById('wizard-erro-max-valor').textContent = (Math.abs(erroMax) * 1000).toFixed(2);

  // Exibe tolerância calculada com componentes
  document.getElementById('wizard-tolerancia-final').textContent =
    `${toleranciaADC.toFixed(0)} contagens (≈${toleranciaEmGramas.toFixed(2)} g)\n` +
    `Baseado em: Erro célula (${erroCelulaGramas.toFixed(2)}g) + Ruído medido (${ruidoGramas.toFixed(2)}g) × 1.5`;

  // Desenha gráfico da regressão
  desenharGraficoRegressao(pontos, alpha, beta);

  document.getElementById('wizard-resultado-regressao').style.display = 'block';

  // Verifica qualidade
  if (r2 < 0.999) {
    showNotification('warning', `⚠️ R²=${r2.toFixed(4)} baixo. Verifique linearidade da célula.`);
  }

  // Compara o erro medido da regressão com o erro esperado da célula (informado no Passo 1)
  const erroEsperadoKg = wizardStateSimple.passo1.erroMaximoKg;
  if (Math.abs(erroMax) > erroEsperadoKg) {
    showNotification('warning', `⚠️ Erro da regressão (${(Math.abs(erroMax)*1000).toFixed(2)}g) excede especificação da célula (${(erroEsperadoKg*1000).toFixed(2)}g)`);
  } else {
    showNotification('success', `✅ Erro da regressão (${(Math.abs(erroMax)*1000).toFixed(2)}g) está dentro da especificação (${(erroEsperadoKg*1000).toFixed(2)}g)`);
  }

  // Faz tara final
  await enviarComandoPromise('t');
  await sleep(500);

  console.log('[Wizard] Regressão concluída!');
}

/**
 * PASSO 4: Visualizar resultados da regressão
 * Os cálculos já foram feitos no Passo 3, aqui apenas visualizamos
 */
async function wizardPasso4_Avancar() {
  // Verifica se a regressão foi calculada
  if (!wizardStateSimple.passo4.regressaoCompleta) {
    showNotification('error', 'Erro: regressão não foi calculada');
    return false;
  }

  console.log('[Wizard] Passo 4: Visualização dos resultados confirmada');
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
      case 4:
        sucesso = await wizardPasso4_Avancar(); // This step now only validates, graph is in next step
        break;
      case 5: // New graph step, no advance logic needed here
        sucesso = true;
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

  // Inicia leitura em tempo real nos passos que precisam
  if ([0, 2, 3].includes(stepNumber)) {
    wizardStartRealtimeReading(stepNumber);
  } else {
    wizardStopRealtimeReading();
  }

  // Exibe resumo ao entrar no Passo 6
  if (stepNumber === 6) {
    wizardPasso6_ExibirResumo(); // Renamed function
  } else if (stepNumber === 5) { // New graph step
    // Ensure graph is drawn when entering this step
    const pontos = wizardStateSimple.passo3.pontosCalibr;
    const alpha = wizardStateSimple.passo4.alpha;
    const beta = wizardStateSimple.passo4.beta;
    if (pontos.length > 0 && alpha !== 0) { // Only draw if data exists
      desenharGraficoRegressao(pontos, alpha, beta);
    }
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
      const dataPoint = await lerValorAtualBalanca();
      const adc = dataPoint.raw.toFixed(0);
      const forcaN = dataPoint.forca.toFixed(3);
      const gramas = (dataPoint.massaKg * 1000).toFixed(1);
      
      leituraEl.innerHTML = `ADC: ${adc}<br>Força: ${forcaN} N<br>Massa: ${gramas} g`;
    } catch (e) {
      leituraEl.textContent = '---';
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
 * PASSO 6: Exibe resumo ao entrar no passo
 * Mostra todos os dados calculados para o usuário revisar antes de salvar
 */
function wizardPasso6_ExibirResumo() {
  const alpha = wizardStateSimple.passo4.alpha;
  const beta = wizardStateSimple.passo4.beta;
  const toleranciaADC = wizardStateSimple.passo5.toleranciaN; // Calculado no passo 4
  const capacidadeKg = wizardStateSimple.passo1.capacidadeKg; // Carregado do ESP ou informado
  const acuracia = wizardStateSimple.passo1.acuraciaPercent; // Carregado do ESP ou informado

  // O conversionFactor é calculado a partir do alpha final
  const conversionFactor = 1 / (alpha * 1000); // contagens/kg
  const toleranciaEmGramas = toleranciaADC / conversionFactor;
  const erroMaximoGramas = (capacidadeKg * 1000) * (acuracia / 100);

  // Atualiza resumo no Passo 5
  document.getElementById('wizard-resumo-capacidade').textContent = capacidadeKg.toFixed(2);
  document.getElementById('wizard-resumo-alpha').textContent = alpha.toFixed(8);
  document.getElementById('wizard-resumo-beta').textContent = beta.toFixed(8);
  document.getElementById('wizard-resumo-tolerancia').textContent =
    `${toleranciaEmGramas.toFixed(2)} g (${toleranciaADC.toFixed(0)} contagens)`;
  document.getElementById('wizard-resumo-erro-maximo').textContent = erroMaximoGramas.toFixed(2);

  console.log('[Wizard] Resumo exibido no Passo 5:');
  console.log(`  α=${alpha.toFixed(8)} kg/ADC, β=${beta.toFixed(8)} kg`);
  console.log(`  conversionFactor=${conversionFactor.toFixed(2)} contagens/kg`);
  console.log(`  Tolerância=${toleranciaADC.toFixed(0)} contagens (${toleranciaEmGramas.toFixed(2)}g)`);
  console.log(`  Erro máximo=${erroMaximoGramas.toFixed(2)}g`);

  // Inicializa o estado dos checkboxes (padrão)
  document.getElementById('wizard-salvar-fator').checked = true;
  document.getElementById('wizard-salvar-capacidade').checked = false;
  document.getElementById('wizard-salvar-tolerancia').checked = false;
}

/**
 * PASSO 6: Salvar parâmetros no ESP32
 * Permite escolher quais parâmetros salvar via checkboxes
 */
async function wizardPasso6_Finalizar() {
  // Coleta os valores calculados e informados
  const alpha = wizardStateSimple.passo4.alpha;
  const nZero = wizardStateSimple.passo2.nZero;
  const toleranciaADC = wizardStateSimple.passo5.toleranciaN;
  const capacidadeKg = wizardStateSimple.passo1.capacidadeKg;
  const acuracia = wizardStateSimple.passo1.acuraciaPercent;

  // Coleta o estado dos checkboxes
  const salvarFatorOffset = document.getElementById('wizard-salvar-fator').checked;
  const salvarCapacidadeAcuracia = document.getElementById('wizard-salvar-capacidade').checked;
  const salvarTolerancia = document.getElementById('wizard-salvar-tolerancia').checked;

  // Calcula os parâmetros finais para o ESP
  const novoTareOffset = Math.round(nZero);
  const novoConversionFactor = 1 / (alpha * 1000);

  console.log('[Wizard] Finalizando... Opções de salvamento:');
  console.log(`  - Salvar Fator/Offset: ${salvarFatorOffset}`);
  console.log(`  - Salvar Capacidade/Acurácia: ${salvarCapacidadeAcuracia}`);
  console.log(`  - Salvar Tolerância: ${salvarTolerancia}`);

  try {
    // Salva Fator de Conversão e Offset de Tara (padrão)
    if (salvarFatorOffset) {
      if (!isFinite(novoConversionFactor) || !isFinite(novoTareOffset)) {
        showNotification('error', 'Fator de conversão ou Offset inválido. Não foi possível salvar.');
        return;
      }
      console.log(`[Wizard] Salvando Tare Offset: ${novoTareOffset}`);
      await enviarComandoPromise('set', { param: 'tareOffset', value: novoTareOffset });
      await sleep(100);
      
      console.log(`[Wizard] Salvando Conversion Factor: ${novoConversionFactor}`);
      await enviarComandoPromise('set', { param: 'conversionFactor', value: novoConversionFactor });
      await sleep(100);
    }

    // Salva Capacidade e Acurácia (opcional)
    if (salvarCapacidadeAcuracia) {
      console.log(`[Wizard] Salvando Capacidade: ${capacidadeKg * 1000}g`);
      await enviarComandoPromise('set', { param: 'capacidadeMaximaGramas', value: capacidadeKg * 1000 });
      await sleep(100);

      console.log(`[Wizard] Salvando Acurácia: ${acuracia}%`);
      await enviarComandoPromise('set', { param: 'percentualAcuracia', value: acuracia });
      await sleep(100);
    }

    // Salva Tolerância de Estabilização (opcional)
    if (salvarTolerancia) {
      console.log(`[Wizard] Salvando Tolerância: ${Math.round(toleranciaADC)} (ADC)`);
      await enviarComandoPromise('set', { param: 'toleranciaEstabilidade', value: Math.round(toleranciaADC) });
      await sleep(100);
    }

    showNotification('success', '✅ Configurações salvas no ESP32!');

    setTimeout(() => {
      closeWizard();
      sendCommandToWorker('get_config'); // Pede a config atualizada
    }, 1500);

  } catch (error) {
    console.error('[Wizard] Erro ao salvar:', error);
    showNotification('error', 'Erro ao salvar configurações no dispositivo.');
  }
}

/**
 * Desenha gráfico da regressão linear
 * @param {Array<Object>} pontos - Array de pontos {m_kg, N_leitura}
 * @param {number} alpha - Coeficiente alpha da regressão
 * @param {number} beta - Coeficiente beta da regressão
 * @param {string} canvasId - ID do elemento canvas onde o gráfico será desenhado
 * @param {string} angleDisplayId - ID do elemento onde o ângulo da regressão será exibido
 */
function desenharGraficoRegressao(pontos, alpha, beta, canvasId = 'wizard-grafico-canvas', angleDisplayId = 'regression-angle') {
  let canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.error(`[Wizard] Canvas com ID '${canvasId}' não encontrado.`);
    return;
  }

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const padding = 60;

  // Limpa canvas
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc'; // Cor de fundo do canvas
  ctx.fillRect(0, 0, width, height);

  // Encontra min/max para escala
  const N_values = pontos.map(p => p.N_leitura);
  const m_values = pontos.map(p => p.m_kg);
  const N_min_data = Math.min(...N_values);
  const N_max_data = Math.max(...N_values);
  const m_min_data = Math.min(...m_values);
  const m_max_data = Math.max(...m_values);

  // Adiciona uma margem aos min/max para que os pontos não fiquem na borda
  const N_range = N_max_data - N_min_data;
  const m_range = m_max_data - m_min_data;
  const N_min = N_min_data - N_range * 0.1;
  const N_max = N_max_data + N_range * 0.1;
  const m_min = m_min_data - m_range * 0.1;
  const m_max = m_max_data + m_range * 0.1;

  // Funções de escala
  const scaleX = (N) => padding + ((N - N_min) / (N_max - N_min)) * (width - 2 * padding);
  const scaleY = (m) => height - padding - ((m - m_min) / (m_max - m_min)) * (height - 2 * padding);

  // Desenha grade (linhas finas)
  ctx.strokeStyle = '#e2e8f0'; // Cor da grade
  ctx.lineWidth = 1;
  ctx.font = '10px Arial';
  ctx.fillStyle = '#64748b'; // Cor dos labels da grade

  // Eixo X (Leitura ADC)
  const numXTicks = 5;
  for (let i = 0; i <= numXTicks; i++) {
    const N_val = N_min + (N_max - N_min) * (i / numXTicks);
    const x = scaleX(N_val);
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding + 5); // Pequeno traço para fora
    ctx.stroke();
    ctx.fillText(N_val.toFixed(0), x, height - padding + 20);
  }

  // Eixo Y (Massa kg)
  const numYTicks = 5;
  for (let i = 0; i <= numYTicks; i++) {
    const m_val = m_min + (m_max - m_min) * (i / numYTicks);
    const y = scaleY(m_val);
    ctx.beginPath();
    ctx.moveTo(padding - 5, y); // Pequeno traço para fora
    ctx.lineTo(width - padding, y);
    ctx.stroke();
    ctx.fillText(m_val.toFixed(3), padding - 40, y + 3);
  }

  // Desenha eixos principais
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Labels dos eixos
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Leitura (ADC)', width / 2, height - 15);

  ctx.save();
  ctx.translate(15, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Massa (kg)', 0, 0);
  ctx.restore();

  // Desenha reta da regressão
  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 3;
  ctx.beginPath();
  const N_start_reg = N_min;
  const N_end_reg = N_max;
  const m_start_reg = alpha * N_start_reg + beta;
  const m_end_reg = alpha * N_end_reg + beta;
  ctx.moveTo(scaleX(N_start_reg), scaleY(m_start_reg));
  ctx.lineTo(scaleX(N_end_reg), scaleY(m_end_reg));
  ctx.stroke();

  // Calcula e exibe o ângulo da reta de regressão
  const angleRad = Math.atan(alpha * ( (width - 2 * padding) / (N_max - N_min) ) / ( (height - 2 * padding) / (m_max - m_min) ) ); // Ajusta para a escala do gráfico
  const angleDeg = (angleRad * 180 / Math.PI).toFixed(2);
  const angleEl = document.getElementById(angleDisplayId);
  if (angleEl) {
    angleEl.textContent = `${angleDeg}°`;
  }

  // Desenha pontos medidos
  pontos.forEach((p, i) => {
    const x = scaleX(p.N_leitura);
    const y = scaleY(p.m_kg);

    // Ponto
    ctx.fillStyle = p.m_kg === 0 ? '#e74c3c' : '#2ecc71';
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, 2 * Math.PI);
    ctx.fill();

    // Borda
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label do ponto
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${(p.m_kg * 1000).toFixed(0)}g`, x, y - 12);
  });

  // Legenda
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';

  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(width - 150, 30, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillText('Ponto zero', width - 135, 35);

  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(width - 150, 50, 6, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.fillText('Massas conhecidas', width - 135, 55);

  ctx.strokeStyle = '#3498db';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(width - 156, 70);
  ctx.lineTo(width - 144, 70);
  ctx.stroke();
  ctx.fillStyle = '#000000';
  ctx.fillText('Regressão linear', width - 135, 75);

  console.log('[Wizard] Gráfico da regressão desenhado');
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
        amostras.push(payload[0].raw);
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
        resolve(payload[0]); // Retorna o objeto de dados completo
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
  // Carrega o HTML do wizard dinamicamente se ainda não estiver no DOM
  if (!document.getElementById('wizard-modal')) {
    await loadWizardHtml();
  }

  let modal = document.getElementById('wizard-modal');
  if (!modal) { // Re-check in case it was just loaded
    await loadWizardHtml(); // Ensure it's loaded if somehow missed
    modal = document.getElementById('wizard-modal'); // Get it again after loading
  }

  if (!modal) { // If still null, something is seriously wrong
    console.error('[Wizard] Erro: Modal do wizard não encontrado após carregamento.');
    showNotification('error', 'Erro interno: Assistente de configuração não pode ser iniciado.');
    return;
  }

  modal.style.display = 'block';
  wizardCurrentStepSimple = 0;

  // Reseta estado
  wizardStateSimple = {
    passo0: { ruidoStd: 0, amostrasColetadas: 0 },
    passo1: { capacidadeKg: 0, acuraciaPercent: 0.03, erroMaximoKg: 0 },
    passo2: { nZero: 0, massaZeroColetada: false },
    passo3: { pontosCalibr: [], calibracaoCompleta: false },
    passo4: { alpha: 0, beta: 0, erroMaximoMedido: 0, r2: 0, regressaoCompleta: false },
    passo5: { toleranciaN: 0 } // Remove os checkboxes daqui, eles serão lidos do DOM
  };

  // Limpa lista de pontos
  const listaEl = document.getElementById('wizard-lista-pontos');
  if (listaEl) {
    listaEl.innerHTML = '<p style="color: var(--cor-texto-secundario);">Ponto zero será coletado automaticamente</p>';
  }

  // Mostra mensagem de carregamento
  const loadingMsg = document.createElement('div');
  loadingMsg.id = 'wizard-loading-config';
  loadingMsg.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--cor-fundo-secundario); padding: 2rem; border-radius: 8px; z-index: 10001; text-align: center;';
  loadingMsg.innerHTML = '<p style="margin: 0; font-size: 1.1rem;">⚙️ Carregando configurações atuais...</p><p style="margin-top: 0.5rem; color: var(--cor-texto-secundario); font-size: 0.9rem;">Aguarde...</p>';
  modal.appendChild(loadingMsg);

  // Solicita a configuração atual do ESP
  sendCommandToWorker('get_config');

  // Adiciona um listener temporário para a mensagem de configuração
  const configListener = (event) => {
    const { type, payload } = event.data;
    if (type === 'config') {
      // Remove o listener após receber a configuração
      dataWorker.removeEventListener('message', configListener);
      
      // Preenche os campos da Etapa 1 com os valores atuais
      document.getElementById('wizard-capacity-input').value = (payload.capacidadeMaximaGramas / 1000).toFixed(2); // Converte g para kg
      document.getElementById('wizard-accuracy-input').value = (payload.percentualAcuracia * 100).toFixed(3); // Converte % para decimal

      // Inicializa o estado do wizard com os valores carregados
      calculateStabilityParameters();

      // Remove mensagem de carregamento
      if (loadingMsg && loadingMsg.parentNode) {
        loadingMsg.parentNode.removeChild(loadingMsg);
      }

      // Aplica configuração inicial segura e avança para o Passo 0
      applySafeInitialConfig().then(() => {
        wizardGoToStepDisplay(0);
      });
    }
  };
  dataWorker.addEventListener('message', configListener);
};

// Função para carregar o HTML do wizard dinamicamente
async function loadWizardHtml() {
  try {
    console.log('[Wizard] Tentando carregar wizard_calibration.html...');
    const response = await fetch('wizard_calibration.html');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const html = await response.text();
    console.log('[Wizard] HTML de wizard_calibration.html recebido. Tamanho:', html.length);
    // console.log('[Wizard] Conteúdo HTML recebido:', html); // Uncomment for full HTML debug

    document.body.insertAdjacentHTML('beforeend', html); // Insere no final do body
    console.log('[Wizard] HTML do wizard inserido no DOM.');

    // Verify insertion immediately
    const insertedModal = document.getElementById('wizard-modal');
    if (insertedModal) {
      console.log('[Wizard] Modal do wizard encontrado no DOM após inserção.');
    } else {
      console.error('[Wizard] ERRO CRÍTICO: Modal do wizard NÃO encontrado no DOM após inserção.');
    }

  } catch (error) {
    console.error('[Wizard] Erro ao carregar HTML do wizard:', error);
    showNotification('error', 'Erro ao carregar o assistente de configuração: ' + error.message);
  }
}

// Função auxiliar para aplicar configurações iniciais seguras
async function applySafeInitialConfig() {
  console.log('[Wizard] Aplicando configuração inicial segura...');
  try {
    await enviarComandoPromise('set', { param: 'toleranciaEstabilidade', value: 5000 });
    await sleep(50);
    await enviarComandoPromise('set', { param: 'leiturasEstaveis', value: 5 });
    await sleep(50);
    await enviarComandoPromise('set', { param: 'timeoutCalibracao', value: 30000 });
    await sleep(50);
    console.log('[Wizard] ✅ Configuração inicial aplicada');
  } catch (error) {
    console.error('[Wizard] ⚠️ Erro ao aplicar config inicial:', error);
  }
}

console.log('[Wizard Calibração - Modelo m=α·N+β] Carregado');
