# 🚀 GFIG - Balança de Teste Estático (Versão 2.0)

**Projeto de Foguetes de Modelismo Experimental - Campus Gaspar - IFC**
A aplicação é uma balança digital para testes estáticos de motores de minifoguetes experimentais, composta por três camadas integradas: o firmware no ESP, um servidor intermediário em Python e uma interface web interativa.
O ESP realiza a leitura da célula de carga e envia os dados por protocolo binário via USB ao servidor.
O servidor Python decodifica os pacotes, aplica filtros e disponibiliza os valores em tempo real através de WebSocket (WS) para os clientes conectados.
A aplicação web exibe gráficos dinâmicos usando Chartist.js, mostrando força e estabilidade das medições.
Um Web Worker (dataWorker.js) processa as amostras sem bloquear a UI, armazenando e repassando dados para o gráfico.
Há scripts auxiliares para geração de relatórios em PDF e manipulação de sessões de teste.
Toda a aplicação é containerizada com Docker (Dockerfile e docker-compose.yml), garantindo portabilidade.
O sistema permite calibração e tara da célula de carga via interface web, comunicação bidirecional e persistência de configurações.
O conjunto forma uma plataforma completa de aquisição e visualização de dados experimentais em tempo real.

---

## ✨ Funcionalidades de Análise e Exportação

| Funcionalidade | Descrição |
| :--- | :--- |
| **Importação de Testes Externos** | Permite importar arquivos de log de empuxo externos (formato *tempo [s] força [N]*) diretamente para o `localStorage`, para análise na UI. |
| **Exportação para OpenRocket (.ENG)** | Exporta a curva de empuxo no formato `.ENG` (Tempo/Força), compatível com simuladores como OpenRocket e RASAero. |
| **Metadados por Sessão** | Metadados do motor (Nome, Diâmetro, Pesos, Fabricante) são salvos individualmente com cada sessão, permitindo a edição e exportação correta do `.ENG`. |
| **Edição de Metadados** | Botão **🛠️ Edit Meta** nas gravações para carregar, alterar e salvar os metadados do motor no `localStorage`. |
| **Cálculo de Impulso** | Cálculo robusto do Impulso Total (N⋅s) por método trapezoidal, incluindo: Impulso Positivo, Impulso Líquido e classificação automática do motor (classes A a O). |
| **Relatórios em PDF** | Geração de relatórios de propulsão via impressão do navegador, incluindo gráficos em alta definição e tabela de dados. |

---

## 🛠️ Melhorias de Usabilidade e Diagnóstico

| Melhoria | Detalhe |
| :--- | :--- |
| **Status de Conexão** | Fundo da página fica vermelho claro e o indicador pulsa em caso de desconexão, com opacidade reduzida do conteúdo para alertar. |
| **Alertas Sonoros** | Feedback audível (beeps) para eventos como conexão/desconexão e problemas de estabilidade. |
| **Diagnóstico de Estabilidade** | Banner de alerta aparece após falhas de estabilização, indicando a necessidade de ajustar a **Tolerância de Estabilidade**. |
| **Filtro Anti-Noising** | Sistema de filtro baseado em desvio padrão (σ) para eliminar ruído da balança. |
| **Gráfico Otimizado** | Correção do layout para garantir a visibilidade dos *labels* do eixo X e melhor performance. |
| **Timestamp Real** | A primeira coluna da tabela de dados agora registra o **Timestamp** real (`DD/MM/AAAA HH:MM:SS`), mantendo o Tempo ESP separado. |
| **Acesso mDNS** | Acesso simplificado ao dispositivo usando `http://gfig.local`. |
| **Atalhos de Teclado** | Atalhos como **`Shift`+`T`** (Tara), **`Shift`+`C`** (Calibrar) e **`P`** (Pausar/Retomar gráfico). |

---

## ⚙️ Estrutura de Arquivos

| Arquivo | Conteúdo Principal |
| :--- | :--- |
| `index.html` | UI (HTML/CSS), entradas de metadados, e estrutura de abas. |
| `script.js` | Lógica da UI, conexão, comandos, metadados (Edição/Salvar) e funções de base. |
| `script_grafico_sessao.js` | Cálculos de Propulsão (Impulso, Classe), lógica de Importação de logs, e exportação `.ENG`. |
| `funcoespdf.js` | Funções para geração de relatórios de análise com gráficos detalhados. |
| `dataWorker.js` | Web Worker para processamento em background, WebSocket e cálculo de EMA/RPS. |

---

## 👥 Suporte

Para dúvidas sobre implementação ou uso:

1.  Verificar o código comentado (principalmente em `script.js` e `script_grafico_sessao.js`).
2.  Contatar a equipe GFIG - Campus Gaspar.

**Versão**: 2.0 (Outubro 2024) | **Licença**: Uso Educacional - Projeto GFIG


Resumo do fluxo geral

