# Análise Completa de Queima - Modo Minimalista

## 📋 Resumo

Implementação de um sistema completo de análise de queima no modal minimalista, similar à aplicação completa. Agora o usuário pode:

✅ **Detecção Automática** - Identifica automaticamente início e fim da queima (5% da força máxima)
✅ **Tempo de Queima** - Calcula duração precisa do evento
✅ **Impulso Total** - Calcula a área sob a curva usando regra do trapézio
✅ **Impulso Médio** - Calcula impulso por segundo
✅ **Reset Automático** - Botão para re-detectar se necessário
✅ **Interface Clara** - Painel com seções para leitura geral e análise de queima

## 🎯 Funcionalidades Implementadas

### 1. Detecção Automática de Queima

**Função:** `detectBurnStart()` e `detectBurnEnd()`

```javascript
// Algoritmo: Encontra 5% da força máxima como threshold
const maxForce = Math.max(...forceValues);
const threshold = maxForce * 0.05;

// Detecta INÍCIO: primeiro ponto > threshold
// Detecta FIM: último ponto > threshold
```

**Vantagens:**
- Automático e rápido
- Adaptável a qualquer magnitude de força
- Usa o mesmo algoritmo da app completa

### 2. Cálculo de Impulso

**Função:** `calculateBurnMetrics()`

```javascript
// Usa regra do trapézio para integração numérica
for (let i = 0; i < timeValues.length; i++) {
    if (data_dentro_da_queima) {
        const dt = tCur - tPrev;
        const f1 = forceValues[i - 1];
        const f2 = forceValues[i];
        const areaTrap = dt * (f1 + f2) / 2;  // Área do trapézio
        impulsoTotal += areaTrap;
    }
}

const impulsoMedio = impulsoTotal / duracao;  // N/s
```

**Resultados:**
- **Impulso Total (N·s)**: Integral completa da força sobre o tempo
- **Impulso Médio (N/s)**: Força média durante a queima

### 3. Linhas de Marcação Precisas

**Posicionamento Temporal:**
- Linhas não ficam apenas nas extremidades
- Calculam posição baseado no **tempo real** dos eventos
- Realocam-se automaticamente com a detecção

```javascript
// Calcula posição X baseado no tempo
const startXPercent = (burnStartTime - minTime) / timeRange;
const startX = padding + graphWidth * startXPercent;
```

### 4. Interface com Seções

**Leitura Geral:**
- Valor Mínimo
- Valor Máximo
- Valor Médio
- Duração Total

**Análise de Queima:**
- Início Queima (tempo em segundos)
- Fim Queima (tempo em segundos)
- Tempo de Queima
- Impulso Total (N·s)
- Impulso Médio (N/s)

**Controles:**
- Botão "Auto-Detectar" para re-executar detecção

## 🔧 Modificações Técnicas

### HTML - Modal Expandido (Linhas 719-761)

```html
<div class="stats-group">
  <h3>Análise de Queima</h3>
  <div class="stat-item">
    <label>Início Queima</label>
    <span id="burnStartTime">---</span>
  </div>
  <!-- ... mais elementos ... -->
</div>
```

### CSS - Novos Estilos (Linhas 541-592)

```css
.stats-group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.stats-group h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### JavaScript - Novas Funções

| Função | Linhas | Descrição |
|--------|--------|-----------|
| `detectBurnStart()` | 964-975 | Encontra início da queima |
| `detectBurnEnd()` | 977-988 | Encontra fim da queima |
| `calculateBurnMetrics()` | 990-1015 | Calcula impulso e duração |
| `resetBurnDetection()` | 1017-1028 | Re-executa detecção |
| `showAnalysisModal()` (modificado) | 1048-1070 | Agora chama detecção automática |
| `renderAnalysisGraph()` (modificado) | 1072-1222 | Desenha linhas baseadas em tempo real |
| `updateAnalysisStats()` (modificado) | 1228-1277 | Exibe métricas de queima |

## 📊 Exemplo de Dados

### Entrada
```
Dados coletados: 150 amostras em 2.5 segundos
Força máxima: 42.3 N
Threshold (5%): 2.115 N
```

### Saída
```
Leitura Geral:
  Mín: 0.23 N
  Máx: 42.30 N
  Média: 12.45 N
  Duração: 2.500 s

