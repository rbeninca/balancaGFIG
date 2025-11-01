# 🎮 TEMPLATES DE JOGOS COM CÉLULA DE CARGA

Bem-vindo à coleção de templates de jogos para uso com célula de carga!

## 📋 O QUE É ISSO?

Esta coleção contém 8 templates de jogos completos e funcionais que usam uma célula de carga como entrada. Cada template é um arquivo HTML único e autocontido, perfeito para estudantes aprenderem e adaptarem.

## 🎯 JOGOS DISPONÍVEIS

1. **🥊 Soco do Século** - Classifica seus socos em diferentes tipos baseado na força
2. **🎵 Beat Smasher** - Jogo de ritmo onde você aperta no beat da música
3. **🎯 Precisão Extrema** - Teste de precisão para acertar alvos exatos
4. **⛰️ Escalada do Jaraguá** - Escale uma montanha gerenciando stamina
5. **⚡ Reflexo Relâmpago** - Teste seu tempo de reação
6. **🏋️ Treino do Rocky** - Complete séries de exercícios progressivos
7. **🎰 Roleta da Força** - Cassino onde a força determina o prêmio
8. **⚡ Reação em Cadeia** - Acerte múltiplos alvos em sequência rápida

## 🔧 COMO FUNCIONA A LEITURA DA CÉLULA

Todos os templates leem a força da célula de carga através de:

```javascript
window.opener.sharedState.forcaAtual
```

Esta variável contém a força atual em **Newtons**. Para converter para kg:

```javascript
const forceKg = window.opener.sharedState.forcaAtual / 9.81;
```

## 🚀 COMO USAR

### Para Professores:
1. Escolha o(s) template(s) que deseja usar
2. Distribua para os alunos
3. Oriente-os a modificar e personalizar

### Para Alunos:
1. Abra o arquivo HTML no navegador
2. Estude o código (HTML + CSS + JavaScript)
3. Modifique e experimente!
4. Cada arquivo tem comentários explicativos

## 📚 ESTRUTURA DOS TEMPLATES

Cada template contém:

- **HTML**: Estrutura da interface
- **CSS**: Estilos visuais (dentro de `<style>`)
- **JavaScript**: Lógica do jogo (dentro de `<script>`)
- **Comentários**: Explicações e dicas para adaptação

## 🎨 PERSONALIZANDO

### Onde Modificar:

1. **Cores e Visual**: Seção `<style>`
2. **Configurações do Jogo**: Objeto `GAME_CONFIG` no JavaScript
3. **Lógica do Jogo**: Funções principais comentadas
4. **Mensagens**: Variáveis de texto

### Exemplos Fáceis:

```javascript
// Mudar dificuldade
const GAME_CONFIG = {
    minForce: 20,  // Aumentar = mais difícil
    maxForce: 80,  // Diminuir = mais difícil
    tolerance: 5,  // Menor = mais preciso
};

// Mudar cores (CSS)
background: linear-gradient(135deg, #FF0000, #0000FF);

// Mudar textos
messageElement.textContent = "Sua mensagem aqui!";
```

## 🧪 TESTANDO SEM CÉLULA

Cada template tem uma linha comentada para simulação:

```javascript
// DESCOMENTE ESTA LINHA PARA TESTAR SEM CÉLULA:
// currentForce = Math.random() * 50;
```

Ou use o teclado:
```javascript
document.addEventListener('keydown', () => { currentForce = 30; });
document.addEventListener('keyup', () => { currentForce = 0; });
```

## 💡 IDEIAS DE EXPANSÃO

Todos os templates incluem uma seção com ideias de expansão como:
- Sistema de ranking
- Modo multiplayer
- Power-ups
- Diferentes níveis
- Efeitos sonoros
- Animações avançadas

## 🐛 DEBUG

Cada template tem um painel de debug no rodapé mostrando:
- Força atual
- Estado da conexão
- Variáveis do jogo

Para remover em produção, delete a `<div class="debug">`.

## 📖 RECURSOS DE APRENDIZADO

### JavaScript Básico:
- Variáveis e constantes
- Funções
- Eventos
- SetInterval/setTimeout
- Manipulação do DOM

### JavaScript Intermediário:
- Classes CSS dinâmicas
- Animações
- Game loops
- State management

### CSS:
- Flexbox/Grid
- Animações
- Gradientes
- Transformações

## 🆘 PROBLEMAS COMUNS

### "Conexão: ❌ OFF"
- Verifique se o arquivo foi aberto pelo sistema correto
- Certifique-se que `window.opener.sharedState` está disponível

### "Força sempre 0"
- Verifique a conexão da célula
- Teste com simulação (veja seção "Testando sem Célula")

### "Nada acontece quando pressiono"
- Verifique a configuração `minForce`
- Olhe o debug para ver se a força está sendo lida

## 🎓 PARA ALUNOS: SUGESTÕES DE PROJETOS

1. **Fácil**: Mude cores, textos e configurações básicas
2. **Médio**: Adicione novos níveis ou modos de jogo
3. **Difícil**: Combine elementos de 2 jogos diferentes
4. **Avançado**: Crie um jogo completamente novo usando a estrutura

## 📝 LICENÇA E USO

Estes templates são educacionais e livres para uso, modificação e distribuição.

## 🤝 CONTRIBUINDO

Melhorias são bem-vindas! Ideias para novos jogos:
- Quebra-cabeças de força
- Jogo de construção
- Simulador de esportes
- Jogo de estratégia

---

**Divirta-se criando! 🎮⚡**

Se tiver dúvidas, revise os comentários dentro de cada arquivo HTML.
