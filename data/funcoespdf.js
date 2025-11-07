// ============================================
// balançaGFIG - GERAÇÃO DE RELATÓRIOS EM PDF
// Grupo de Foguetes do Campus Gaspar (GFIG)
// CompSteam • Projeto BoxSteam
// Controle e Automação de Eletrodomésticos do Cotidiano
// Instituto Federal de Santa Catarina (IFSC) - Campus Gaspar
// ============================================

/**
 * Exporta PDF com gráfico real e todos os dados via impressão do navegador
 * @param {number} sessionId - ID da sessão a ser exportada
 */
function exportarPDFViaPrint(sessionId) {
  try {
    const gravacoes = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
    const sessao = gravacoes.find(g => g.id === sessionId);
    
    if (!sessao || !sessao.dadosTabela || sessao.dadosTabela.length === 0) {
      showNotification('error', 'Sessão não encontrada ou sem dados');
      return;
    }
    
    showNotification('info', 'Gerando relatório PDF com gráfico...', 2000);
    
    // Processa dados
    const dados = processarDadosSimples(sessao.dadosTabela);
    // Assumimos que calcularAreaSobCurva retorna o Impulso Total (área sob a curva)
    const impulsoData = calcularAreaSobCurva(dados.tempos, dados.newtons, false);
    // Assumimos que calcularMetricasPropulsao lida com a classificação NAR/TRA
    const metricasPropulsao = calcularMetricasPropulsao(impulsoData);
    
    // Gera o gráfico em canvas e converte para imagem
    gerarGraficoParaPDF(sessao, dados, impulsoData, metricasPropulsao, (imagemBase64) => {
      // Cria janela de impressão com o gráfico
      const printWindow = window.open('', '_blank');
      
      // Gera HTML do relatório COM a imagem do gráfico
      const html = gerarHTMLRelatorioCompleto(sessao, dados, impulsoData, metricasPropulsao, imagemBase64);
      
      printWindow.document.write(html);
      printWindow.document.close();
      
      // Aguarda carregamento e abre diálogo de impressão
      printWindow.onload = function() {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
      
      showNotification('success', 'Relatório pronto! Use "Salvar como PDF" no diálogo', 5000);
    });
    
  } catch (e) {
    console.error('Erro ao gerar PDF:', e);
    showNotification('error', 'Erro ao gerar relatório: ' + e.message);
  }
}

/**
 * Gera o gráfico em canvas e retorna como base64
 */
function gerarGraficoParaPDF(sessao, dados, impulsoData, metricasPropulsao, callback) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Dimensões do gráfico
  const w = 1400;
  const h = 800;
  canvas.width = w;
  canvas.height = h;
  
  // Cores
  const cor = {
    fundo: '#ffffff',
    titulo: '#2c3e50',
    subtitulo: '#7f8c8d',
    azul: '#3498db',
    verde: '#27ae60',
    vermelho: '#e74c3c',
    cinza: '#95a5a6',
    fundo2: '#f8f9fa',
    roxo: '#9b59b6',
    laranja: '#e67e22'
  };
  
  // Fundo branco
  ctx.fillStyle = cor.fundo;
  ctx.fillRect(0, 0, w, h);
  
  // Cabeçalho do gráfico
  ctx.fillStyle = cor.titulo;
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`Curva de Propulsão - ${sessao.nome}`, w/2, 40);
  
  ctx.fillStyle = cor.roxo;
  ctx.font = 'bold 20px Arial';
  const classificacao = metricasPropulsao.classificacaoMotor;
  ctx.fillText(`💥 Impulso: ${impulsoData.impulsoTotal.toFixed(2)} N⋅s | Classe ${classificacao.classe}`, w/2, 70);
  
  // Desenha o gráfico
  const gx = 120;  // X inicial do gráfico
  const gy = 100;  // Y inicial do gráfico
  const gw = w - 200;  // Largura do gráfico
  const gh = h - 200;  // Altura do gráfico
  
  // Caixa do gráfico
  ctx.fillStyle = cor.fundo2;
  ctx.fillRect(gx, gy, gw, gh);
  
  ctx.strokeStyle = cor.cinza;
  ctx.lineWidth = 2;
  ctx.strokeRect(gx, gy, gw, gh);
  
  // Valores e escalas
  const valores = dados.newtons;
  const tempos = dados.tempos;
  
  if (valores.length < 2) {
    ctx.fillStyle = cor.vermelho;
    ctx.font = '20px Arial';
    ctx.fillText('Dados insuficientes para gráfico', w/2, h/2);
    callback(canvas.toDataURL('image/png'));
    return;
  }
  
  const maxVal = Math.max(...valores);
  const minVal = Math.min(...valores, 0);
  const range = maxVal - minVal || 0.001;
  const padding = range * 0.1;
  
  const yMin = minVal - padding;
  const yMax = maxVal + padding;
  const yRange = yMax - yMin;
  
  // Grid horizontal
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  
  for (let i = 0; i <= 6; i++) {
    const y = gy + (gh/6) * i;
    const valor = yMax - (yRange/6) * i;
    
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
    
    // Label Y
    ctx.fillStyle = cor.titulo;
    ctx.font = '14px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(valor.toFixed(1) + ' N', gx - 10, y + 5);
  }
  
  // Grid vertical (tempo)
  const numVerticalLines = 10;
  const maxTempo = Math.max(...tempos);
  for (let i = 0; i <= numVerticalLines; i++) {
    const x = gx + (gw / numVerticalLines) * i;
    const tempo = (maxTempo / numVerticalLines) * i;
    
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy + gh);
    ctx.stroke();
    
    // Label X
    ctx.fillStyle = cor.titulo;
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tempo.toFixed(2) + 's', x, gy + gh + 20);
  }
  
  ctx.setLineDash([]);
  
  // ÁREA SOB A CURVA (representa o impulso)
  if (valores.length > 1) {
    ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
    ctx.beginPath();
    
    const zeroY = gy + gh - ((0 - yMin) / yRange) * gh;
    ctx.moveTo(gx, zeroY);
    
    for (let i = 0; i < valores.length; i++) {
      const x = gx + (gw / (valores.length - 1)) * i;
      const valorPositivo = Math.max(0, valores[i]);
      const y = gy + gh - ((valorPositivo - yMin) / yRange) * gh;
      ctx.lineTo(x, y);
    }
    
    ctx.lineTo(gx + gw, zeroY);
    ctx.closePath();
    ctx.fill();
  }
  
  // LINHA DE FORÇA
  if (valores.length > 1) {
    ctx.strokeStyle = cor.azul;
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    for (let i = 0; i < valores.length; i++) {
      const x = gx + (gw / (valores.length - 1)) * i;
      const y = gy + gh - ((valores[i] - yMin) / yRange) * gh;
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  
  // LINHA DO ZERO
  if (yMin < 0 && yMax > 0) {
    const zeroY = gy + gh - ((0 - yMin) / yRange) * gh;
    ctx.strokeStyle = cor.cinza;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(gx, zeroY);
    ctx.lineTo(gx + gw, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  
  // PONTO DE FORÇA MÁXIMA
  const maxIndex = valores.indexOf(Math.max(...valores));
  if (maxIndex >= 0) {
    const x = gx + (gw / (valores.length - 1)) * maxIndex;
    const y = gy + gh - ((valores[maxIndex] - yMin) / yRange) * gh;
    
    ctx.fillStyle = cor.vermelho;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, 2 * Math.PI);
    ctx.fill();
    
    // Label do pico
    ctx.fillStyle = cor.vermelho;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Fmax: ${valores[maxIndex].toFixed(2)}N`, x, y - 15);
  }
  
  // MARCADORES DE IGNIÇÃO E BURNOUT
  // Ignição
  if (impulsoData.tempoIgnicao > 0) {
    const ignicaoIndex = tempos.findIndex(t => t >= impulsoData.tempoIgnicao);
    if (ignicaoIndex >= 0) {
      const x = gx + (gw / (valores.length - 1)) * ignicaoIndex;
      ctx.strokeStyle = cor.verde;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = cor.verde;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Ignição', x, gy - 5);
    }
  }
  
  // Burnout
  if (impulsoData.tempoBurnout > 0) {
    const burnoutIndex = tempos.findIndex(t => t >= impulsoData.tempoBurnout);
    if (burnoutIndex >= 0) {
      const x = gx + (gw / (valores.length - 1)) * burnoutIndex;
      ctx.strokeStyle = cor.laranja;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = cor.laranja;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Burnout', x, gy - 5);
    }
  }
  
  // LABELS DOS EIXOS
  ctx.fillStyle = cor.titulo;
  ctx.font = 'bold 18px Arial';
  ctx.textAlign = 'center';
  
  // Eixo Y
  ctx.save();
  ctx.translate(30, gy + gh/2);
  ctx.rotate(-Math.PI/2);
  ctx.fillText('Força (N)', 0, 0);
  ctx.restore();
  
  // Eixo X
  ctx.fillText('Tempo (s)', gx + gw/2, gy + gh + 50);
  
  // LEGENDA
  const legX = gx + gw - 200;
  const legY = gy + 20;
  
  // Área = Impulso
  ctx.fillStyle = 'rgba(52, 152, 219, 0.3)';
  ctx.fillRect(legX, legY, 30, 20);
  ctx.strokeStyle = cor.azul;
  ctx.lineWidth = 2;
  ctx.strokeRect(legX, legY, 30, 20);
  
  ctx.fillStyle = cor.titulo;
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Área = Impulso', legX + 40, legY + 15);
  
  ctx.font = '12px Arial';
  ctx.fillStyle = cor.verde;
  ctx.fillText(`${impulsoData.impulsoTotal.toFixed(2)} N⋅s`, legX + 40, legY + 30);
  
  // Converte canvas para base64
  callback(canvas.toDataURL('image/png', 1.0));
}

/**
 * Gera as linhas da tabela completa de classificações com destaque no motor testado
 */
function gerarLinhasClassificacaoCompleta(impulsoTestado, classeTestada) {
  const classificacoes = [
    { min: 0.00,    max: 0.3125,   classe: 'Micro 1/8A', tipo: 'FM (foguetemodelo)', nivel: 'Micro',       cor: '#8e44ad' },
    { min: 0.3126,  max: 0.625,    classe: '¼A',         tipo: 'FM (foguetemodelo)', nivel: 'Baixa potência', cor: '#9b59b6' },
    { min: 0.626,   max: 1.25,     classe: '½A',         tipo: 'FM (foguetemodelo)', nivel: 'Baixa potência', cor: '#e74c3c' },
    { min: 1.26,    max: 2.50,     classe: 'A',          tipo: 'FM (foguetemodelo)', nivel: 'Baixa potência', cor: '#e67e22' },
    { min: 2.51,    max: 5.00,     classe: 'B',          tipo: 'FM (foguetemodelo)', nivel: 'Baixa potência', cor: '#f39c12' },
    { min: 5.01,    max: 10.00,    classe: 'C',          tipo: 'FM (foguetemodelo)', nivel: 'Baixa potência', cor: '#f1c40f' },
    { min: 10.01,   max: 20.00,    classe: 'D',          tipo: 'FM (foguetemodelo)', nivel: 'Baixa potência', cor: '#2ecc71' },
    { min: 20.01,   max: 40.00,    classe: 'E',          tipo: 'FM (foguetemodelo)', nivel: 'Média potência', cor: '#1abc9c' },
    { min: 40.01,   max: 80.00,    classe: 'F',          tipo: 'FM (foguetemodelo)', nivel: 'Média potência', cor: '#3498db' },
    { min: 80.01,   max: 160.00,   classe: 'G',          tipo: 'FM (foguetemodelo)', nivel: 'Média potência', cor: '#9b59b6' },
    { min: 160.01,  max: 320.00,   classe: 'H',          tipo: 'MFE (experimental)', nivel: 'Nível 1',        cor: '#e74c3c' },
    { min: 320.01,  max: 640.00,   classe: 'I',          tipo: 'MFE (experimental)', nivel: 'Nível 1',        cor: '#e67e22' },
    { min: 640.01,  max: 1280.00,  classe: 'J',          tipo: 'MFE (experimental)', nivel: 'Nível 2',        cor: '#f39c12' },
    { min: 1280.01, max: 2560.00,  classe: 'K',          tipo: 'MFE (experimental)', nivel: 'Nível 2',        cor: '#2ecc71' },
    { min: 2560.01, max: 5120.00,  classe: 'L',          tipo: 'MFE (experimental)', nivel: 'Nível 2',        cor: '#3498db' },
    { min: 5120.01, max: 10240.00, classe: 'M',          tipo: 'MFE (experimental)', nivel: 'Nível 3',        cor: '#9b59b6' },
    { min: 10240.01,max: 20480.00, classe: 'N',          tipo: 'MFE (experimental)', nivel: 'Nível 3',        cor: '#e74c3c' },
    { min: 20480.01,max: 40960.00, classe: 'O',          tipo: 'MFE (experimental)', nivel: 'Nível 3',        cor: '#c0392b' },
  ];

  let linhas = '';
  classificacoes.forEach((c) => {
    const isMotorTestado = c.classe === classeTestada;

    // Estilo da linha: destaque apenas para o motor testado
    let rowStyle = '';
    let markerHTML = '';

    if (isMotorTestado) {
      rowStyle = `background: ${c.cor}30; border-left: 4px solid ${c.cor}; font-weight: bold;`;
      markerHTML = '🎯 ';
    }

    linhas += `
      <tr style="${rowStyle}">
        <td style="text-align: center; padding: 4px;">${markerHTML}${c.classe}</td>
        <td style="text-align: center; padding: 4px;">${c.min.toFixed(2)} - ${c.max.toFixed(2)}</td>
        <td style="text-align: center; padding: 4px;">${c.tipo}</td>
        <td style="text-align: center; padding: 4px;">${c.nivel}</td>
      </tr>
    `;
  });

  return linhas;
}

/**
 * Gera uma barra visual mostrando graficamente onde o motor se enquadra
 */
function gerarBarraVisualClassificacao(impulsoTestado, classificacao) {
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

  // Encontra o índice da classe testada
  const indiceTestado = classificacoes.findIndex(c => c.classe === classificacao.classe);

  // Gera as barras
  let barrasHTML = '<div style="display: flex; gap: 2px; align-items: flex-end; height: 120px;">';

  classificacoes.forEach((c, index) => {
    const isMotorTestado = index === indiceTestado;
    const altura = isMotorTestado ? '100%' : '60%';
    const largura = `${100 / classificacoes.length}%`;

    barrasHTML += `
      <div style="
        width: ${largura};
        height: ${altura};
        background: ${c.cor};
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        border-radius: 4px 4px 0 0;
        position: relative;
        transition: all 0.3s ease;
        ${isMotorTestado ? 'box-shadow: 0 -4px 12px rgba(0,0,0,0.3); border: 3px solid #2c3e50;' : 'opacity: 0.6;'}
      ">
        ${isMotorTestado ? `
          <div style="
            position: absolute;
            top: -35px;
            font-size: 24px;
            animation: bounce 1s infinite;
          ">🎯</div>
        ` : ''}
        <div style="
          writing-mode: vertical-rl;
          text-orientation: mixed;
          padding: 5px;
          font-size: ${isMotorTestado ? '11px' : '8px'};
          font-weight: ${isMotorTestado ? 'bold' : 'normal'};
          color: white;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        ">${c.classe}</div>
      </div>
    `;
  });

  barrasHTML += '</div>';

  // Adiciona legenda
  barrasHTML += `
    <div style="margin-top: 15px; text-align: center; font-size: 12px; color: #2c3e50;">
      <strong>Impulso medido:</strong> ${impulsoTestado.toFixed(2)} N⋅s &nbsp;|&nbsp;
      <strong>Classe:</strong> ${classificacao.classe} &nbsp;|&nbsp;
      <strong>Faixa:</strong> ${classificacao.faixa}
    </div>
    <div style="margin-top: 8px; text-align: center; font-size: 11px; color: #7f8c8d;">
      Cada barra representa uma classe de motor. A barra destacada indica a classe do seu motor testado.
    </div>
  `;

  return barrasHTML;
}

/**
 * Gera HTML completo do relatório com gráfico embutido e todos os dados
 */
function gerarHTMLRelatorioCompleto(sessao, dados, impulsoData, metricasPropulsao, imagemGrafico, burnInfo = null, dadosTotais = null) {
  const dataSessao = new Date(sessao.timestamp).toLocaleString('pt-BR');
  const classificacao = metricasPropulsao.classificacaoMotor;
  
  // Tenta obter massa do propelente dos metadados do motor ou campo customizado
  let massaPropelente = null;
  let impulsoEspecifico = null;
  
  // Procura por massa em diferentes lugares nos metadados
  if (sessao.metadadosMotor) {
    if (sessao.metadadosMotor.massaPropelente) {
      massaPropelente = parseFloat(sessao.metadadosMotor.massaPropelente);
    } else if (sessao.metadadosMotor.propweight) {
      massaPropelente = parseFloat(sessao.metadadosMotor.propweight) / 1000; // Converte de gramas para kg
    }
  }
  
  // Se encontrou massa, calcula impulso específico
  if (massaPropelente && massaPropelente > 0) {
    impulsoEspecifico = impulsoData.impulsoTotal / (massaPropelente * 9.81);
  }
  
  // 1. Encontra a força máxima para normalização (usada no gradiente da tabela)
  const newtonsValues = sessao.dadosTabela.map(dado => parseFloat(dado.newtons) || 0);
  const maxNewtons = Math.max(...newtonsValues) || 1;
  
  // Gera linhas da tabela com TODOS os dados
  let linhasTabela = '';
  sessao.dadosTabela.forEach((dado, index) => {
    const tempo = parseFloat(dado.tempo_esp) || 0;
    const newtons = parseFloat(dado.newtons) || 0;
    const gramaForca = parseFloat(dado.grama_forca) || 0;
    const quiloForca = parseFloat(dado.quilo_forca) || 0;
    
    // 2. Normaliza o valor de Força N em relação ao máximo
    const normalizedForce = Math.max(0, newtons) / maxNewtons; 
    
    // 3. Cria o estilo de fundo com opacidade crescente (laranja suave)
    let rowStyle = '';
    if (newtons > 0.05) { // Aplica destaque apenas para empuxo significativo
        const maxOpacity = 0.5; 
        // Opacidade mínima 0.1 para forçar o gradiente a ser visível, máxima 0.5 para não ofuscar o texto
        const opacity = Math.min(maxOpacity, Math.max(0.1, normalizedForce * 0.5)); 
        
        // Cor de destaque (laranja muito suave - 255, 165, 0)
        rowStyle = `background: rgba(255, 165, 0, ${opacity.toFixed(2)}) !important;`; 
    }

    linhasTabela += `
      <tr style="${rowStyle}">
        <td>${index + 1}</td>
        <td>${tempo.toFixed(6)}</td>
        <td>${newtons.toFixed(6)}</td>
        <td>${gramaForca.toFixed(6)}</td>
        <td>${quiloForca.toFixed(6)}</td>
      </tr>
    `;
  });
  
  // Cria string de informação sobre Impulso Específico
  let infoIsp = '<strong>* Impulso Específico (Isp):</strong> Requer a massa do propelente queimado. ';
  let cardIsp = `<div class="metrica-card">
        <h3>Impulso Específico (Isp)</h3>
        <div class="valor">N/A</div>
        <div class="unidade">s</div>
      </div>`;
  
  if (impulsoEspecifico !== null) {
    cardIsp = `<div class="metrica-card">
        <h3>Impulso Específico (Isp)</h3>
        <div class="valor">${impulsoEspecifico.toFixed(2)}</div>
        <div class="unidade">segundos</div>
      </div>`;
    infoIsp = `<strong>✓ Impulso Específico (Isp):</strong> Calculado usando massa de propelente = ${massaPropelente.toFixed(3)} kg. `;
  }
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório - ${sessao.nome}</title>
  <style>
    @media print {
      @page {
        size: A4;
        margin: 12mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
      .avoid-break {
        page-break-inside: avoid;
      }
    }
    
    body {
      font-family: Arial, sans-serif;
      line-height: 1.3;
      color: #2c3e50;
      max-width: 210mm;
      margin: 0 auto;
      padding: 6px;
      background: white;
      font-size: 10px;
    }

    .header {
      text-align: center;
      border-bottom: 2px solid #3498db;
      padding-bottom: 5px;
      margin-bottom: 5px;
    }

    .header h1 {
      color: #2c3e50;
      margin: 3px 0;
      font-size: 18px;
    }

    .header .subtitle {
      color: #7f8c8d;
      font-size: 9px;
      margin: 2px 0;
    }

    .impulso-destaque {
      background: linear-gradient(135deg, ${classificacao.cor || '#667eea'} 0%, #764ba2 100%);
      color: white;
      padding: 10px;
      border-radius: 6px;
      text-align: center;
      margin: 8px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .impulso-destaque h2 {
      margin: 0 0 5px 0;
      font-size: 22px;
    }

    .impulso-destaque .classe {
      font-size: 16px;
      font-weight: bold;
      background: rgba(255,255,255,0.2);
      padding: 5px 10px;
      border-radius: 4px;
      display: inline-block;
      margin-top: 5px;
    }

    .metricas-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin: 10px 0;
    }

    .metrica-card {
      background: #f8f9fa;
      padding: 8px;
      border-radius: 4px;
      border-left: 3px solid #3498db;
    }

    .metrica-card h3 {
      margin: 0 0 3px 0;
      font-size: 10px;
      color: #7f8c8d;
      text-transform: uppercase;
    }
    
    .metrica-card .valor {
      font-size: 16px;
      font-weight: bold;
      color: #2c3e50;
    }

    .metrica-card .unidade {
      font-size: 10px;
      color: #7f8c8d;
    }

    .secao {
      margin: 5px 0;
    }

    .secao h2 {
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 3px;
      margin-bottom: 5px;
      font-size: 12px;
    }

    .grafico-container {
      text-align: center;
      margin: 5px 0;
      background: #f8f9fa;
      padding: 5px;
      border-radius: 4px;
    }

    .grafico-container img {
      max-width: 100%;
      height: auto;
      border: 1px solid #dee2e6;
      border-radius: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 8px;
    }

    th, td {
      padding: 3px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    
    th {
      background: #3498db;
      color: white;
      font-weight: bold;
      font-size: 9px;
    }
    
    /* Regras de cor de fundo alternadas */
    tr:nth-child(even) {
      background: #f8f9fa;
    }
    
    /* A cor inline do gradiente vai sobrescrever estas regras */
    tr:hover {
      background: #e9ecef !important; /* Mantém o hover */
    }
    
    .footer {
      margin-top: 10px;
      padding-top: 5px;
      border-top: 1px solid #dee2e6;
      text-align: center;
      color: #7f8c8d;
      font-size: 7px;
    }
    
    .classificacao-info {
      background: ${classificacao.cor}20;
      border: 2px solid ${classificacao.cor};
      padding: 12px;
      border-radius: 6px;
      margin: 12px 0;
    }
    
    .classificacao-info h3 {
      margin: 0 0 8px 0;
      color: ${classificacao.cor};
      font-size: 16px;
    }
    
    .btn-print {
      background: #3498db;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      font-size: 14px;
      cursor: pointer;
      margin: 15px 5px;
    }
    
    .btn-print:hover {
      background: #2980b9;
    }
    
    .btn-close {
      background: #95a5a6;
    }
    
    .btn-close:hover {
      background: #7f8c8d;
    }
    
    .info-box {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
      padding: 10px;
      margin: 10px 0;
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <!-- Botões de controle (ocultos na impressão) -->
  <div class="no-print" style="text-align: center; margin-bottom: 15px;">
    <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar como PDF</button>
    <button class="btn-print btn-close" onclick="window.close()">❌ Fechar</button>
  </div>

  <!-- CABEÇALHO SIMPLIFICADO -->
  <div class="header avoid-break">
    <h1 style="font-size: 16px; margin: 3px 0;">🚀 balançaGFIG - RELATÓRIO DE TESTE ESTÁTICO</h1>
    <div class="subtitle" style="font-size: 9px;">${sessao.nome} • ${dataSessao}</div>
    <div class="subtitle" style="font-size: 8px;">IFSC Campus Gaspar • GFIG • CompSteam • BoxSteam</div>
  </div>

  <!-- CLASSIFICAÇÃO E IMPULSO - Seção Sintética -->
  <div class="secao avoid-break" style="background: ${classificacao.cor}20; border-left: 4px solid ${classificacao.cor}; padding: 5px; border-radius: 3px; margin: 4px 0;">
    <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px; align-items: center;">
      <div style="text-align: center; padding: 6px; background: ${classificacao.cor}; color: white; border-radius: 3px; min-width: 70px;">
        <div style="font-size: 16px; font-weight: bold;">${impulsoData.impulsoTotal.toFixed(2)}</div>
        <div style="font-size: 8px;">N⋅s</div>
      </div>
      <div style="font-size: 9px; line-height: 1.4;">
        <strong>Classe:</strong> ${classificacao.classe} • <strong>Tipo:</strong> ${classificacao.tipo} • <strong>Nível:</strong> ${classificacao.nivel}<br>
        <strong>Faixa:</strong> ${classificacao.faixa} • <strong>Impulso Total:</strong> ${impulsoData.impulsoTotal.toFixed(2)} N⋅s
      </div>
    </div>
  </div>

  <!-- METADADOS DO MOTOR - Versão Compacta -->
  ${sessao.metadadosMotor ? `
  <div class="secao avoid-break" style="background: #fff9e6; padding: 5px; border-radius: 3px; margin: 4px 0; border-left: 3px solid #ffc107;">
    <h2 style="margin-bottom: 4px; color: #f39c12; font-size: 11px;">⚙️ Metadados do Motor</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 8px;">
      ${sessao.metadadosMotor.manufacturer ? `<div><strong>Fabricante:</strong> ${sessao.metadadosMotor.manufacturer}</div>` : '<div><strong>Fabricante:</strong> ---</div>'}
      ${sessao.metadadosMotor.diameter ? `<div><strong>Diâmetro:</strong> ${sessao.metadadosMotor.diameter} mm</div>` : '<div><strong>Diâmetro:</strong> ---</div>'}
      ${sessao.metadadosMotor.length ? `<div><strong>Comprimento:</strong> ${sessao.metadadosMotor.length} mm</div>` : '<div><strong>Comprimento:</strong> ---</div>'}
      ${sessao.metadadosMotor.propweight ? `<div><strong>Massa Propelente:</strong> ${sessao.metadadosMotor.propweight} g</div>` : '<div><strong>Massa Propelente:</strong> ---</div>'}
      ${sessao.metadadosMotor.totalweight ? `<div><strong>Massa Total:</strong> ${sessao.metadadosMotor.totalweight} g</div>` : '<div><strong>Massa Total:</strong> ---</div>'}
      ${sessao.metadadosMotor.propweight && sessao.metadadosMotor.totalweight ? `<div><strong>Fração Propelente:</strong> ${((sessao.metadadosMotor.propweight / sessao.metadadosMotor.totalweight) * 100).toFixed(1)}%</div>` : '<div><strong>Fração Propelente:</strong> ---</div>'}
    </div>
    ${sessao.metadadosMotor.description ? `<div style="margin-top: 4px; font-size: 8px;"><strong>Descrição:</strong> ${sessao.metadadosMotor.description}</div>` : ''}
    ${sessao.metadadosMotor.observations ? `<div style="margin-top: 3px; font-size: 8px;"><strong>Observações:</strong> ${sessao.metadadosMotor.observations}</div>` : ''}
  </div>
  ` : ''}

  <!-- MÉTRICAS DE DESEMPENHO - Formato Tabela Compacta -->
  <div class="secao avoid-break">
    <h2 style="font-size: 11px; margin-bottom: 4px;">📈 Métricas de Desempenho</h2>
    <table style="font-size: 8px; width: 100%;">
      <tr style="background: #f8f9fa;">
        <td style="padding: 2px; font-weight: bold;">Impulso Total</td>
        <td style="padding: 2px;">${impulsoData.impulsoTotal.toFixed(2)} N⋅s</td>
        <td style="padding: 2px; font-weight: bold;">Força Máxima</td>
        <td style="padding: 2px;">${impulsoData.forcaMaxima.toFixed(2)} N</td>
      </tr>
      <tr>
        <td style="padding: 2px; font-weight: bold;">Duração Queima</td>
        <td style="padding: 2px;">${impulsoData.duracaoQueima.toFixed(3)} s</td>
        <td style="padding: 2px; font-weight: bold;">Força Média (Queima)</td>
        <td style="padding: 2px;">${(impulsoData.duracaoQueima > 0 ? impulsoData.impulsoTotal / impulsoData.duracaoQueima : 0).toFixed(2)} N</td>
      </tr>
      <tr style="background: #f8f9fa;">
        <td style="padding: 2px; font-weight: bold;">Tempo Ignição</td>
        <td style="padding: 2px;">${impulsoData.tempoIgnicao.toFixed(3)} s</td>
        <td style="padding: 2px; font-weight: bold;">Tempo Burnout</td>
        <td style="padding: 2px;">${impulsoData.tempoBurnout.toFixed(3)} s</td>
      </tr>
      <tr>
        <td style="padding: 2px; font-weight: bold;">Impulso Líquido</td>
        <td style="padding: 2px;">${impulsoData.impulsoLiquido.toFixed(2)} N⋅s</td>
        <td style="padding: 2px; font-weight: bold;">Impulso Específico (Isp)</td>
        <td style="padding: 2px;">${impulsoEspecifico !== null ? impulsoEspecifico.toFixed(2) + ' s' : 'N/A'}</td>
      </tr>
    </table>
  </div>

  <!-- GRÁFICO -->
  <div class="secao">
    <h2 style="font-size: 11px; margin-bottom: 4px;">📉 Curva de Propulsão</h2>
    <div class="grafico-container">
      <img src="${imagemGrafico}" alt="Gráfico de Propulsão" />
    </div>
  </div>

  <!-- ANÁLISE DE TEMPO (Horários do Teste e Queima) -->
  <div class="secao avoid-break" style="background: #f8f9fa; padding: 4px; border-radius: 3px; margin: 4px 0;">
    <h2 style="margin-bottom: 3px; font-size: 10px;">⏱️ Análise de Tempo</h2>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
      <!-- Teste Completo -->
      <div>
        <div style="background: #3498db; color: white; padding: 3px 6px; border-radius: 2px 2px 0 0; font-weight: bold; font-size: 8px;">
          📅 TESTE ESTÁTICO (COMPLETO)
        </div>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #dee2e6; font-size: 8px;">
          <tr><td style="padding: 2px; font-weight: bold; width: 40%;">Horário Início:</td><td style="padding: 2px;">${sessao.data_inicio ? (() => {
            const d = new Date(sessao.data_inicio);
            return d.toLocaleTimeString('pt-BR') + '.' + String(d.getMilliseconds()).padStart(3, '0');
          })() : '---'}</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Horário Fim:</td><td style="padding: 2px;">${sessao.data_fim ? (() => {
            const d = new Date(sessao.data_fim);
            return d.toLocaleTimeString('pt-BR') + '.' + String(d.getMilliseconds()).padStart(3, '0');
          })() : '---'}</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Tempo Relativo:</td><td style="padding: 2px;">00:00.000s → ${dados.duracao.toFixed(3)}s</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Duração Total:</td><td style="padding: 2px; font-weight: bold;">${dados.duracao.toFixed(3)} s</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Leituras/Taxa:</td><td style="padding: 2px;">${dados.tempos ? dados.tempos.length : 0} leituras • ${dados.duracao > 0 ? (dados.tempos.length / dados.duracao).toFixed(1) : '0.0'} Hz</td></tr>
        </table>
      </div>
      <!-- Queima Detectada -->
      <div>
        <div style="background: #27ae60; color: white; padding: 3px 6px; border-radius: 2px 2px 0 0; font-weight: bold; font-size: 8px;">
          🔥 QUEIMA DETECTADA${burnInfo && burnInfo.usandoPontosPersonalizados ? ' (PERSONALIZADO)' : ' (AUTO)'}
        </div>
        <table style="width: 100%; border-collapse: collapse; background: white; border: 1px solid #dee2e6; font-size: 8px;">
          <tr><td style="padding: 2px; font-weight: bold; width: 40%;">Ignição (abs):</td><td style="padding: 2px;">${sessao.data_inicio && dados.tempos ? (() => {
            const testStart = new Date(sessao.data_inicio);
            const firstReading = Math.min(...dados.tempos);
            const burnStartRelative = impulsoData.tempoIgnicao - firstReading;
            const burnStart = new Date(testStart.getTime() + burnStartRelative * 1000);
            return burnStart.toLocaleTimeString('pt-BR') + '.' + String(burnStart.getMilliseconds()).padStart(3, '0');
          })() : '---'}</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Burnout (abs):</td><td style="padding: 2px;">${sessao.data_inicio && dados.tempos ? (() => {
            const testStart = new Date(sessao.data_inicio);
            const firstReading = Math.min(...dados.tempos);
            const burnEndRelative = impulsoData.tempoBurnout - firstReading;
            const burnEnd = new Date(testStart.getTime() + burnEndRelative * 1000);
            return burnEnd.toLocaleTimeString('pt-BR') + '.' + String(burnEnd.getMilliseconds()).padStart(3, '0');
          })() : '---'}</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Tempo Relativo:</td><td style="padding: 2px;">${impulsoData.tempoIgnicao.toFixed(3)}s → ${impulsoData.tempoBurnout.toFixed(3)}s</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Duração Queima:</td><td style="padding: 2px; font-weight: bold;">${impulsoData.duracaoQueima.toFixed(3)} s</td></tr>
          <tr><td style="padding: 2px; font-weight: bold;">Leituras/Taxa:</td><td style="padding: 2px;">${dados.tempos ? dados.tempos.length : '---'} leituras • ${impulsoData.duracaoQueima > 0 ? (dados.tempos.length / impulsoData.duracaoQueima).toFixed(1) : '0.0'} Hz</td></tr>
        </table>
      </div>
    </div>
  </div>

  <!-- ANÁLISE DETALHADA -->
  <div class="secao avoid-break">
    <h2 style="font-size: 10px; margin-bottom: 3px;">🔍 Análise Detalhada</h2>
    <table style="font-size: 8px;">
      <tr>
        <td style="padding: 2px;"><strong>Parâmetro</strong></td>
        <td style="padding: 2px;"><strong>Valor</strong></td>
        <td style="padding: 2px;"><strong>Parâmetro</strong></td>
        <td style="padding: 2px;"><strong>Valor</strong></td>
      </tr>
      <tr>
        <td style="padding: 2px;">Impulso Positivo</td>
        <td style="padding: 2px;">${impulsoData.impulsoPositivo.toFixed(3)} N⋅s</td>
        <td style="padding: 2px;">Área Negativa</td>
        <td style="padding: 2px;">${impulsoData.areaNegativa.toFixed(3)} N⋅s</td>
      </tr>
      <tr>
        <td style="padding: 2px;">Força Média (Amostral)</td>
        <td style="padding: 2px;">${impulsoData.forcaMedia.toFixed(2)} N</td>
        <td style="padding: 2px;">Força Média (Positiva)</td>
        <td style="padding: 2px;">${impulsoData.forcaMediaPositiva.toFixed(2)} N</td>
      </tr>
      <tr>
        <td style="padding: 2px;">Duração Total</td>
        <td style="padding: 2px;">${dados.duracao.toFixed(3)} s</td>
        <td style="padding: 2px;">Número de Leituras</td>
        <td style="padding: 2px;">${sessao.dadosTabela.length}</td>
      </tr>
      <tr>
        <td style="padding: 2px;">Classificação NAR/TRA</td>
        <td style="padding: 2px;">${classificacao.classe}</td>
        <td style="padding: 2px;">Cor de Identificação</td>
        <td style="padding: 2px;"><span style="background: ${classificacao.cor}; color: white; padding: 1px 5px; border-radius: 2px; font-size: 7px;">${classificacao.cor}</span></td>
      </tr>
    </table>
  </div>

  <!-- TABELA COMPLETA DE DADOS -->
  <div class="secao">
    <h2 style="font-size: 10px; margin-bottom: 3px;">📋 Tabela Completa de Dados (${sessao.dadosTabela.length} leituras)</h2>
    <table style="font-size: 7px;">
      <thead>
        <tr>
          <th style="padding: 2px;">#</th>
          <th style="padding: 2px;">Tempo (s)</th>
          <th style="padding: 2px;">Força (N)</th>
          <th style="padding: 2px;">Força (gf)</th>
          <th style="padding: 2px;">Força (kgf)</th>
        </tr>
      </thead>
      <tbody>
        ${linhasTabela}
      </tbody>
    </table>
  </div>
  
  <!-- EXPLICAÇÃO TÉCNICA (NOVA SEÇÃO) -->
  <div class="secao">
    <h2 style="font-size: 10px; margin-bottom: 3px;">📚 Fundamentação Teórica e Metodologia de Cálculo</h2>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">1. Integração Numérica - Método dos Trapézios</h3>
    <div class="info-box" style="background: #f8f9fa; border-left: 3px solid #3498db; padding: 5px; margin: 3px 0; font-size: 7px;">
      <p style="margin: 2px 0;"><strong>Referência:</strong> MARCHI, C. H. et al. "Verificação de Soluções Numéricas". UFPR, 2015.</p>
      <p style="margin: 2px 0;">O <strong>Impulso Total</strong> é calculado pela integração numérica da curva força-tempo usando o <strong>Método dos Trapézios Composto</strong>:</p>
      <p style="text-align: center; font-family: 'Courier New', monospace; background: white; padding: 3px; border-radius: 2px; margin: 3px 0; font-size: 7px;">
        I = ∫<sub>t₀</sub><sup>tₙ</sup> F(t) dt ≈ Σ<sub>i=1</sub><sup>n-1</sup> [(F<sub>i</sub> + F<sub>i+1</sub>)/2] × Δt<sub>i</sub>
      </p>
      <p style="margin: 2px 0;"><strong>Erro de Truncamento:</strong> O(h²), onde h = Δt é o espaçamento entre pontos.</p>
      <p style="margin: 2px 0;"><strong>Justificativa:</strong> Com taxa de amostragem típica de 80-100 Hz, o erro de discretização é desprezível comparado à incerteza de medição da célula de carga (±0.05% F.S.).</p>
    </div>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">2. Detecção de Eventos Críticos</h3>
    <div class="info-box" style="background: #f8f9fa; border-left: 3px solid #e67e22; padding: 5px; margin: 3px 0; font-size: 7px;">
      <p style="margin: 2px 0;"><strong>2.1 Threshold Adaptativo (Anti-Noising)</strong></p>
      <p style="margin: 2px 0;">A detecção de ignição e burnout utiliza um limiar dinâmico baseado em análise estatística do ruído de fundo:</p>
      <p style="text-align: center; font-family: 'Courier New', monospace; background: white; padding: 3px; border-radius: 2px; margin: 3px 0; font-size: 7px;">
        F<sub>threshold</sub> = F<sub>média_ruído</sub> + k × σ<sub>ruído</sub>
      </p>
      <p style="margin: 2px 0;">onde <strong>k</strong> é o multiplicador configurável (padrão: 2.0σ) e <strong>σ</strong> é o desvio padrão amostral.</p>

      <p style="margin: 2px 0;"><strong>2.2 Desvio Padrão Amostral</strong></p>
      <p style="margin: 2px 0;"><strong>Referência:</strong> MARCHI, C. H. "Análise de Incertezas em Medições". Cap. 3, UFPR.</p>
      <p style="text-align: center; font-family: 'Courier New', monospace; background: white; padding: 3px; border-radius: 2px; margin: 3px 0; font-size: 7px;">
        σ = √[Σ(x<sub>i</sub> - x̄)² / (n-1)]
      </p>
      <p style="margin: 2px 0;"><strong>Ignição:</strong> Detectada quando F(t) > F<sub>threshold</sub> por tempo mínimo configurável.</p>
      <p style="margin: 2px 0;"><strong>Burnout:</strong> Detectado quando F(t) < F<sub>threshold</sub> após a ignição ter ocorrido.</p>
    </div>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">3. Métricas Estatísticas</h3>
    <table style="font-size: 7px; width: 100%; margin: 3px 0;">
      <tr>
        <th style="width: 25%; padding: 2px;">Métrica</th>
        <th style="width: 35%; padding: 2px;">Fórmula Matemática</th>
        <th style="width: 40%; padding: 2px;">Interpretação Física</th>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Impulso Total</strong></td>
        <td style="padding: 2px;">I = ∫ F(t) dt [N⋅s]</td>
        <td style="padding: 2px;">Quantidade total de movimento transferida pelo motor. Área sob a curva força-tempo.</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Força Máxima</strong></td>
        <td style="padding: 2px;">F<sub>max</sub> = max{F(t)} [N]</td>
        <td style="padding: 2px;">Pico de empuxo. Crítico para dimensionamento estrutural do foguete.</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Força Média (Queima)</strong></td>
        <td style="padding: 2px;">F̄<sub>queima</sub> = I / Δt<sub>queima</sub> [N]</td>
        <td style="padding: 2px;">Empuxo constante equivalente durante a fase de propulsão efetiva.</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Força Média (Amostral)</strong></td>
        <td style="padding: 2px;">F̄ = (1/n) Σ F<sub>i</sub> [N]</td>
        <td style="padding: 2px;">Média aritmética de todas as leituras, incluindo valores negativos (arrasto).</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Impulso Líquido</strong></td>
        <td style="padding: 2px;">I<sub>líq</sub> = I<sub>pos</sub> - |I<sub>neg</sub>| [N⋅s]</td>
        <td style="padding: 2px;">Impulso útil para propulsão, descontando arrasto e forças resistivas.</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Impulso Específico</strong></td>
        <td style="padding: 2px;">I<sub>sp</sub> = I / (m<sub>prop</sub> × g₀) [s]</td>
        <td style="padding: 2px;">Eficiência do propelente. Tempo que 1kg de propelente fornece 1kgf de empuxo.</td>
      </tr>
    </table>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">4. Incertezas de Medição</h3>
    <div class="info-box" style="background: #fff3cd; border-left: 3px solid #f39c12; padding: 5px; margin: 3px 0; font-size: 7px;">
      <p style="margin: 2px 0;"><strong>Referência:</strong> MARCHI, C. H. "Propagação de Incertezas". UFPR, 2015.</p>
      <p style="margin: 2px 0;"><strong>Incerteza Tipo A (Estatística):</strong> Obtida pelo desvio padrão das medições repetidas.</p>
      <p style="margin: 2px 0;"><strong>Incerteza Tipo B (Sistemática):</strong> Especificação do fabricante da célula de carga (típico: ±0.05% F.S.).</p>
      <p style="margin: 2px 0;"><strong>Incerteza Combinada do Impulso:</strong></p>
      <p style="text-align: center; font-family: 'Courier New', monospace; background: white; padding: 3px; border-radius: 2px; margin: 3px 0; font-size: 7px;">
        u<sub>c</sub>(I) = √[(∂I/∂F)² u²(F) + (∂I/∂t)² u²(t)]
      </p>
      <p style="margin: 2px 0;">Para taxa de amostragem constante e alta (>80 Hz), a incerteza temporal é desprezível, dominando a incerteza na medição de força.</p>
    </div>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">5. Classificação NAR/TRA</h3>
    <div class="info-box" style="background: #f8f9fa; border-left: 3px solid #27ae60; padding: 5px; margin: 3px 0; font-size: 7px;">
      <p style="margin: 2px 0;"><strong>Referências Normativas:</strong></p>
      <ul style="margin: 3px 0; padding-left: 15px;">
        <li><strong>NFPA 1122</strong> - Code for Model Rocketry</li>
        <li><strong>NFPA 1127</strong> - Code for High Power Rocketry</li>
        <li><strong>NAR/TRA Standards</strong> - Motor Classification System</li>
      </ul>
      <p style="margin: 2px 0;">A classificação por letras (A, B, C, ..., O) segue progressão logarítmica base 2:</p>
      <p style="text-align: center; font-family: 'Courier New', monospace; background: white; padding: 3px; border-radius: 2px; margin: 3px 0; font-size: 7px;">
        Classe N: 2<sup>N-1</sup> < I<sub>total</sub> ≤ 2<sup>N</sup> [N⋅s]
      </p>
      <p style="margin: 2px 0;">Exemplo: Classe D → 5 < I ≤ 10 N⋅s</p>
    </div>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">6. Limitações e Observações</h3>
    <div class="info-box" style="background: #f8d7da; border-left: 3px solid #e74c3c; padding: 5px; margin: 3px 0; font-size: 7px;">
      <ul style="margin: 3px 0; padding-left: 15px;">
        <li>O método dos trapézios assume variação linear entre pontos. Curvas com alta não-linearidade requerem maior taxa de amostragem.</li>
        <li>A detecção de ignição/burnout depende da correta calibração do threshold de ruído.</li>
        <li>O cálculo de I<sub>sp</sub> requer pesagem precisa do propelente antes e depois do teste.</li>
        <li>Vibrações externas e oscilações mecânicas podem introduzir ruído que afeta a precisão.</li>
        <li>A tara deve ser verificada antes de cada teste para eliminar offset sistemático.</li>
      </ul>
    </div>

    <h3 style="margin-top: 0.5rem; color: #2c3e50; font-size: 9px;">7. Referências Bibliográficas</h3>
    <div style="font-size: 7px; line-height: 1.4; background: #f8f9fa; padding: 5px; border-radius: 3px; margin: 3px 0;">
      <p style="margin: 2px 0;"><strong>[1]</strong> MARCHI, Carlos Henrique. <em>"Verificação de Soluções Numéricas"</em>. Departamento de Engenharia Mecânica, UFPR, 2015.</p>
      <p style="margin: 2px 0;"><strong>[2]</strong> MARCHI, Carlos Henrique. <em>"Análise de Incertezas em Medições"</em>. Notas de aula, UFPR.</p>
      <p style="margin: 2px 0;"><strong>[3]</strong> NFPA 1122: <em>Code for Model Rocketry</em>. National Fire Protection Association, 2018.</p>
      <p style="margin: 2px 0;"><strong>[4]</strong> NFPA 1127: <em>Code for High Power Rocketry</em>. National Fire Protection Association, 2018.</p>
      <p style="margin: 2px 0;"><strong>[5]</strong> NAR Standards and Testing Committee. <em>"Model Rocket Motor Classification"</em>.</p>
      <p style="margin: 2px 0;"><strong>[6]</strong> SUTTON, George P.; BIBLARZ, Oscar. <em>"Rocket Propulsion Elements"</em>. 9th Edition, Wiley, 2017.</p>
      <p style="margin: 2px 0;"><strong>[7]</strong> JCGM 100:2008. <em>"Evaluation of measurement data - Guide to the expression of uncertainty in measurement"</em> (GUM).</p>
    </div>
  </div>
  <!-- FIM EXPLICAÇÃO TÉCNICA -->

  <!-- INFORMAÇÕES TÉCNICAS -->
  <div class="secao avoid-break">
    <h2 style="font-size: 10px; margin-bottom: 3px;">⚙️ Informações do Sistema</h2>
    <table style="font-size: 8px;">
      <tr>
        <td style="padding: 2px;"><strong>Sistema de Aquisição:</strong></td>
        <td style="padding: 2px;">balançaGFIG v2.0 - Campus Gaspar IFSC</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Resolução:</strong></td>
        <td style="padding: 2px;">0.001 N</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Gravidade Local:</strong></td>
        <td style="padding: 2px;">9.80665 m/s²</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Taxa de Amostragem:</strong></td>
        <td style="padding: 2px;">${(sessao.dadosTabela.length / dados.duracao).toFixed(1)} Hz</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Classificação:</strong></td>
        <td style="padding: 2px;">NAR/TRA Standards</td>
      </tr>
      <tr>
        <td style="padding: 2px;"><strong>Normas de Referência:</strong></td>
        <td style="padding: 2px;">NFPA 1122, NFPA 1127</td>
      </tr>
    </table>
  </div>

  <!-- CLASSIFICAÇÃO DO MOTOR - Versão Compacta -->
  <div class="secao avoid-break" style="padding: 4px 0;">
    <h2 style="font-size: 10px; margin-bottom: 3px;">📊 Classificação NAR/TRA</h2>
    <div style="background: ${classificacao.cor}20; border-left: 3px solid ${classificacao.cor}; padding: 5px; border-radius: 3px; margin-bottom: 3px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 5px; font-size: 8px;">
        <div><strong>Classe:</strong> ${classificacao.classe}</div>
        <div><strong>Tipo:</strong> ${classificacao.tipo}</div>
        <div><strong>Nível:</strong> ${classificacao.nivel}</div>
      </div>
      <div style="margin-top: 3px; font-size: 7px; color: #555;">
        <strong>Faixa:</strong> ${classificacao.faixa} • <strong>Impulso:</strong> ${impulsoData.impulsoTotal.toFixed(2)} N⋅s
      </div>
    </div>
    <table style="font-size: 7px; width: 100%; margin: 3px 0;">
      <thead>
        <tr>
          <th style="padding: 2px; text-align: center;">Classe</th>
          <th style="padding: 2px; text-align: center;">Faixa (N⋅s)</th>
          <th style="padding: 2px; text-align: center;">Tipo</th>
          <th style="padding: 2px; text-align: center;">Nível</th>
        </tr>
      </thead>
      <tbody>
        ${gerarLinhasClassificacaoCompleta(impulsoData.impulsoTotal, classificacao.classe)}
      </tbody>
    </table>
  </div>

  <!-- RODAPÉ -->
  <div class="footer" style="margin-top: 10px; padding-top: 5px; border-top: 1px solid #dee2e6; text-align: center; font-size: 7px; color: #7f8c8d;">
    <p style="margin: 2px 0;"><strong>Relatório gerado automaticamente pela balançaGFIG</strong></p>
    <p style="margin: 2px 0;"><strong>Grupo de Foguetes do Campus Gaspar (GFIG)</strong></p>
    <p style="margin: 2px 0;">CompSteam • Projeto BoxSteam • Controle e Automação de Eletrodomésticos do Cotidiano</p>
    <p style="margin: 2px 0;">Instituto Federal de Santa Catarina (IFSC) - Campus Gaspar</p>
    <p style="margin: 2px 0;">© 2025 - Todos os direitos reservados</p>
    <p style="margin: 2px 0;">Data de geração: ${new Date().toLocaleString('pt-BR')}</p>
  </div>

</body>
</html>
  `;
}