Análise de Queima:
  Início: 0.342 s (primeira amostra > 2.115 N)
  Fim: 1.847 s (última amostra > 2.115 N)
  Tempo de Queima: 1.505 s
  Impulso Total: 18.73 N·s
  Impulso Médio: 12.44 N/s
```

## 🎨 Visual do Gráfico

```
┌────────────────────────────────────────────┐
│     Início                        Fim       │
│     ┃                             ┃         │
│ 42N ├─ • ╱╲   ╱╲                 ┃         │
│     │  ╱  ╲╱  ╲ ╱╲              ╱┃         │
│ 21N ├ ╱    •   ╲╱  ╲          ╱  ┃         │
│     │           ╲    ╲      ╱    ┃         │
│  0N ├────────────•─────\───/─────┃──────── │
│     │          0.3s   1.8s                 │
│     └────────────────────────────────────────┘
      Tempo (s)
```

## 🔄 Fluxo de Execução

```
1. Usuário para gravação
   ↓
2. generateAndSaveSession()
   ↓
3. showAnalysisModal()
   ├─ detectBurnStart() ─┐
   ├─ detectBurnEnd()   ├─ Auto-detecção
   └─ renderAnalysisGraph() + updateAnalysisStats()
   ↓
4. Modal exibe:
   ├─ Gráfico com linhas Verde (Início) e Amarelo (Fim)
   └─ Painel com estatísticas completas
   ↓
5. Usuário pode:
   ├─ Clicar "Auto-Detectar" para re-executar
   ├─ Clicar "Salvar Sessão" para persistir
   └─ Clicar "Descartar" para cancelar
```

## 🧮 Algoritmo de Impulso

### Regra do Trapézio

Para cada intervalo entre amostras dentro da queima:

```
Área = (tCur - tPrev) × (f1 + f2) / 2
```

Onde:
- `tCur`, `tPrev`: Tempos em segundos
- `f1`, `f2`: Forças em Newtons
- Área: Aproximação da integral (N·s)

### Impulso Médio

```
Impulso Médio = Impulso Total / Duração da Queima
```

Resultado em N/s (força média durante o período)

## 🧪 Testes Recomendados

### 1. Detecção Básica
- [ ] Iniciar/parar gravação
- [ ] Verificar se modal aparece com auto-detecção
- [ ] Confirmar linhas aparecem na posição correta

### 2. Cálculo de Impulso
- [ ] Comparar impulso com aplicação completa (mesma sessão)
- [ ] Verificar valores razoáveis (positivos, não infinitos)
- [ ] Testar com sessões de diferentes durações

### 3. Botão Auto-Detectar
- [ ] Clicar múltiplas vezes deve re-calcular
- [ ] Valores devem permanecer consistentes
- [ ] Gráfico deve atualizar corretamente

### 4. Unidades
- [ ] Testar N, kg, g com mesmo evento
- [ ] Impulso não deve mudar (sempre N·s)
- [ ] Força exibida deve converter corretamente

### 5. Casos Extremos
- [ ] Queima muito curta (< 0.1s)
- [ ] Queima muito longa (> 5s)
- [ ] Força muito baixa (< 1N)
- [ ] Força muito alta (> 100N)

## 🔗 Referências

**Arquivo modificado:** `/home/rbeninca/gdrive/Documentos/PlatformIO/Projects/balanca_nodemcu/data/minimal.html`

**Linhas principais:**
- Detecção: 954-1028
- Renderização: 1072-1222
- Estatísticas: 1228-1277

**Baseado em:** `burn_analysis.js` (linhas 220-280)

## 📝 Notas de Implementação

1. ✅ Usa mesmo threshold (5%) da app completa
2. ✅ Mesma fórmula de impulso (trapézio)
3. ✅ Cores padronizadas (Verde: Início, Amarelo: Fim)
4. ✅ Sem dependências externas
5. ✅ Responsivo em desktop e mobile
6. ✅ Zero erros de sintaxe

## 🎓 Próximas Melhorias

1. **Clique para Ajustar** - Permitir usuário clicar no gráfico para ajustar início/fim
2. **Histórico** - Guardar detecções anteriores
3. **Comparação** - Comparar múltiplas queimas
4. **Exportação** - CSV/PDF com análise completa
5. **Classe de Foguete** - Classificar impulso em classe A, B, C, etc.
