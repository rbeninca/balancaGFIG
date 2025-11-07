// ========== BURN ANALYSIS MODAL ==========
let burnAnalysisChart = null;
let currentBurnSession = null;
let burnStartTime = null;
let burnEndTime = null;

/**
 * Filtra dados de uma sessão baseado nos pontos de queima salvos pelo usuário
 * Se não houver pontos salvos, usa detecção automática
 * @param {Object} session - Sessão com dadosTabela
 * @returns {Object} Objeto com dados filtrados e metadados
 */
function aplicarPontosDeQueima(session) {
  if (!session || !session.dadosTabela) {
    return null;
  }

  const dados = processarDadosSimples(session.dadosTabela);

  // Verifica se há pontos de queima salvos
  const burnMetadata = session.burnMetadata || {};
  let startTime = burnMetadata.burnStartTime;
  let endTime = burnMetadata.burnEndTime;

  // Se não houver pontos salvos, detecta automaticamente
  if (startTime === null || startTime === undefined) {
    startTime = detectBurnStart(dados);
  }
  if (endTime === null || endTime === undefined) {
    endTime = detectBurnEnd(dados);
  }

  // Filtra dados dentro do intervalo de queima
  const dadosFiltrados = {
    tempos: [],
    newtons: [],
    kgf: []
  };

  for (let i = 0; i < dados.tempos.length; i++) {
    if (dados.tempos[i] >= startTime && dados.tempos[i] <= endTime) {
      dadosFiltrados.tempos.push(dados.tempos[i]);
      dadosFiltrados.newtons.push(dados.newtons[i]);
      if (dados.kgf && dados.kgf[i] !== undefined) {
        dadosFiltrados.kgf.push(dados.kgf[i]);
      }
    }
  }

  // Add calculated properties that are expected by PDF generation
  dadosFiltrados.duracao = dadosFiltrados.tempos.length > 0
    ? Math.max(...dadosFiltrados.tempos) - Math.min(...dadosFiltrados.tempos)
    : 0;
  dadosFiltrados.pontos = dadosFiltrados.tempos.length;

  return {
    dadosFiltrados: dadosFiltrados,
    dadosOriginais: dados,
    startTime: startTime,
    endTime: endTime,
    duration: endTime - startTime,
    usandoPontosPersonalizados: burnMetadata.burnStartTime !== null && burnMetadata.burnStartTime !== undefined
  };
}

async function abrirModalBurnAnalysis(sessionId, source) {
  try {
    // Buscar dados da sessão
    const session = await getSessionDataForExport(sessionId, source);

    if (!session || !session.dadosTabela || session.dadosTabela.length === 0) {
      showNotification('error', 'Sessão não encontrada ou sem dados.');
      return;
    }

    currentBurnSession = session;

    // Mostrar modal
    const modal = document.getElementById('modal-burn-analysis');
    modal.style.display = 'block';

    // Atualizar título
    document.getElementById('burn-modal-session-name').textContent = session.nome || `Sessão ${sessionId}`;

    // Preparar dados do gráfico
    const dadosProcessados = processarDadosSimples(session.dadosTabela);

    // Detectar pontos de queima automaticamente (ou usar salvos)
    const burnMetadata = session.burnMetadata || {};
    burnStartTime = burnMetadata.burnStartTime || detectBurnStart(dadosProcessados);
    burnEndTime = burnMetadata.burnEndTime || detectBurnEnd(dadosProcessados);

    // Atualizar informações de tempo do teste
    updateTestTimeInfo(session, dadosProcessados, burnStartTime, burnEndTime);

    // Renderizar gráfico
    renderBurnAnalysisChart(dadosProcessados);

    // Atualizar métricas
    updateBurnMetrics(dadosProcessados);

  } catch (error) {
    console.error('Erro ao abrir modal de análise:', error);
    showNotification('error', 'Erro ao carregar análise de queima.');
  }
}

