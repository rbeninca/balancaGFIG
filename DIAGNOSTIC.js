// 🧪 DIAGNOSTIC SCRIPT - Cole no Console do Browser
// Este script diagnostica o status do aplicativo de sessões

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║          🧪 DIAGNÓSTICO DE SESSÕES - Balança              ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");

// ============================================================================
// 1. Verificar localStorage
// ============================================================================
console.log("📊 1. ESTADO DO LOCAL STORAGE");
console.log("─────────────────────────────────────────────────────────────");
try {
    const localData = localStorage.getItem('balancaGravacoes');
    if (!localData) {
        console.warn("⚠️  localStorage VAZIO - Nenhuma sessão salva localmente");
    } else {
        const sessions = JSON.parse(localData);
        console.log(`✓ localStorage CONTÉM ${sessions.length} SESSÃO(ÕES)`);
        
        sessions.forEach((s, idx) => {
            const linhas = s.dadosTabela?.length || 0;
            const id = s.id;
            const nome = s.nome;
            const timestamp = s.timestamp ? new Date(s.timestamp).toLocaleString('pt-BR') : 'N/A';
            console.log(`  ${idx + 1}. [ID: ${id}] "${nome}"`);
            console.log(`     └─ ${linhas} linhas de dados • ${timestamp}`);
        });
    }
} catch (e) {
    console.error("✗ ERRO ao ler localStorage:", e.message);
}
console.log("");

// ============================================================================
// 2. Verificar Metadados do Motor
// ============================================================================
console.log("🚀 2. METADADOS DO MOTOR");
console.log("─────────────────────────────────────────────────────────────");
try {
    const sessions = JSON.parse(localStorage.getItem('balancaGravacoes') || '[]');
    if (sessions.length === 0) {
        console.warn("⚠️  Sem sessões para verificar metadados");
    } else {
        const firstSession = sessions[0];
        const meta = firstSession.metadadosMotor || {};
        console.log("Primeira sessão - Metadados do Motor:");
        console.log(`  • Diâmetro: ${meta.diameter || 'N/A'} mm`);
        console.log(`  • Comprimento: ${meta.length || 'N/A'} mm`);
        console.log(`  • Fabricante: ${meta.manufacturer || 'N/A'}`);
        console.log(`  • Peso do Propelente: ${meta.propweight || 'N/A'} kg`);
        console.log(`  • Peso Total: ${meta.totalweight || 'N/A'} kg`);
        console.log(`  • Descrição: ${meta.description || 'N/A'}`);
        console.log(`  • Observações: ${meta.observations || 'N/A'}`);
    }
} catch (e) {
    console.error("✗ ERRO ao ler metadados:", e.message);
}
console.log("");

// ============================================================================
// 3. Testar Funções Críticas
// ============================================================================
console.log("⚙️  3. TESTE DE FUNÇÕES CRÍTICAS");
console.log("─────────────────────────────────────────────────────────────");

// Teste HTML Escaping
console.log("Teste 1: HTML Escaping");
const escapeHtml = (text) => {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};
const testXss = '<script>alert("XSS")</script>';
const escaped = escapeHtml(testXss);
console.log(`  Input:  ${testXss}`);
console.log(`  Output: ${escaped}`);
console.log(`  Status: ${escaped !== testXss ? '✓ SEGURO' : '✗ VULNERÁVEL'}`);
console.log("");

// Teste Parse de Timestamp
console.log("Teste 2: Parse de Timestamp");
const parseDbTimestampToUTC = (timestamp) => {
    try {
        const date = new Date(timestamp);
        return date instanceof Date && !isNaN(date) ? date : new Date(parseInt(timestamp));
    } catch {
        return new Date();
    }
};
const now = new Date().toISOString();
const parsed = parseDbTimestampToUTC(now);
console.log(`  Input:  ${now}`);
console.log(`  Output: ${parsed.toLocaleString('pt-BR')}`);
console.log(`  Status: ✓ OK`);
console.log("");