ESP (HX711) → envia pacotes binários pela USB/Serial → Servidor Python lê a serial, valida CRC e converte para JSON → WebSocket transmite JSON para clientes (worker/browser) → Worker (dataWorker.js) processa, filtra (EMA, RPS, etc.) e atualiza o gráfico/UI → UI pode enviar comandos (tare, calibrate, set param, salvar sessão) em JSON ao servidor → servidor converte JSON → pacote binário → Serial → ESP. 

main

 

server

 

dataWorker

1) Firmware ESP — leitura e protocolo binário

Principais responsabilidades:

Leitura da célula de carga via HX711 e cálculo da força/peso (fatores de conversão e gravidade persistidos em Config). 

main

Empacotar leituras em pacote DATA com timestamp em millis() e enviar pelo Serial. Implementa PacketData e função sendBinaryFrame(...). O CRC usado é CRC16-CCITT. Formato/packing é #pragma pack(push,1) (valores little-endian usados no parsing do lado Python). 

main

 

main

Estruturas definidas no firmware (tamanhos fixos):

PacketData — 16 bytes (magic, ver, type, t_ms, forca_N (float), status, reserved, crc). 

main

PacketConfig — 64 bytes (payload com conversionFactor, gravity, leiturasEstaveis, tolerancia, etc. + crc). 

main

PacketStatus, CmdTara, CmdCalibrate, CmdGetConfig, CmdSetParam (tamanhos fixos). 

main

Recepção de comandos binários (buffer serial e processBinaryCommand()): o ESP coleta bytes no cmd_buffer e tenta decodificar header/magic antes de processar. Há checagem de magic (0xA1B2) e verificação CRC. 

main

Configuração e persistência: Config struct contém fatores (conversionFactor, gravity, tareOffset, etc.) e é enviada por sendBinaryConfig(...) quando solicitada. 

main

Função CRC: implementação local crc16_ccitt(...) usada tanto em envio quanto em checagem de pacotes. 

main

Observações técnicas (firmware):

Usa float para força (IEEE-754, 4 bytes); cuidado com alinhamento/endianness no host. Código usa packing e CRC para garantir integridade. 

main

Timestamp é millis() (uint32) — facilita recriar série temporal no servidor sem depender de relógio RTC. 

main

2) Gateway / Servidor Python (server.py)

Principais responsabilidades:

Abrir/gerenciar porta serial (configurada por SERIAL_PORT, SERIAL_BAUD) e ler fluxos binários do ESP; desempacotar os pacotes binários e validar CRC (implementação de crc16_ccitt no Python espelha a do ESP). 

server

Valores padrão: SERIAL_BAUD=921600, WS_PORT=81, HTTP_PORT=80, BIND_HOST=0.0.0.0 (via env vars). 

server

Parser de pacotes:

parse_data_packet(data) → valida tamanho (16), unpack com struct.unpack("<HBBIfBxH"), verifica magic, ver, type e CRC; retorna dicionário com tempo (s), forca (float) e status. 

server

parse_config_packet(data) → unpack dos campos de config (tamanho 64), checagem de CRC e mapeamento para JSON. 

server

WebSocket server (asyncio + websockets) que:

Aceita múltiplos clientes, mantém CONNECTED_CLIENTS e faz broadcast com broadcast_json(obj). Adiciona mysql_connected no payload. Usa sanitize_for_json para evitar NaN/Infinity.

Recebe JSON de clientes (UI/worker) e converte comandos JSON → pacotes binários (json_to_binary_command(cmd)), enviando-os para a serial com serial_lock para evitar races. Exemplos de comandos: t (tara), c (calibrate com massa), get_config, set (param). 

server

 

server

HTTP API e servidor estático: servidor HTTP (class APIRequestHandler) que expõe endpoints (e.g., ajustar hora, exportação, download assets). O servidor HTTP roda em thread própria (classe DualStackTCPServer etc.). 

server

Persistência / MySQL:

Conexão MySQL com reconexão/retentativas; funções init_mysql_db() e save_session_to_mysql_db(...) (cria tabelas sessoes e leituras com metadados do motor). Implementa backoff exponencial no bootstrap do DB. 

server

Concurrency & robustez:

Usa serial_lock (threading.Lock) para garantir escritas na serial seguras quando WS handler e thread serial interagem. Websockets são async e usam asyncio.gather para broadcast. Há tratamentos de exceção em parsing e envio.

Observações técnicas (servidor):

O parse usa formatação "<HBBIfBxH" para PacketData (little-endian), portanto o firmware deve enviar no mesmo endian — confirmado pelo packing no firmware. Tenha atenção ao float packing entre C++ e Python (struct com <f OK). 

server

 

main

A taxa serial alta (921600) permite amostragem rápida; teste para garantir que PC/USB-serial não perca frames (buffering e leitura contínua). 

server

3) Worker (dataWorker.js) e UI (index.html + script)

Arquitetura:

A página web cria um Web Worker (dataWorker.js) que abre a conexão WebSocket com o gateway e processa mensagens, isolando trabalho pesado do thread UI. Worker faz buffering de mensagens parciais e "frame-finds" JSONs recebidos (porque o servidor pode mandar vários JSONs por socket).

