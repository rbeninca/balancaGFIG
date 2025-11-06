📊 CORREÇÃO: Leituras Totais do Teste Estático vs Queima no PDF

═════════════════════════════════════════════════════════════════════

## 🔴 Problema Identificado

No relatório PDF, as leituras totais do **Teste Estático** e da **Queima** 
estavam sendo exibidas como **IGUAIS**, quando na verdade:

- **Teste Estático:** Total de leituras do teste completo
- **Queima:** Total de leituras APENAS no intervalo de queima (subconjunto)

**Logo:** Queima sempre será ≤ Teste Estático (nunca igual!)

### Exemplo do Problema:
```
❌ ANTES (Incorreto):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Teste Estático:
  Total de Leituras: 523 leituras
  
Queima Detectada:
  Leituras na Queima: 523 leituras  ← ERRADO! Deveria ser menor
```

### Como Deveria Ser:
```
✅ DEPOIS (Correto):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Teste Estático:
  Total de Leituras: 523 leituras ✓
  
Queima Detectada:
  Leituras na Queima: 285 leituras ✓ (Subconjunto!)
```


## 🔍 Causa Raiz

### O Problema Técnico:

Na função `gerarRelatorioPdf()` em `script.js`:

```javascript
// ❌ Dados de todo o teste
const session = await getSessionDataForExport(sessionId, source);

// ❌ Dados já filtrados para a queima
const dados = burnData.dadosFiltrados;

// ❌ sessionParaPDF também filtrado para a queima
sessionParaPDF.dadosTabela = session.dadosTabela.filter(...)
```

**Então no PDF:**
- `dados.tempos.length` = leituras da QUEIMA (filtrado)
- Na seção "Teste Estático", estava usando `dados.tempos.length`
- Resultado: Ambas as seções mostravam o mesmo número!

### Visualização do Fluxo:
```
session (523 leituras totais)
       ↓
   filter()
       ↓
dados (285 leituras - queima) ← Usado em AMBAS as seções (ERRADO!)
```


## ✅ Solução Implementada

### Passo 1: Capturar Dados Totais
**Arquivo:** `script.js`  
**Função:** `gerarRelatorioPdf()`

```javascript
// Adicionar ANTES de filtrar:
const dadosTotais = processarDadosSimples(session.dadosTabela);
// ↑ Captura dados completos do teste (523 leituras)

// Depois filtrar para a queima:
const dados = burnData.dadosFiltrados;
// ↑ Dados filtrados da queima (285 leituras)
```

### Passo 2: Passar para Função de PDF
```javascript
// Antes:
const html = gerarHTMLRelatorioCompleto(sessionParaPDF, dados, ...);

// Depois:
const html = gerarHTMLRelatorioCompleto(sessionParaPDF, dados, ..., dadosTotais);
// ↑ Adiciona parâmetro com dados totais
```

### Passo 3: Usar Dados Corretos no PDF
**Arquivo:** `funcoespdf.js`  
**Função:** `gerarHTMLRelatorioCompleto()`

```javascript
// Assinatura atualizada:
function gerarHTMLRelatorioCompleto(sessao, dados, impulsoData, 
  metricasPropulsao, imagemGrafico, burnInfo = null, dadosTotais = null)

// Na seção "Teste Estático":
Total de Leituras: ${dadosTotais ? dadosTotais.tempos.length : dados.tempos.length}
// ↑ Usa dadosTotais (523) quando disponível

// Na seção "Queima Detectada":
Leituras na Queima: ${dados.tempos.length}
// ↑ Continua usando dados filtrados (285)
```


## 📊 Diferença Visual no PDF

### Seção: Teste Estático (Completo)
```
┌─────────────────────────────────────────┐
│ Duração Total: 12.456s                  │
│ Total de Leituras: 523 leituras ← DADOS TOTAIS |
│ Frequência: 41.9/s                      │
└─────────────────────────────────────────┘
```

### Seção: Queima Detectada
```
┌─────────────────────────────────────────┐
│ Duração Queima: 8.234s                  │
│ Leituras na Queima: 285 leituras ← SUBCONJUNTO |
│ Frequência: 34.6/s                      │
└─────────────────────────────────────────┘
```

**Diferença:** 523 > 285 ✓ (Correto!)


## 🧪 Validação da Lógica

### Relação Matemática Correta:
```
Leituras Totais ≥ Leituras na Queima

523 ≥ 285 ✓ VERDADEIRO

Nunca pode ser:
285 = 285 ❌ Errado (era antes)
285 > 523 ❌ Impossível
```

### Cálculo de Frequência Também Correto:
```
Teste Estático:
  523 leituras ÷ 12.456s = 41.9 Hz ✓

Queima Detectada:
  285 leituras ÷ 8.234s = 34.6 Hz ✓
```


## 📝 Mudanças Realizadas

### 1. Script.js (linha ~3060)
```javascript
// Nova linha adicionada:
const dadosTotais = processarDadosSimples(session.dadosTabela);

// Chamada atualizada:
const html = gerarHTMLRelatorioCompleto(..., dadosTotais);
```

### 2. Funcoespdf.js (linha ~489)
```javascript
// Assinatura atualizada:
function gerarHTMLRelatorioCompleto(..., dadosTotais = null)

// Cards do Teste Estático atualizados (linha ~860):
Total de Leituras: ${dadosTotais ? dadosTotais.tempos.length : dados.tempos.length}
Frequência: ${dadosTotais ? ... : dados...}
```


## ✨ Benefícios

✅ **Precisão:** Teste Estático mostra dados TOTAIS  
✅ **Consistência:** Queima mostra dados FILTRADOS  
✅ **Lógica Correta:** Total ≥ Parte (sempre verdade)  
✅ **Frequência Exata:** Cada seção calcula com seus dados reais  
✅ **Comparabilidade:** Agora dá para comparar teste vs queima  


## 🎯 Significado dos Números Agora

**Teste Estático = 523 leituras:**
- Coleta começou
- Até o último sensor disparar (fim do teste)

**Queima = 285 leituras:**
- Primeira força detectada (>5% da máxima)
- Até última força detectada
- **Está DENTRO do intervalo do Teste Estático**

**Queima sempre será menor porque é um subconjunto!**


## 📋 Checklist

- [x] Problema identificado
- [x] Causa raiz encontrada
- [x] Solução implementada
- [x] Dados totais capturados
- [x] Parâmetro adicionado
- [x] PDF usa dados corretos
- [x] Sem erros de sintaxe
- [x] Lógica validada


═════════════════════════════════════════════════════════════════════

✅ Status: CORRIGIDO
📅 Data: 2025-01-15
🔧 Arquivos: script.js + funcoespdf.js