// ============================================================================
// 4. Simular Renderização
// ============================================================================
console.log("🎨 4. TESTE DE RENDERIZAÇÃO");
console.log("─────────────────────────────────────────────────────────────");
try {
    const sessions = JSON.parse(localStorage.getItem('balancaGravacoes') || '[]');
    if (sessions.length === 0) {
        console.warn("⚠️  Sem sessões para renderizar");
    } else {
        console.log(`Renderizando ${sessions.length} sessão(ões)...`);
        
        sessions.forEach((session, idx) => {
            try {
                const meta = session.metadadosMotor || {};
                const hasMeta = meta.diameter || meta.length || meta.manufacturer;
                console.log(`  ✓ Sessão ${idx + 1} renderizável`);
                if (hasMeta) {
                    console.log(`    └─ Metadados: ${meta.description || meta.manufacturer || 'N/A'}`);
                }
            } catch (e) {
                console.error(`  ✗ Sessão ${idx + 1} COM ERRO:`, e.message);
            }
        });
    }
} catch (e) {
    console.error("✗ ERRO ao testar renderização:", e.message);
}
console.log("");

// ============================================================================
// 5. Verificar Função loadAndDisplayAllSessions
// ============================================================================
console.log("📋 5. STATUS DA FUNÇÃO loadAndDisplayAllSessions");
console.log("─────────────────────────────────────────────────────────────");
if (typeof loadAndDisplayAllSessions === 'function') {
    console.log("✓ Função loadAndDisplayAllSessions existe");
    console.log("  Pronta para chamada manual: loadAndDisplayAllSessions()");
} else {
    console.error("✗ Função loadAndDisplayAllSessions NÃO ENCONTRADA");
}
console.log("");

// ============================================================================
// 6. Relatório Final
// ============================================================================
console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║                   📋 RELATÓRIO FINAL                       ║");
console.log("╚════════════════════════════════════════════════════════════╝");

const dataOk = localStorage.getItem('balancaGravacoes') !== null;
const funcOk = typeof loadAndDisplayAllSessions === 'function';
const countSessions = dataOk ? JSON.parse(localStorage.getItem('balancaGravacoes')).length : 0;

console.log("");
console.log("Status do Sistema:");
console.log(`  ${dataOk ? '✓' : '✗'} localStorage com dados`);
console.log(`  ${funcOk ? '✓' : '✗'} Função loadAndDisplayAllSessions disponível`);
console.log(`  ${countSessions > 0 ? '✓' : '⚠️'} ${countSessions} sessão(ões) armazenada(s)`);
console.log("");

if (!dataOk) {
    console.warn("⚠️  AVISO: localStorage vazio. Grave uma nova sessão primeiro.");
} else if (!funcOk) {
    console.error("✗ ERRO: Função loadAndDisplayAllSessions não carregada.");
} else if (countSessions === 0) {
    console.warn("⚠️  AVISO: Nenhuma sessão salva. Grave uma para testar.");
} else {
    console.log("✓ Sistema aparentemente OK!");
    console.log("");
    console.log("Próximos passos:");
    console.log("  1. Abra a aba '💾 Gravações'");
    console.log("  2. Execute: loadAndDisplayAllSessions()");
    console.log("  3. Sessões devem aparecer");
}

console.log("");
console.log("════════════════════════════════════════════════════════════");
console.log("💡 DICAS PARA DEBUGGING:");
console.log("════════════════════════════════════════════════════════════");
console.log("");
console.log("Listar todas as sessões:");
console.log("  JSON.parse(localStorage.getItem('balancaGravacoes'))");
console.log("");
console.log("Ver a primeira sessão:");
console.log("  JSON.parse(localStorage.getItem('balancaGravacoes'))[0]");
console.log("");
console.log("Limpar localStorage:");
console.log("  localStorage.removeItem('balancaGravacoes')");
console.log("  location.reload()");
console.log("");
console.log("Recarregar exibição:");
console.log("  loadAndDisplayAllSessions()");
console.log("");