function updateTestTimeInfo(session, dados, burnStart, burnEnd) {
  // Informações do teste estático (gravação completa)
  const testStartTime = session.data_inicio || session.timestamp;
  const testEndTime = session.data_fim;

  if (dados.tempos && dados.tempos.length > 0) {
    const firstReadingTime = Math.min(...dados.tempos);
    const lastReadingTime = Math.max(...dados.tempos);
    const totalDuration = lastReadingTime - firstReadingTime;
    const totalReadings = dados.tempos.length;
    const readingsPerSecond = totalDuration > 0 ? (totalReadings / totalDuration).toFixed(1) : '0.0';

    // Formatar tempo relativo no formato MM:SS.mmm
    const formatRelativeTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${String(mins).padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}s`;
    };

    // ======== TESTE COMPLETO ========
    if (testStartTime) {
      const startDate = new Date(testStartTime);
      // Mostrar apenas horário absoluto - tempo relativo é sempre 00:00.000s
      document.getElementById('burn-test-start-time-absolute').textContent = 
        startDate.toLocaleTimeString('pt-BR') + '.' + String(startDate.getMilliseconds()).padStart(3, '0');
    }

    if (testEndTime) {
      const endDate = new Date(testEndTime);
      const relativeTime = formatRelativeTime(totalDuration);
      document.getElementById('burn-test-end-time-absolute').textContent = 
        endDate.toLocaleTimeString('pt-BR') + '.' + String(endDate.getMilliseconds()).padStart(3, '0');
      document.getElementById('burn-test-end-time-relative').textContent = relativeTime;
    }

    document.getElementById('burn-test-duration').textContent = `${totalDuration.toFixed(3)} s`;
    document.getElementById('burn-test-total-readings').textContent = `${totalReadings} leituras`;
    document.getElementById('burn-test-readings-per-sec').textContent = `${readingsPerSecond}/s`;

    // ======== QUEIMA DETECTADA ========
    const burnDuration = burnEnd - burnStart;

    // Contar leituras dentro do intervalo de queima
    let burnReadings = 0;
    for (let i = 0; i < dados.tempos.length; i++) {
      if (dados.tempos[i] >= burnStart && dados.tempos[i] <= burnEnd) {
        burnReadings++;
      }
    }
    const burnReadingsPerSecond = burnDuration > 0 ? (burnReadings / burnDuration).toFixed(1) : '0.0';

    // Calcular horário absoluto da queima e tempo relativo ao início do teste
    if (testStartTime) {
      const testStartDate = new Date(testStartTime);

      // Tempo relativo ao início do teste (não ao primeiro reading)
      const burnStartRelative = burnStart - firstReadingTime;
      const burnEndRelative = burnEnd - firstReadingTime;

      // Início da queima
      const burnStartAbsolute = new Date(testStartDate.getTime() + burnStartRelative * 1000);
      document.getElementById('burn-detected-start-time-absolute').textContent =
        burnStartAbsolute.toLocaleTimeString('pt-BR') + '.' + String(burnStartAbsolute.getMilliseconds()).padStart(3, '0');
      document.getElementById('burn-detected-start-time-relative').textContent = formatRelativeTime(burnStartRelative);

      // Fim da queima
      const burnEndAbsolute = new Date(testStartDate.getTime() + burnEndRelative * 1000);
      document.getElementById('burn-detected-end-time-absolute').textContent =
        burnEndAbsolute.toLocaleTimeString('pt-BR') + '.' + String(burnEndAbsolute.getMilliseconds()).padStart(3, '0');
      document.getElementById('burn-detected-end-time-relative').textContent = formatRelativeTime(burnEndRelative);
    }

    document.getElementById('burn-detected-duration').textContent = `${burnDuration.toFixed(3)} s`;
    document.getElementById('burn-detected-total-readings').textContent = `${burnReadings} leituras`;
    document.getElementById('burn-detected-readings-per-sec').textContent = `${burnReadingsPerSecond}/s`;
  }
}

function fecharModalBurnAnalysis() {
  const modal = document.getElementById('modal-burn-analysis');
  modal.style.display = 'none';

  if (burnAnalysisChart) {
    burnAnalysisChart.destroy();
    burnAnalysisChart = null;
  }

  currentBurnSession = null;
  burnStartTime = null;
  burnEndTime = null;
}

function detectBurnStart(dados) {
  // Detecta o início da queima como o primeiro ponto onde a força > 5% da máxima
  const maxForce = Math.max(...dados.newtons);
  const threshold = maxForce * 0.05;

  for (let i = 0; i < dados.newtons.length; i++) {
    if (dados.newtons[i] > threshold) {
      return dados.tempos[i];
    }
  }

  return dados.tempos[0];
}

function detectBurnEnd(dados) {
  // Detecta o fim da queima como o último ponto onde a força > 5% da máxima
  const maxForce = Math.max(...dados.newtons);
  const threshold = maxForce * 0.05;

  for (let i = dados.newtons.length - 1; i >= 0; i--) {
    if (dados.newtons[i] > threshold) {
      return dados.tempos[i];
    }
  }

  return dados.tempos[dados.tempos.length - 1];
}

function renderBurnAnalysisChart(dados) {
  const chartContainer = document.getElementById('burn-analysis-chart');

  if (burnAnalysisChart) {
    burnAnalysisChart.destroy();
  }

  // Preparar dados para o gráfico
  const chartData = dados.tempos.map((t, i) => ({
    x: t,
    y: dados.newtons[i]
  }));

  // =============================
  // Cálculo de impulso cumulativo dentro da janela de queima
  // =============================
  // OVERLAP: pequeno valor para sobrepor intencionalmente os limites das faixas.
  // Por quê? Em gráficos de área com suavização/curvas e dados amostrados, é comum
  // surgirem fendas visuais entre faixas adjacentes devido a:
  //  - arredondamentos numéricos (ponto flutuante) no cálculo do impulso acumulado;
  //  - pontos amostrados não coincidirem exatamente com o instante do limite;
  //  - interpolação/suavização do traçado da área.
  // Estratégia: usamos um OVERLAP pequeno em torno dos limites (min/max) de cada faixa
  // e expandimos a máscara de pertencimento para incluir amostras vizinhas. Assim,
  // garantimos continuidade visual, mesmo que duas faixas se encontrem em um ponto
  // entre amostras ou que a curva desenhada "arqueie" levemente no contorno.
  // Observação: valores muito grandes podem causar sobreposição visível de cores.
  // Ajuste se necessário; 1e-4 a 1e-3 N·s costuma funcionar bem para dados típicos.
  const OVERLAP = 1e-4;
  const cumulativeImpulse = [];
  let impulsoAcumulado = 0;
  for (let i = 0; i < dados.tempos.length; i++) {
    if (i > 0) {
      const tPrev = dados.tempos[i - 1];
      const tCur = dados.tempos[i];
      if (tCur >= burnStartTime && tPrev >= burnStartTime && tCur <= burnEndTime) {
        const dt = tCur - tPrev;
        const f1 = dados.newtons[i - 1];
        const f2 = dados.newtons[i];
        const areaTrap = dt * (f1 + f2) / 2;
        if (areaTrap > 0) impulsoAcumulado += areaTrap;
      }
    }
    cumulativeImpulse.push(impulsoAcumulado);
  }

  // Tabela de classes (replicada para uso local de cores segmentadas)
  const classificacoes = [
    { min: 0.00,    max: 0.3125,   classe: 'Micro 1/8A', cor: '#8e44ad' },
    { min: 0.3126,  max: 0.625,    classe: '¼A',         cor: '#9b59b6' },
    { min: 0.626,   max: 1.25,     classe: '½A',         cor: '#e74c3c' },
    { min: 1.26,    max: 2.50,     classe: 'A',          cor: '#e67e22' },
    { min: 2.51,    max: 5.00,     classe: 'B',          cor: '#f39c12' },
    { min: 5.01,    max: 10.00,    classe: 'C',          cor: '#f1c40f' },
    { min: 10.01,   max: 20.00,    classe: 'D',          cor: '#2ecc71' },
    { min: 20.01,   max: 40.00,    classe: 'E',          cor: '#1abc9c' },
    { min: 40.01,   max: 80.00,    classe: 'F',          cor: '#3498db' },
    { min: 80.01,   max: 160.00,   classe: 'G',          cor: '#9b59b6' },
    { min: 160.01,  max: 320.00,   classe: 'H',          cor: '#e74c3c' },
    { min: 320.01,  max: 640.00,   classe: 'I',          cor: '#e67e22' },
    { min: 640.01,  max: 1280.00,  classe: 'J',          cor: '#f39c12' },
    { min: 1280.01, max: 2560.00,  classe: 'K',          cor: '#2ecc71' },
    { min: 2560.01, max: 5120.00,  classe: 'L',          cor: '#3498db' },
    { min: 5120.01, max: 10240.00, classe: 'M',          cor: '#9b59b6' },
    { min: 10240.01,max: 20480.00, classe: 'N',          cor: '#e74c3c' },
    { min: 20480.01,max: 40960.00, classe: 'O',          cor: '#c0392b' },
  ];

  // Gerar séries segmentadas: cada classe mostra apenas sua porção do intervalo de queima
  const segmentSeries = classificacoes.map(c => {
    // Primeiro calcula máscara de pertencimento à classe em cada amostra
    const inside = dados.tempos.map((t, i) => {
      const impulsoAqui = cumulativeImpulse[i];
      // Inclui um pequeno OVERLAP para evitar fendas entre faixas vizinhas
      return impulsoAqui >= (c.min - OVERLAP) && impulsoAqui <= (c.max + OVERLAP);
    });

    // Expande a máscara em +/-2 amostras para evitar gaps entre faixas
    const EXPAND_SAMPLES = 2;
    const expanded = inside.map((v, i) => {
      if (v) return true;
      for (let k = 1; k <= EXPAND_SAMPLES; k++) {
        if (inside[i - k] || inside[i + k]) return true;
      }
      return false;
    });

    const segData = dados.tempos.map((t, i) => {
      const dentroQueima = t >= burnStartTime && t <= burnEndTime;
      return {
        x: t,
        y: (dentroQueima && expanded[i]) ? dados.newtons[i] : null
      };
    });
    return {
      name: c.classe,
      type: 'area',
      data: segData
    };
  });

  // Primeira série (linha completa) + séries de área segmentadas
  const allSeries = [
    { name: 'Força (N)', type: 'line', data: chartData },
    ...segmentSeries
  ];

  const options = {
    series: allSeries,
    chart: {
      type: 'line',
      height: 400,
      animations: {
        enabled: false
      },
      stacked: false, // mantemos false para não somar áreas; sobreposição controlada por opacidade
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: false,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true
        },
        autoSelected: 'pan'
      },
      events: {
        click: function(event, chartContext, config) {
          // Permite clicar no gráfico para ajustar pontos
          if (config.dataPointIndex !== undefined && config.dataPointIndex >= 0) {
            const clickedTime = chartData[config.dataPointIndex].x;

            // Determina se está mais próximo do início ou fim
            const distStart = Math.abs(clickedTime - burnStartTime);
            const distEnd = Math.abs(clickedTime - burnEndTime);

            if (distStart < distEnd) {
              burnStartTime = clickedTime;
            } else {
              burnEndTime = clickedTime;
            }

            updateBurnChart();
            updateBurnMetrics(dados);
          }
        }
      }
    },
    stroke: {
      // Linha principal suave; áreas com 'straight' para alinhar limites e minimizar gaps
      curve: 'smooth',
      width: [2, ...segmentSeries.map(() => 0)]
    },
    fill: {
      type: ['solid', ...segmentSeries.map(() => 'solid')],
      opacity: [1, ...segmentSeries.map(() => 0.50)]
    },
    colors: ['#008FFB', ...classificacoes.map(c => c.cor)],
    xaxis: {
      type: 'numeric',
      title: {
        text: 'Tempo (s)'
      },
      decimalsInFloat: 3
    },
    yaxis: {
      title: {
        text: 'Força (N)'
      },
      decimalsInFloat: 2
    },
    tooltip: {
      x: {
        format: 'dd/MM HH:mm:ss'
      }
    },
    annotations: {
      xaxis: [
        {
          x: burnStartTime,
          borderColor: '#00E396',
          label: {
            borderColor: '#00E396',
            style: { color: '#fff', background: '#00E396' },
            text: '🔥 Início'
          }
        },
        {
          x: burnEndTime,
          borderColor: '#FEB019',
          label: {
            borderColor: '#FEB019',
            style: { color: '#fff', background: '#FEB019' },
            text: '🏁 Fim'
          }
        }
      ]
    },
    grid: {
      borderColor: '#e7e7e7',
      row: {
        colors: ['#f3f3f3', 'transparent'],
        opacity: 0.5
      }
    }
  };

  burnAnalysisChart = new ApexCharts(chartContainer, options);
  burnAnalysisChart.render();
}

function updateBurnChart() {
  if (!currentBurnSession) {
    console.log('[updateBurnChart] Sessão não disponível');
    return;
  }

  console.log('[updateBurnChart] Recriando gráfico com burnStart:', burnStartTime, 'burnEnd:', burnEndTime);

  // Processar dados da sessão e recriar o gráfico (necessário para recalcular segmentos de impulso)
  const dados = processarDadosSimples(currentBurnSession.dadosTabela);
  renderBurnAnalysisChart(dados);

  console.log('[updateBurnChart] Gráfico recriado com sucesso');
}

function updateBurnMetrics(dados) {
  // Filtrar dados dentro do intervalo de queima
  const burnData = {
    tempos: [],
    newtons: []
  };

  for (let i = 0; i < dados.tempos.length; i++) {
    if (dados.tempos[i] >= burnStartTime && dados.tempos[i] <= burnEndTime) {
      burnData.tempos.push(dados.tempos[i]);
      burnData.newtons.push(dados.newtons[i]);
    }
  }

  if (burnData.tempos.length === 0) {
    document.getElementById('burn-duration-display').textContent = 'N/A';
    document.getElementById('burn-impulse-display').textContent = 'N/A';
    document.getElementById('burn-class-display').textContent = 'N/A';
    document.getElementById('burn-avg-force-display').textContent = 'N/A';
    document.getElementById('burn-max-force-display').textContent = 'N/A';
    return;
  }

  // Calcular métricas
  const duration = burnEndTime - burnStartTime;
  const impulsoData = calcularAreaSobCurva(burnData.tempos, burnData.newtons, false);
  const metricasPropulsao = calcularMetricasPropulsao(impulsoData);
  const avgForce = impulsoData.impulsoTotal / duration;
  const maxForce = Math.max(...burnData.newtons);

  // Atualizar displays
  document.getElementById('burn-duration-display').textContent = `${duration.toFixed(3)} s`;
  document.getElementById('burn-impulse-display').textContent = `${impulsoData.impulsoTotal.toFixed(2)} N⋅s`;
  document.getElementById('burn-class-display').innerHTML = `
    <span style="background: ${metricasPropulsao.classificacaoMotor.cor}; color: white; padding: 4px 8px; border-radius: 4px;">
      ${metricasPropulsao.classificacaoMotor.classe}
    </span>
  `;
  document.getElementById('burn-avg-force-display').textContent = `${avgForce.toFixed(2)} N`;
  document.getElementById('burn-max-force-display').textContent = `${maxForce.toFixed(2)} N`;

  // Atualizar informações de tempo da queima detectada
  if (currentBurnSession) {
    updateTestTimeInfo(currentBurnSession, dados, burnStartTime, burnEndTime);
  }
}

// Listener para inputs de tempo (removido - inputs não existem mais)

function resetBurnPoints() {
  if (!currentBurnSession) return;

  const dados = processarDadosSimples(currentBurnSession.dadosTabela);
  burnStartTime = detectBurnStart(dados);
  burnEndTime = detectBurnEnd(dados);

  updateBurnChart();
  updateBurnMetrics(dados);

  showNotification('success', 'Pontos resetados para detecção automática.');
}

async function salvarPontosQueima() {
  if (!currentBurnSession) {
    showNotification('error', 'Nenhuma sessão carregada.');
    return;
  }

  try {
    // Atualizar metadados da sessão
    currentBurnSession.burnMetadata = {
      burnStartTime: burnStartTime,
      burnEndTime: burnEndTime,
      lastModified: new Date().toISOString()
    };

    // Salvar localmente se existir
    const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    const localIndex = localSessions.findIndex(s => s.id === currentBurnSession.id);

    if (localIndex !== -1) {
      localSessions[localIndex].burnMetadata = currentBurnSession.burnMetadata;
      localStorage.setItem('balancaGravacoes', JSON.stringify(localSessions));
    }

    // Salvar no DB se conectado
    if (isMysqlConnected && currentBurnSession.savedToMysql) {
      const resp = await apiFetch(`/api/sessoes/${currentBurnSession.id}/burn-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          burn_start_time: burnStartTime,
          burn_end_time: burnEndTime
        })
      });

      if (!resp.ok) {
        throw new Error('Falha ao salvar no banco de dados');
      }
    }

    showNotification('success', 'Pontos de queima salvos com sucesso!');
    fecharModalBurnAnalysis();
    loadAndDisplayAllSessions(); // Recarrega a lista

  } catch (error) {
    console.error('Erro ao salvar pontos de queima:', error);
    showNotification('error', 'Erro ao salvar pontos de queima.');
  }
}
