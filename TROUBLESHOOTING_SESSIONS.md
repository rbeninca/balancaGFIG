# Guia de Diagnóstico: Sessões Não Estão Sendo Salvas

## 1. Verificação Rápida - Console do Navegador

Abra o **Console do Navegador** (F12 → Aba "Console") e execute uma gravação:

```
1. Clique em "🚀 Nova Sessão de Teste"
2. Preencha o nome da sessão
3. Clique em "▶ Iniciar Gravação"
4. Deixe gravar por alguns segundos
5. Clique em "⏹ Encerrar Sessão"
```

### Mensagens Esperadas no Console:

```javascript
// Quando você clica em "Encerrar Sessão":
[salvarDadosDaSessao] Iniciando salvamento da sessão: "Minha Sessão"
[salvarDadosDaSessao] Número de linhas na tabela: 150
[salvarDadosDaSessao] Gravação preparada - ID: 1701234567890, Nome: Minha Sessão, Dados: 150 linhas
[salvarDadosDaSessao] Sessões existentes no localStorage: 5
[salvarDadosDaSessao] ✓ Sessão salva no localStorage com sucesso. Total de sessões: 6

// Quando você abre a aba "💾 Gravações":
[loadAndDisplayAllSessions] Sessões locais encontradas: 6
[loadAndDisplayAllSessions] Sessões no DB encontradas: 3
[loadAndDisplayAllSessions] Sessões locais processadas e adicionadas ao mapa
[loadAndDisplayAllSessions] Total de sessões combinadas (local + DB): 9
```

---

## 2. Checklist de Diagnóstico

### ✓ Passo 1: Verificar se a Sessão é Salva Localmente

No Console, execute:
```javascript
JSON.parse(localStorage.getItem('balancaGravacoes')).length
```

**Esperado:** Um número inteiro > 0

**Se retornar `0` ou `null`:**
- LocalStorage pode estar vazio
- Tente fazer uma nova gravação

---

### ✓ Passo 2: Verificar o Status do MySQL

Olhe no **Footer** (rodapé) da aplicação:
- **MySQL:** `Conectado` ou `Desconectado`

Se estiver `Desconectado`:
- As sessões ainda serão salvas **localmente** no navegador
- Você verá um alerta: "MySQL desconectado. Você poderá sincronizar quando a conexão retornar."
- Depois, pode clicar em "💾 ➜ ☁️ Salvar no BD" para sincronizar manualmente

---

### ✓ Passo 3: Verificar a Aba "💾 Gravações"

1. Abra a aba "💾 Gravações"
2. Procure pela sua sessão recém-gravada
3. Se nada aparecer, abra o Console e procure por erros

**Mensagens de Erro Comuns:**

```javascript
// Erro: LocalStorage cheio
[salvarDadosDaSessao] ✗ Erro ao salvar no localStorage: QuotaExceededError

// Solução: Exclua sessões antigas ou limpe o cache do navegador
```

---

### ✓ Passo 4: Verificar o Fluxo WebSocket → MySQL

Se a sessão aparece em "💾 Gravações" mas não está no MySQL:

1. Abra o Console
2. Procure por mensagens assim:

```javascript
[sendCommandToWorker] Enviando comando 'save_session_to_mysql' com sessão: Minha Sessão (ID: 1701234567890)
[sendCommandToWorker] ✓ Mensagem enviada ao worker
```

3. Se ver essas mensagens, o comando foi enviado corretamente
4. Aguarde alguns segundos e procure por:

```javascript
// Sucesso:
mysql_save_success // mensagem no console

// Erro:
mysql_save_error // mensagem no console
```

---

## 3. Problemas Comuns e Soluções

| Problema | Causa | Solução |
|----------|-------|--------|
| Sessões não aparecem em "💾 Gravações" | LocalStorage vazio ou erro ao salvar | Verifique o Console para erros, limpe cache |
| Sessões aparecem localmente mas não no MySQL | MySQL desconectado | Reconecte o servidor e clique "💾 ➜ ☁️ Salvar no BD" |
| "Worker não está conectado" | Worker não inicializou | Atualize a página |
| "LocalStorage pode estar cheio" | Cota de armazenamento atingida | Exclua sessões antigas ou limpe dados no navegador |
| MySQL status sempre "Desconectado" | Servidor Python não está rodando ou não conectado ao MySQL | Verifique `server.py`, logs do MySQL em `docker-compose.yml` |

---

## 4. Executar Diagnóstico Automático no Console

Copie e cole no Console do Navegador:

```javascript
// ===== DIAGNÓSTICO DE SESSÕES =====
console.log("=== DIAGNÓSTICO: SALVAMENTO DE SESSÕES ===\n");

// 1. Verificar localStorage
const localSessions = JSON.parse(localStorage.getItem('balancaGravacoes')) || [];
console.log("✓ Sessões no LocalStorage:", localSessions.length);
if (localSessions.length > 0) {
  console.log("  Últimas 3 sessões:");
  localSessions.slice(-3).forEach((s, i) => {
    console.log(`  ${i+1}. "${s.nome}" (ID: ${s.id}, ${s.dadosTabela?.length || 0} leituras)`);
  });
}

// 2. Verificar status do MySQL
console.log("\n✓ MySQL Conectado:", isMysqlConnected);

// 3. Verificar Worker
console.log("✓ Worker Conectado:", dataWorker ? 'Sim' : 'Não');

// 4. Verificar elementos da UI
const listaGravacoes = document.getElementById('lista-gravacoes');
console.log("✓ Container de Gravações Encontrado:", listaGravacoes ? 'Sim' : 'Não');
console.log("✓ Sessões exibidas na UI:", listaGravacoes?.children.length || 0);

console.log("\n=== FIM DO DIAGNÓSTICO ===");
```

---

## 5. Logs do Servidor (Se Disponível)

Se você tem acesso ao servidor Python:

```bash
# Ver logs em tempo real
docker-compose logs -f server

# Procurar por erros MySQL
docker-compose logs server | grep -i mysql
```

**Procure por:**
```
Salvando sessão 'Minha Sessão' (ID: 1701234567890) no MySQL...
Sessão inserida/atualizada: Minha Sessão
```

---

## 6. Próximas Ações

Se o problema persistir após verificar os itens acima:

1. **Verifique a conexão de rede:**
   - O WebSocket está conectado? (veja o Footer: "🔌 Conexão: Conectado")
   - A API HTTP está acessível? (abra `/api/sessoes` no navegador)

2. **Limpe o cache do navegador:**
   - F12 → Application → Clear site data
   - Recarregue a página

3. **Reinicie os serviços:**
   ```bash
   docker-compose restart
   ```

4. **Verifique o banco de dados MySQL:**
   ```bash
   docker-compose exec mysql mysql -u root -p balanca -e "SELECT COUNT(*) FROM sessoes;"
   ```

---

## 7. Informações Úteis para Reporte de Bugs

Quando reportar um problema, inclua:

1. **Logs do Console** (copie tudo)
2. **Output do comando:**
   ```javascript
   console.log({
     localSessions: JSON.parse(localStorage.getItem('balancaGravacoes')).length,
     mysqlConnected: isMysqlConnected,
     workerConnected: !!dataWorker
   });
   ```
3. **Logs do servidor** (caso disponível)
4. **Versão do navegador** (Chrome, Firefox, etc.)
5. **Passos para reproduzir** o problema

---

**Atualizado:** 6 de novembro de 2025  
**Versão:** 1.0
