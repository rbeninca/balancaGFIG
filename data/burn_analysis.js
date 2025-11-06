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

    // Atualizar inputs
    document.getElementById('burn-start-input').value = burnStartTime.toFixed(3);
    document.getElementById('burn-end-input').value = burnEndTime.toFixed(3);

    // Renderizar gráfico
    renderBurnAnalysisChart(dadosProcessados);

    // Atualizar métricas
    updateBurnMetrics(dadosProcessados);

  } catch (error) {
    console.error('Erro ao abrir modal de análise:', error);
    showNotification('error', 'Erro ao carregar análise de queima.');
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

  const options = {
    series: [{
      name: 'Força (N)',
      data: chartData
    }],
    chart: {
      type: 'line',
      height: 400,
      animations: {
        enabled: false
      },
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
        }
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
              document.getElementById('burn-start-input').value = burnStartTime.toFixed(3);
            } else {
              burnEndTime = clickedTime;
              document.getElementById('burn-end-input').value = burnEndTime.toFixed(3);
            }

            updateBurnChart();
            updateBurnMetrics(dados);
          }
        }
      }
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
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
            style: {
              color: '#fff',
              background: '#00E396'
            },
            text: '🔥 Início'
          }
        },
        {
          x: burnEndTime,
          borderColor: '#FEB019',
          label: {
            borderColor: '#FEB019',
            style: {
              color: '#fff',
              background: '#FEB019'
            },
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
  if (!burnAnalysisChart) return;

  burnAnalysisChart.updateOptions({
    annotations: {
      xaxis: [
        {
          x: burnStartTime,
          borderColor: '#00E396',
          label: {
            borderColor: '#00E396',
            style: {
              color: '#fff',
              background: '#00E396'
            },
            text: '🔥 Início'
          }
        },
        {
          x: burnEndTime,
          borderColor: '#FEB019',
          label: {
            borderColor: '#FEB019',
            style: {
              color: '#fff',
              background: '#FEB019'
            },
            text: '🏁 Fim'
          }
        }
      ]
    }
  });
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
}

// Listener para inputs de tempo
document.addEventListener('DOMContentLoaded', () => {
  const burnStartInput = document.getElementById('burn-start-input');
  const burnEndInput = document.getElementById('burn-end-input');

  if (burnStartInput) {
    burnStartInput.addEventListener('change', function() {
      const newValue = parseFloat(this.value);
      if (!isNaN(newValue) && currentBurnSession) {
        burnStartTime = newValue;
        updateBurnChart();
        const dados = processarDadosSimples(currentBurnSession.dadosTabela);
        updateBurnMetrics(dados);
      }
    });
  }

  if (burnEndInput) {
    burnEndInput.addEventListener('change', function() {
      const newValue = parseFloat(this.value);
      if (!isNaN(newValue) && currentBurnSession) {
        burnEndTime = newValue;
        updateBurnChart();
        const dados = processarDadosSimples(currentBurnSession.dadosTabela);
        updateBurnMetrics(dados);
      }
    });
  }
});

function resetBurnPoints() {
  if (!currentBurnSession) return;

  const dados = processarDadosSimples(currentBurnSession.dadosTabela);
  burnStartTime = detectBurnStart(dados);
  burnEndTime = detectBurnEnd(dados);

  document.getElementById('burn-start-input').value = burnStartTime.toFixed(3);
  document.getElementById('burn-end-input').value = burnEndTime.toFixed(3);

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