Worker tenta conectar automaticamente ao ws://<host>:81, faz reconexões e envia get_config assim que conecta. 

dataWorker

Worker converte mensagens recebidas do servidor (ex.: { type: "data", tempo: ..., forca: ..., status: ... }) em mensagens para o thread principal via postMessage, mantendo buffers, EMA, RPS e estatísticas (max, min). Implementa:

EMA (alpha configurável emaAlpha) para suavização; contador de leituras por segundo (RPS) com lógica de atualização. 

dataWorker

Suporta envio de comandos a partir da UI (payloads: t = tara, c = calibrar com massa, set = set param, save_session_to_mysql) — worker serializa em JSON e envia via WebSocket para o servidor.

UI (ApexCharts / controles):

index.html e script.js proporcionam interface: indicadores em tempo real (força atual, EMS, máxima), barra de esforço, seleção de unidade (N, gf, kgf), abas (Gráfico / Tabela / Gravações / Parâmetros), botões para TARA/Calibrar/Exportar/persistir. Usa ApexCharts para grafico em tempo real. 

index

 

main

Funções para exportar sessão como PDF/PNG (render canvas do gráfico), salvar sessões no localStorage e opção de salvar no MySQL via comando WS save_session_to_mysql.

Observações técnicas (worker/UI):

O worker faz parsing robusto de fluxos (monta messageBuffer e procura JSON completo antes de JSON.parse) para lidar com mensagens concatenadas/parciais. Isso evita corrupções e exceções JSON.parse. 

dataWorker

O fluxo de comando é: UI → worker (postMessage) → worker envia JSON p/ WS → servidor converte p/ binário → Serial → ESP. Transparência no código para save_session_to_mysql e comandos get_config, t, c, set. 

dataWorker

4) Formatos, tamanhos e checagens (detalhes que importam)

Magic / Version: MAGIC = 0xA1B2, VERSION = 0x01 — verificados em ambas pontas. 

server

 

main

CRC: CRC16-CCITT usado no envio/recepção. Implementado tanto no firmware quanto no Python com o mesmo polinômio/algoritmo. Imprescindível para detectar pacotes quebrados.

Tamanhos fixos: SIZE_DATA=16, SIZE_CONFIG=64, SIZE_STATUS=14 etc. O servidor rejeita pacotes com tamanho diferente. Isso simplifica parser e permite leitura alinhada de frames. 

server

Packing little-endian: struct.unpack("<...") no Python; firmware envia com #pragma pack(push,1) e estruturas C++ — portanto endianness e packing devem estar coerentes.

5) Confiabilidade e testes recomendados

Sugestões práticas rápidas:

Testes de stress serial: gere tráfego em alta taxa (ex.: 500–1000 Hz) e verifique perda de pacotes, uso CPU no host e backlog da porta serial. Ajuste buffers e taxa de envio do ESP se necessário. (server.py usa serial_lock para escrita e leitura concorrente). 

server

Simulador binário: crie um script Python de "simulação ESP" que envie pacotes binários válidos para a porta serial do host para testar parsing e a UI sem hardware. Útil para debug do CRC, endianness e floats.

Logs & métricas: habilitar logs DEBUG (Python e Worker) e registrar CRC mismatch e contadores de pacotes; já há logs de CRC mismatch no parser. 

server

Timeouts e re-sincronização: se a stream serial perder sincronização (bytes fora de alinhamento), implemente no lado Python um mecanismo para realinhar (procurar 0xB2 0xA1 ou similar) — parte do código já checa magic e tamanho. 

main

Validação cross-check: compare timestamp t_ms do pacote com time.time() do servidor para medir latência; já existe lógica de ajustar serverTimeOffset no UI. 

main

6) Arquivo Docker / Deploy (observações)

Você incluiu Dockerfile e docker-compose.yml no upload — o servidor Python já suporta configuração por variáveis de ambiente (SERIAL_PORT, SERIAL_BAUD, MYSQL_*, HTTP_PORT, WS_PORT, BIND_HOST). Ao empacotar em container, mapear dispositivo USB (/dev/ttyUSB0) para o container e garantir permissões (udev) é essencial; configurar devices: no docker-compose e restart: unless-stopped. 

server

7) Principais arquivos — onde olhar no código

Firmware (ESP): main.cpp — contém definição do protocolo (magic, structs, CRC), funções sendBinaryFrame, sendBinaryConfig, processBinaryCommand. Veja estruturas e CRC.

Gateway/Servidor: server.py — parsing, websocket, HTTP API, MySQL, json_to_binary_command e broadcast_json. Veja parse_data_packet() e parse_config_packet() e a inicialização/env vars.

Worker: dataWorker.js — conexão WS, buffer de mensagens, reagrupamento de JSONs, lógica de envio de comandos e cálculo de RPS/EMA.

UI + gráficos: index.html, script.js, script_grafico_sessao.js — interface, exportação PDF/PNG, controles e integração com o worker.