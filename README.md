# 🚀 GFIG - Balança de Teste Estático (Versão 2.0)

**Projeto de Foguetes de Modelismo Experimental -Instituto Federal de Santa Campus Gaspar - IFSC**
**Projto de controle e autmoção** 

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

-# 🧭 Projeto: Balança Digital para Testes Estáticos de Motores de Minifoguete

## 📖 Sumário

1. [Visão Geral](#-visão-geral)  
2. [Arquitetura do Sistema](#-arquitetura-do-sistema)  
3. [Camadas e Comunicação](#-camadas-e-comunicação)  
4. [Módulos e Funções](#-módulos-e-funções)  
5. [Fluxo de Dados](#-fluxo-de-dados)  
6. [Front-end (Interface Web)](#-front-end-interface-web)  
7. [Configuração com Docker](#-configuração-com-docker)  
8. [Extensões Futuras e Assistente de Calibração](#-extensões-futuras-e-assistente-de-calibração)  
9. [Licença e Créditos](#-licença-e-créditos)

---

## 🚀 Visão Geral

A aplicação foi desenvolvida para **realizar medições estáticas de empuxo** em motores de minifoguetes experimentais.  
Ela se baseia em uma arquitetura **multicamadas**, onde:

- o **ESP8266/ESP32** lê uma célula de carga via módulo **HX711** e transmite os dados brutos por **protocolo binário via USB**;  
- o **servidor Python** atua como **ponte**, decodificando pacotes, convertendo em força (N), filtrando ruído e retransmitindo via **WebSocket** para navegadores conectados;  
- o **front-end web** exibe gráficos dinâmicos, controla calibração, tara, grava sessões e gera relatórios PDF.  

Tudo é containerizado com **Docker** para simplificar a implantação.

---

## 🧩 Arquitetura do Sistema

```
+---------------------+         +-----------------------+          +----------------------+
| ESP32 + HX711       |  USB    | Servidor Python       |  WS/HTTP | Aplicação Web (UI)   |
|---------------------|  --->   |-----------------------|  --->    |----------------------|
| Leitura ADC HX711   |         | Decodifica protocolo  |          | Chartist.js (gráficos)|
| Cálculo e tara      |         | Filtra e normaliza    |          | dataWorker.js        |
| Envia binário       |         | Expõe WebSocket (WS)  |          | script.js / funcoespdf|
+---------------------+         +-----------------------+          +----------------------+
```

---

## 🔌 Camadas e Comunicação

| Camada | Protocolo | Direção | Função Principal |
|--------|------------|----------|------------------|
| **ESP** | USB Serial (binário) | → | Transmite amostras (ADC + status) |
| **Servidor Python** | WebSocket (JSON) | ↔ | Faz bridge entre hardware e web clients |
| **Web Client** | WS + HTTP | ↔ | Exibe dados, envia comandos (tare, calibrar, etc.) |

### 📡 Esquema de Comunicação

```
[ESP] --USB binário--> [Python Server] --WebSocket--> [Browser]
                                  ^                             |
                                  |                             v
                              Comandos (tare, calibrar, get/set config)
```

Cada mensagem segue um **protocolo leve**, com campos de cabeçalho e payload definidos (ex: tipo, tamanho, leitura em Newtons).

---

## ⚙️ Módulos e Funções

### 🧠 Firmware (ESP32)

**Função principal:** aquisição e transmissão de leituras.

| Função | Descrição |
|--------|------------|
| `readHX711()` | Lê a célula de carga via ADC. |
| `tare()` | Calcula e aplica offset de tara. |
| `sendPacket()` | Empacota leitura em binário (float32, CRC) e envia pela USB. |
| `receiveCommand()` | Recebe comandos vindos do servidor (tare, calibrate, get_config, set_config). |

---

### 🐍 Servidor Python (`server.py`)

Responsável pela ponte entre hardware e clientes Web.

#### Principais Funções:

| Função | Descrição |
|--------|------------|
| `read_serial()` | Lê pacotes binários da porta USB (com `pyserial`). |
| `parse_packet()` | Decodifica bytes recebidos → valor físico (força, tempo, temperatura). |
| `broadcast_ws()` | Envia as leituras para todos os clientes WebSocket conectados. |
| `handle_ws_command()` | Recebe comandos via WS (tare, calibrar, config) e envia ao ESP. |
| `serve_static_files()` | Entrega `index.html`, JS e CSS via HTTP. |

**Dependências:**  
`asyncio`, `websockets`, `pyserial`, `json`, `struct`.

#### Exemplo de fluxo:
```python
while True:
    raw = ser.read(12)
    data = parse_packet(raw)
    await broadcast_ws(json.dumps(data))
```

---

### 🌐 Front-end (Web Client)

A camada de interface é composta por HTML, JavaScript e CSS localmente servidos pelo servidor Python.

#### Arquivos principais:

| Arquivo | Função |
|----------|--------|
| `index.html` | Estrutura base da interface e abas. |
| `script.js` | Conecta via WebSocket, atualiza a UI, envia comandos. |
| `dataWorker.js` | Web Worker que recebe fluxos contínuos e gerencia buffer circular. |
| `script_grafico_sessao.js` | Gera e atualiza o gráfico Chartist.js com os dados. |
| `funcoespdf.js` | Gera relatórios em PDF das sessões de teste. |
| `chartist.min.js` | Biblioteca de gráficos (linha, tempo, empuxo). |

#### Principais Funções (front-end)

| Função | Arquivo | Descrição |
|--------|----------|-----------|
| `connectWebSocket()` | `script.js` | Abre conexão WS com o servidor. |
| `handleMessage(event)` | `script.js` | Recebe pacotes JSON e atualiza dados e gráfico. |
| `tare()` | `script.js` | Envia comando `'t'` para zerar célula de carga. |
| `calibrate()` | `script.js` | Envia comando `'c'` com massa conhecida. |
| `savePDF()` | `funcoespdf.js` | Gera PDF com dados da sessão. |
| `drawChart()` | `script_grafico_sessao.js` | Atualiza gráfico Chartist em tempo real. |

# 🚀 Balança Digital GFIG - Documentação Técnica Completa

## 📋 Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Protocolo de Comunicação Binária](#protocolo-de-comunicação-binária)
3. [Camada 1: Firmware ESP32](#camada-1-firmware-esp32)
4. [Camada 2: Servidor Python](#camada-2-servidor-python)
5. [Camada 3: Interface Web](#camada-3-interface-web)
6. [Comunicação USB/Serial](#comunicação-usbserial)
7. [Comunicação WebSocket](#comunicação-websocket)
8. [Funcionalidades Detalhadas](#funcionalidades-detalhadas)
9. [Fluxos de Dados](#fluxos-de-dados)
10. [Infraestrutura Docker](#infraestrutura-docker)
11. [Banco de Dados MySQL](#banco-de-dados-mysql)
12. [Algoritmos e Filtros](#algoritmos-e-filtros)

---

## 🏗️ Visão Geral da Arquitetura

A aplicação é composta por **três camadas integradas** que trabalham em conjunto para realizar testes estáticos de motores de minifoguetes experimentais:

```
┌─────────────────────────────────────────────────────────────────┐
│                      INTERFACE WEB (Cliente)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   HTML/CSS   │  │  JavaScript  │  │   Web Worker         │  │
│  │  Interface   │  │   script.js  │  │  dataWorker.js       │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                            ▲                                     │
│                            │ WebSocket (JSON)                    │
│                            │ ws://host:81                        │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                            ▼                                     │
│              SERVIDOR PYTHON (Intermediário)                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  server.py - Gateway Serial ↔ WebSocket                  │  │
│  │  • Conversão Binário → JSON                               │  │
│  │  • Conversão JSON → Binário                               │  │
│  │  • Broadcast para múltiplos clientes                      │  │
│  │  • Servidor HTTP (porta 80)                               │  │
│  │  • Servidor WebSocket (porta 81)                          │  │
│  │  • Integração MySQL (persistência)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▲                                     │
│                            │ USB/Serial (Binário)                │
│                            │ 921600 baud                         │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                            ▼                                     │
│                  FIRMWARE ESP32 (Hardware)                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  main.cpp - Controle da Célula de Carga                  │  │
│  │  • Leitura HX711 (ADC 24-bit)                             │  │
│  │  • Protocolo binário proprietário                         │  │
│  │  • Display OLED SSD1306                                   │  │
│  │  • Calibração e Tara                                      │  │
│  │  • Filtros de estabilização                               │  │
│  │  • EEPROM para persistência                               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                            ▲                                     │
│                            │ Sinal analógico                     │
│                     [Célula de Carga]                            │
└─────────────────────────────────────────────────────────────────┘
```

### Características Principais

- **Aquisição de alta velocidade**: Até 80 leituras/segundo da célula de carga
- **Comunicação otimizada**: Protocolo binário com CRC16-CCITT para integridade
- **Processamento distribuído**: Web Worker processa dados sem bloquear UI
- **Tempo real**: WebSocket para latência mínima (<10ms)
- **Containerização**: Docker Compose para deploy consistente
- **Persistência**: MySQL para armazenamento de sessões e metadados

---

## 📡 Protocolo de Comunicação Binária

O sistema utiliza um **protocolo binário proprietário** para comunicação entre ESP32 e servidor Python, otimizado para:
- Baixa latência
- Alta taxa de transmissão
- Integridade dos dados (CRC)
- Eficiência de banda

### Estrutura Base dos Pacotes

Todos os pacotes seguem um formato comum:

```
┌──────────┬─────────┬─────────┬─────────┬──────────┬─────────┐
│  MAGIC   │ VERSION │  TYPE   │ PAYLOAD │   ...    │   CRC   │
│ (2 bytes)│ (1 byte)│ (1 byte)│ (N bytes)│          │(2 bytes)│
└──────────┴─────────┴─────────┴─────────┴──────────┴─────────┘
```

#### Constantes do Protocolo

```cpp
MAGIC_NUMBER:  0xA1B2  // Identificador do protocolo
VERSION:       0x01    // Versão atual
```

### Tipos de Pacotes (ESP → Host)

#### 1. Pacote DATA (0x01) - Leitura de Força
**Tamanho: 16 bytes**

```cpp
struct PacketData {
  uint16_t magic;      // 0xA1B2
  uint8_t  ver;        // 0x01
  uint8_t  type;       // 0x01
  uint32_t t_ms;       // Timestamp millis()
  float    forca_N;    // Força em Newtons
  uint8_t  status;     // Estado: 0=Pesando, 1=Tarar, 2=Calibrar, 3=Pronta
  uint8_t  reserved;   // Padding
  uint16_t crc;        // CRC16-CCITT
};
```

**Exemplo de transmissão:**
```
B2 A1 01 01 | D0 07 00 00 | 9A 99 41 40 | 00 00 | 4B 2F
[MAGIC VER TYPE] [TIMESTAMP] [FORCE=12.1N] [STATUS] [CRC]
```

**Taxa de envio:** 80 Hz (uma leitura a cada 12.5ms)

#### 2. Pacote CONFIG (0x02) - Configurações
**Tamanho: 64 bytes**

```cpp
struct PacketConfig {
  uint16_t magic;                      // 0xA1B2
  uint8_t  ver;                        // 0x01
  uint8_t  type;                       // 0x02
  
  // Parâmetros (58 bytes)
  float    conversionFactor;           // Fator HX711→gramas
  float    gravity;                    // Aceleração (9.80665 m/s²)
  uint16_t leiturasEstaveis;           // Leituras necessárias para estabilidade
  float    toleranciaEstabilidade;     // Tolerância em gramas
  uint16_t numAmostrasMedia;           // Amostras para média móvel
  uint16_t numAmostrasCalibracao;      // Amostras durante calibração
  uint8_t  usarMediaMovel;             // Flag: média móvel ativa
  uint8_t  usarEMA;                    // Flag: EMA ativa
  uint16_t timeoutCalibracao;          // Timeout em segundos
  int32_t  tareOffset;                 // Offset de tara (signed)
  float    capacidadeMaximaGramas;     // Capacidade máxima da célula
  float    percentualAcuracia;         // Acurácia (ex: 0.05 = 5%)
  uint8_t  mode;                       // Modo de operação
  uint8_t  reserved[23];               // Reservado para expansão
  
  uint16_t crc;                        // CRC16-CCITT
};
```

**Quando é enviado:**
- Ao receber comando `get_config`
- Após alteração de parâmetros
- Durante inicialização (bootup)

#### 3. Pacote STATUS (0x03) - Status/Eventos
**Tamanho: 14 bytes**

```cpp
struct PacketStatus {
  uint16_t magic;          // 0xA1B2
  uint8_t  ver;            // 0x01
  uint8_t  type;           // 0x03
  uint8_t  status_type;    // 0=info, 1=success, 2=warning, 3=error
  uint8_t  code;           // Código específico
  uint16_t value;          // Valor adicional (opcional)
  uint32_t timestamp;      // millis()
  uint16_t crc;            // CRC16-CCITT
};
```

**Códigos de Status:**
```cpp
STATUS_INFO:    0x00  // Informação
STATUS_SUCCESS: 0x01  // Sucesso
STATUS_WARNING: 0x02  // Aviso
STATUS_ERROR:   0x03  // Erro
```

**Códigos de Mensagem:**
```cpp
MSG_TARA_DONE:     0x10  // Tara concluída
MSG_CALIB_DONE:    0x11  // Calibração concluída
MSG_CALIB_FAILED:  0x12  // Calibração falhou
MSG_CONFIG_UPDATE: 0x20  // Configuração atualizada
MSG_ERROR_GENERIC: 0xF0  // Erro genérico
```

### Comandos (Host → ESP)

#### 1. CMD_TARA (0x10) - Comando de Tara
**Tamanho: 8 bytes**

```cpp
struct CmdTara {
  uint16_t magic;      // 0xA1B2
  uint8_t  ver;        // 0x01
  uint8_t  type;       // 0x10
  uint16_t reserved;   // 0x0000
  uint16_t crc;        // CRC16-CCITT
};
```

**Ação no ESP:**
1. Aguarda estabilidade (10 leituras consecutivas dentro da tolerância)
2. Executa `loadcell.tare(1)`
3. Salva offset na EEPROM
4. Envia `PacketStatus` com código `MSG_TARA_DONE`

#### 2. CMD_CALIBRATE (0x11) - Comando de Calibração
**Tamanho: 10 bytes**

```cpp
struct CmdCalibrate {
  uint16_t magic;      // 0xA1B2
  uint8_t  ver;        // 0x01
  uint8_t  type;       // 0x11
  float    massa_g;    // Massa conhecida em gramas
  uint16_t crc;        // CRC16-CCITT
};
```

**Ação no ESP:**
1. Valida massa (0 < massa < 100000)
2. Aguarda estabilidade
3. Lê valor raw: `leituraRaw = loadcell.read_average(N)`
4. Calcula fator: `conversionFactor = (leituraRaw - tareOffset) / massa_g`
5. Salva na EEPROM
6. Envia status de sucesso/falha

#### 3. CMD_GET_CONFIG (0x12) - Solicitar Configurações
**Tamanho: 8 bytes**

```cpp
struct CmdGetConfig {
  uint16_t magic;      // 0xA1B2
  uint8_t  ver;        // 0x01
  uint8_t  type;       // 0x12
  uint16_t reserved;   // 0x0000
  uint16_t crc;        // CRC16-CCITT
};
```

**Resposta:** ESP envia imediatamente um `PacketConfig` completo.

#### 4. CMD_SET_PARAM (0x13) - Definir Parâmetro
**Tamanho: 18 bytes**

```cpp
struct CmdSetParam {
  uint16_t magic;        // 0xA1B2
  uint8_t  ver;          // 0x01
  uint8_t  type;         // 0x13
  uint8_t  param_id;     // ID do parâmetro (ver tabela)
  uint8_t  reserved[3];  // Padding
  float    value_f;      // Valor float (se aplicável)
  uint32_t value_i;      // Valor inteiro (se aplicável)
  uint16_t crc;          // CRC16-CCITT
};
```

**IDs de Parâmetros:**

| ID   | Nome                      | Tipo  | Descrição                           |
|------|---------------------------|-------|-------------------------------------|
| 0x01 | PARAM_GRAVITY             | float | Aceleração da gravidade (m/s²)      |
| 0x02 | PARAM_CONV_FACTOR         | float | Fator de conversão HX711            |
| 0x03 | PARAM_LEIT_ESTAV          | int   | Leituras para estabilidade          |
| 0x04 | PARAM_TOLERANCIA          | float | Tolerância de estabilidade (g)      |
| 0x05 | PARAM_MODE                | int   | Modo de operação                    |
| 0x06 | PARAM_USE_EMA             | int   | Ativar/desativar EMA                |
| 0x07 | PARAM_NUM_AMOSTRAS        | int   | Número de amostras para média       |
| 0x08 | PARAM_TARE_OFFSET         | int   | Offset de tara (signed)             |
| 0x09 | PARAM_TIMEOUT_CAL         | int   | Timeout calibração (segundos)       |
| 0x0A | PARAM_CAPACIDADE          | float | Capacidade máxima (gramas)          |
| 0x0B | PARAM_ACURACIA            | float | Percentual de acurácia (0.0-1.0)    |

### Verificação de Integridade: CRC16-CCITT

**Algoritmo:**

```cpp
uint16_t crc16_ccitt(const uint8_t* data, size_t len) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < len; ++i) {
    crc ^= (uint16_t)data[i] << 8;
    for (uint8_t b = 0; b < 8; ++b) {
      if (crc & 0x8000) 
        crc = (uint16_t)((crc << 1) ^ 0x1021);
      else              
        crc = (uint16_t)(crc << 1);
    }
  }
  return crc;
}
```

**Características:**
- Polinômio: 0x1021
- Inicial: 0xFFFF
- Detecta 99.998% dos erros
- Overhead: 2 bytes por pacote

---

## 🔧 Camada 1: Firmware ESP32

### Hardware Utilizado

- **Microcontrolador:** ESP32-WROOM-32
- **ADC:** HX711 (24-bit, differential)
- **Display:** OLED SSD1306 (128×64, I²C)
- **Célula de Carga:** 5kg (strain gauge)
- **Interface:** USB Serial (CP2102/CH340)

### Pinos ESP32

```cpp
#define OLED_SDA      14  // I²C Data
#define OLED_SCL      12  // I²C Clock
#define HX711_DATA    D7  // GPIO13
#define HX711_CLOCK   D8  // GPIO15
```

### Loop Principal

```cpp
void loop() {
  unsigned long now = millis();
  
  // 1. Processar comandos binários
  processBinaryCommand();
  
  // 2. Leitura da célula (80 Hz)
  if (now - lastReadTime >= 12) {  // ~80 Hz
    if (loadcell.is_ready()) {
      long rawValue = loadcell.read();
      pesoAtual_g = (rawValue - config.tareOffset) / config.conversionFactor;
      float forca_N = pesoAtual_g * config.gravity / 1000.0;
      
      // Enviar pacote DATA
      uint8_t status_code = status_code_from_str(balancaStatusBuffer);
      sendBinaryFrame(status_code, forca_N);
      
      lastReadTime = now;
    }
  }
  
  // 3. Atualizar display OLED (2 Hz)
  if (now - lastDisplayUpdateTime >= 500) {
    atualizarDisplay(balancaStatusBuffer, pesoAtual_g);
    lastDisplayUpdateTime = now;
  }
}
```

### Processamento de Comandos

O ESP32 mantém um **buffer circular** para comandos binários:

```cpp
static uint8_t cmd_buffer[32];
static size_t cmd_buffer_pos = 0;

bool processBinaryCommand() {
  // 1. Preenche buffer
  while (Serial.available() && cmd_buffer_pos < sizeof(cmd_buffer)) {
    cmd_buffer[cmd_buffer_pos++] = Serial.read();
  }
  
  // 2. Busca MAGIC
  if (cmd_buffer_pos < 4) return false;
  uint16_t magic = cmd_buffer[0] | (cmd_buffer[1] << 8);
  
  if (magic != MAGIC_BIN_PROTO) {
    // Descarta primeiro byte e continua buscando
    memmove(cmd_buffer, cmd_buffer + 1, cmd_buffer_pos - 1);
    cmd_buffer_pos--;
    return false;
  }
  
  // 3. Valida versão e tipo
  // 4. Aguarda comando completo
  // 5. Verifica CRC
  // 6. Executa ação
}
```

### Algoritmo de Estabilização

Para operações críticas (tara, calibração), o ESP aguarda estabilidade:

```cpp
bool aguardarEstabilidade(const char* proposito) {
  unsigned long start = millis();
  int leiturasConsecutivas = 0;
  float leituraAnterior = 0;
  
  while (millis() - start < config.timeoutCalibracao) {
    if (!loadcell.is_ready()) continue;
    
    float leituraAtual = loadcell.get_units(config.numAmostrasMedia);
    float diferenca = abs(leituraAtual - leituraAnterior);
    
    if (diferenca <= config.toleranciaEstabilidade) {
      leiturasConsecutivas++;
      if (leiturasConsecutivas >= config.leiturasEstaveis) {
        return true;  // Estável!
      }
    } else {
      leiturasConsecutivas = 0;  // Reset
    }
    
    leituraAnterior = leituraAtual;
    delay(10);
  }
  
  return false;  // Timeout
}
```

**Parâmetros típicos:**
- `leiturasEstaveis`: 10 leituras
- `toleranciaEstabilidade`: 100g (0.98N)
- `timeoutCalibracao`: 20 segundos

### Display OLED

Mostra informações em tempo real:

```cpp
void atualizarDisplay(const char* status, float peso_g) {
  display.clearDisplay();
  
  // Linha 1: Status
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.print("Status: ");
  display.println(status);
  
  // Linha 2: Peso em gramas
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.print(peso_g, 1);
  display.println(" g");
  
  // Linha 3: Força em Newtons
  display.setTextSize(1);
  display.setCursor(0, 45);
  float forca_N = peso_g * config.gravity / 1000.0;
  display.print("Forca: ");
  display.print(forca_N, 2);
  display.println(" N");
  
  display.display();
}
```

---

## 🐍 Camada 2: Servidor Python

O servidor Python (`server.py`) atua como **gateway bidirecional** entre o protocolo binário do ESP32 e o protocolo JSON usado pelos clientes WebSocket.

### Arquitetura Multi-thread

```python
Main Thread (asyncio)
├── HTTP Server (porta 80) → Serve arquivos estáticos
├── WebSocket Server (porta 81) → Conexões clientes
└── Serial Reader Thread → Lê continuamente da porta serial

Serial Reader Thread
├── Lê buffer serial (256 bytes/vez)
├── Busca magic number (0xA1B2)
├── Parseia pacotes binários
└── Broadcast JSON via asyncio.run_coroutine_threadsafe()
```

### Configuração Serial

```python
SERIAL_BAUD = 921600        # Alta taxa para 80 Hz
SERIAL_PORT = "/dev/ttyUSB0"  # Ajustável via ambiente
timeout = 1.0               # Timeout de leitura
```

### Parser de Pacotes

#### Pacote DATA

```python
def parse_data_packet(data: bytes) -> Optional[Dict[str, Any]]:
    if len(data) != SIZE_DATA: return None
    
    try:
        # Struct: "<HBBIfBBH"
        fields = struct.unpack("<HBBIfBBH", data)
        magic, ver, pkt_type, t_ms, forca_N, status, _, crc_rx = fields
        
        # Validações
        if magic != MAGIC or ver != VERSION or pkt_type != TYPE_DATA:
            return None
        
        # Verificar CRC
        if crc16_ccitt(data[:-2]) != crc_rx:
            logging.warning("CRC mismatch in DATA packet")
            return None
        
        # Converter para JSON
        return {
            "type": "data",
            "tempo": t_ms / 1000.0,  # Converte ms → segundos
            "forca": forca_N,
            "status": status_map.get(status, "unknown"),
            "timestamp": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat()
        }
    except struct.error:
        return None
```

**JSON resultante:**
```json
{
  "type": "data",
  "tempo": 123.456,
  "forca": 12.34,
  "status": "Pesando",
  "timestamp": "2025-11-03T14:30:45.123-03:00"
}
```

#### Pacote CONFIG

```python
def parse_config_packet(data: bytes) -> Optional[Dict[str, Any]]:
    if len(data) != SIZE_CONFIG: return None
    
    try:
        # Struct: "<HBBHH23xH"
        fields = struct.unpack(
            "<HBB"      # magic, ver, type
            "ff"        # conversionFactor, gravity
            "Hf"        # leiturasEstaveis, toleranciaEstabilidade
            "HH"        # numAmostrasMedia, numAmostrasCalibracao
            "BB"        # usarMediaMovel, usarEMA
            "H"         # timeoutCalibracao
            "i"         # tareOffset (signed)
            "ff"        # capacidadeMaximaGramas, percentualAcuracia
            "B23x"      # mode, reserved
            "H",        # crc
            data
        )
        
        # Validações e CRC
        # ...
        
        return {
            "type": "config",
            "conversionFactor": fields[3],
            "gravity": fields[4],
            "leiturasEstaveis": fields[5],
            # ... todos os campos
        }
    except struct.error:
        return None
```

### Conversor JSON → Binário

```python
def json_to_binary_command(cmd: Dict[str, Any]) -> Optional[bytes]:
    cmd_type = cmd.get("cmd", "").lower()
    
    if cmd_type in ("t", "tara"):
        # Comando TARA
        data = struct.pack("<HBBH", MAGIC, VERSION, CMD_TARA, 0)
        crc = crc16_ccitt(data)
        return data + struct.pack("<H", crc)
    
    elif cmd_type in ("c", "calibrate"):
        # Comando CALIBRATE
        massa_g = float(cmd.get("massa_g", 0))
        if massa_g <= 0: return None
        
        data = struct.pack("<HBBf", MAGIC, VERSION, CMD_CALIBRATE, massa_g)
        crc = crc16_ccitt(data)
        return data + struct.pack("<H", crc)
    
    elif cmd_type == "set_param":
        # Comando SET_PARAM
        param_map = {
            "gravity": (0x01, "f"),
            "conversionFactor": (0x02, "f"),
            "mode": (0x05, "I"),
            # ... outros parâmetros
        }
        
        param_name = cmd.get("param", "")
        if param_name not in param_map: return None
        
        param_id, value_type = param_map[param_name]
        value = cmd.get("value", 0)
        
        value_f = float(value) if value_type == "f" else 0.0
        value_i = int(value) if value_type in ("I", "i") else 0
        
        data = struct.pack(
            "<HBBB3xfI",
            MAGIC, VERSION, CMD_SET_PARAM, param_id,
            value_f, value_i
        )
        crc = crc16_ccitt(data)
        return data + struct.pack("<H", crc)
    
    return None
```

### Thread de Leitura Serial

```python
def serial_reader(loop: asyncio.AbstractEventLoop):
    global serial_connection
    
    while True:
        port = find_serial_port()
        if not port:
            time.sleep(3)
            continue
        
        try:
            serial_connection = serial.Serial(port, SERIAL_BAUD, timeout=1.0)
            buf = bytearray()
            invalid_packet_count = 0
            
            while True:
                # Lê em chunks grandes para eficiência
                chunk = serial_connection.read(256)
                if not chunk: continue
                
                buf.extend(chunk)
                
                # Processa buffer
                while len(buf) >= 8:
                    # Busca magic number
                    magic_idx = buf.find(b'\xB2\xA1')  # Little-endian
                    
                    if magic_idx == -1:
                        # Limpa buffer se muito grande
                        if len(buf) > 256:
                            buf = buf[-256:]
                        break
                    
                    # Remove dados antes do magic
                    if magic_idx > 0:
                        del buf[:magic_idx]
                    
                    # Determina tamanho esperado
                    if len(buf) < 4: break
                    
                    pkt_type = buf[3]
                    size_map = {
                        TYPE_DATA: SIZE_DATA,      # 16 bytes
                        TYPE_CONFIG: SIZE_CONFIG,  # 64 bytes
                        TYPE_STATUS: SIZE_STATUS   # 14 bytes
                    }
                    
                    expected_size = size_map.get(pkt_type)
                    if not expected_size:
                        del buf[0]  # Tipo inválido
                        continue
                    
                    # Aguarda pacote completo
                    if len(buf) < expected_size:
                        break
                    
                    # Extrai e parseia
                    packet = bytes(buf[:expected_size])
                    del buf[:expected_size]
                    
                    parsers = {
                        TYPE_DATA: parse_data_packet,
                        TYPE_CONFIG: parse_config_packet,
                        TYPE_STATUS: parse_status_packet
                    }
                    
                    json_obj = parsers.get(pkt_type)(packet)
                    
                    if json_obj:
                        # Envia para clientes WebSocket
                        asyncio.run_coroutine_threadsafe(
                            broadcast_json(json_obj),
                            loop
                        )
                        invalid_packet_count = 0
                    else:
                        invalid_packet_count += 1
                        
                        # Proteção contra dados corrompidos
                        if invalid_packet_count > 10:
                            logging.warning("Muitos pacotes inválidos. Resincronizando.")
                            buf.clear()
                            invalid_packet_count = 0
                            
        except Exception as e:
            logging.error(f"Erro de leitura serial: {e}")
        finally:
            if serial_connection:
                serial_connection.close()
            serial_connection = None
            time.sleep(1)  # Aguarda antes de reconectar
```

### Servidor WebSocket

```python
async def ws_handler(websocket, path):
    CONNECTED_CLIENTS.add(websocket)
    remote = websocket.remote_address
    logging.info(f"[WS] Cliente conectado: {remote}")
    
    try:
        # Envia configuração inicial
        await asyncio.sleep(0.1)
        if serial_connection:
            cmd = json_to_binary_command({"cmd": "get_config"})
            if cmd:
                serial_connection.write(cmd)
        
        # Loop de recebimento
        async for message in websocket:
            try:
                cmd = json.loads(message)
                logging.info(f"[WS] Comando recebido de {remote}: {cmd}")
                
                # Comandos especiais (MySQL)
                if cmd.get("cmd") == "save_session_to_mysql":
                    await handle_save_session(cmd, websocket)
                    continue
                
                # Comandos para o ESP32
                binary_cmd = json_to_binary_command(cmd)
                if binary_cmd and serial_connection:
                    with serial_lock:
                        serial_connection.write(binary_cmd)
                    logging.info(f"[WS] Comando binário enviado ao ESP32")
                else:
                    await websocket.send(json.dumps({
                        "type": "error",
                        "message": "Comando inválido ou serial desconectado"
                    }))
                    
            except json.JSONDecodeError as e:
                logging.error(f"[WS] JSON inválido de {remote}: {e}")
                
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"[WS] Cliente desconectado: {remote}")
    finally:
        CONNECTED_CLIENTS.discard(websocket)


async def broadcast_json(json_obj: Dict[str, Any]):
    """Envia JSON para todos os clientes conectados"""
    if not CONNECTED_CLIENTS:
        return
    
    # Sanitiza valores inválidos (NaN, Infinity)
    sanitized = sanitize_for_json(json_obj)
    message = json.dumps(sanitized)
    
    # Broadcast assíncrono
    await asyncio.gather(
        *[client.send(message) for client in CONNECTED_CLIENTS],
        return_exceptions=True
    )
```

### Integração MySQL

```python
def init_mysql_db():
    """Inicializa banco de dados e cria tabelas"""
    
    # Conecta como root para criar database
    root_conn = pymysql.connect(
        host=MYSQL_HOST,
        user="root",
        password=MYSQL_ROOT_PASSWORD
    )
    
    with root_conn.cursor() as cursor:
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}`")
        cursor.execute(f"GRANT ALL PRIVILEGES ON `{MYSQL_DB}`.* TO '{MYSQL_USER}'@'%'")
        cursor.execute("FLUSH PRIVILEGES")
    
    root_conn.close()
    
    # Conecta como user para criar tabelas
    conn = connect_to_mysql()
    
    with conn.cursor() as cursor:
        # Tabela de Sessões
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessoes (
                id BIGINT PRIMARY KEY,
                nome VARCHAR(255) NOT NULL,
                data_inicio DATETIME NOT NULL,
                data_fim DATETIME,
                data_modificacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                motor_name VARCHAR(255),
                motor_diameter FLOAT,
                motor_length FLOAT,
                motor_delay FLOAT,
                motor_propweight FLOAT,
                motor_totalweight FLOAT,
                motor_manufacturer VARCHAR(255),
                motor_description TEXT,
                motor_observations TEXT
            )
        """)
        
        # Tabela de Leituras
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leituras (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                sessao_id BIGINT NOT NULL,
                tempo DOUBLE NOT NULL,
                forca DOUBLE NOT NULL,
                FOREIGN KEY (sessao_id) REFERENCES sessoes(id) ON DELETE CASCADE,
                INDEX idx_sessao (sessao_id),
                INDEX idx_tempo (tempo)
            )
        """)
    
    conn.commit()


async def handle_save_session(cmd: Dict, websocket):
    """Salva sessão no MySQL"""
    session_data = cmd.get("payload", {})
    
    conn = connect_to_mysql()
    if not conn:
        await websocket.send(json.dumps({
            "type": "error",
            "message": "MySQL desconectado"
        }))
        return
    
    try:
        with conn.cursor() as cursor:
            # Insere sessão
            cursor.execute("""
                INSERT INTO sessoes 
                (id, nome, data_inicio, data_fim, motor_name, motor_diameter, ...)
                VALUES (%s, %s, %s, %s, %s, %s, ...)
            """, (
                session_data["id"],
                session_data["nome"],
                # ... outros campos
            ))
            
            # Insere leituras em batch
            leituras = session_data.get("leituras", [])
            if leituras:
                cursor.executemany("""
                    INSERT INTO leituras (sessao_id, tempo, forca)
                    VALUES (%s, %s, %s)
                """, [
                    (session_data["id"], l["tempo"], l["forca"])
                    for l in leituras
                ])
        
        conn.commit()
        
        await websocket.send(json.dumps({
            "type": "success",
            "message": f"Sessão '{session_data['nome']}' salva com sucesso!"
        }))
        
    except Exception as e:
        logging.error(f"Erro ao salvar sessão: {e}")
        await websocket.send(json.dumps({
            "type": "error",
            "message": f"Erro ao salvar: {e}"
        }))
```

---

## 🌐 Camada 3: Interface Web

### Arquitetura Cliente

A interface web utiliza uma **arquitetura baseada em Web Worker** para processar dados sem bloquear a thread principal (UI):

```
Main Thread (UI)
├── index.html → Estrutura da página
├── script.js → Lógica de UI e gráficos
└── Comunica com Worker via postMessage()

Web Worker Thread (dataWorker.js)
├── Gerencia conexão WebSocket
├── Buffer de dados recebidos
├── Cálculos (EMA, RPS, etc)
└── Envia dados processados para UI
```

### Web Worker: dataWorker.js

#### Conexão WebSocket

```javascript
let socket;
let wsURL = '';  // URL configurável

function connectWebSocket() {
    // Previne múltiplas conexões
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        console.log(`[Worker] Socket já existe. Estado: ${socket.readyState}`);
        return;
    }
    
    let finalWsURL = wsURL || `ws://${location.hostname}:81`;
    
    console.log(`[Worker] Conectando a: ${finalWsURL}`);
    socket = new WebSocket(finalWsURL);
    
    socket.onopen = () => {
        console.log('[Worker] WebSocket CONECTADO!');
        self.postMessage({ 
            type: 'status', 
            status: 'connected', 
            message: 'Conectado ao servidor' 
        });
        
        // Solicita configuração após 100ms
        setTimeout(() => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ cmd: 'get_config' }));
                console.log('[Worker] get_config solicitado');
            }
        }, 100);
    };
    
    socket.onclose = (event) => {
        console.log(`[Worker] WebSocket FECHADO. Code: ${event.code}`);
        self.postMessage({ 
            type: 'status', 
            status: 'disconnected', 
            message: 'Desconectado. Reconectando...' 
        });
        socket = null;
    };
    
    socket.onerror = (error) => {
        console.error('[Worker] Erro WebSocket:', error);
        self.postMessage({ 
            type: 'status', 
            status: 'error', 
            message: 'Erro na conexão' 
        });
    };
    
    socket.onmessage = (event) => {
        // Processa mensagens (ver próxima seção)
    };
}

// Reconexão automática a cada 1 segundo
setInterval(() => {
    if (socket == null || socket.readyState === WebSocket.CLOSED) {
        console.log("[Worker] Tentando reconectar...");
        connectWebSocket();
    }
}, 1000);
```

#### Processamento de Mensagens

```javascript
let messageBuffer = "";  // Buffer para mensagens parciais

socket.onmessage = (event) => {
    messageBuffer += event.data;
    
    let jsonStartIndex = 0;
    while (jsonStartIndex < messageBuffer.length) {
        let startChar = messageBuffer[jsonStartIndex];
        
        // Busca início de JSON ({ ou [)
        if (startChar !== '{' && startChar !== '[') {
            jsonStartIndex++;
            continue;
        }
        
        // Conta chaves para encontrar fim do JSON
        let braceCount = 0;
        let inString = false;
        let escapeNext = false;
        let jsonEndIndex = -1;
        
        for (let i = jsonStartIndex; i < messageBuffer.length; i++) {
            const char = messageBuffer[i];
            
            if (char === '"' && !escapeNext) {
                inString = !inString;
            }
            
            if (char === '\\' && inString) {
                escapeNext = !escapeNext;
            } else {
                escapeNext = false;
            }
            
            if (!inString) {
                if (char === '{' || char === '[') {
                    braceCount++;
                } else if (char === '}' || char === ']') {
                    braceCount--;
                    if (braceCount === 0) {
                        jsonEndIndex = i;
                        break;
                    }
                }
            }
        }
        
        // JSON completo encontrado
        if (jsonEndIndex !== -1) {
            const jsonString = messageBuffer.substring(jsonStartIndex, jsonEndIndex + 1);
            
            try {
                const data = JSON.parse(jsonString);
                processWebSocketMessage(data);
            } catch (e1) {
                // Tenta sanitizar (remove NaN, Infinity)
                try {
                    let sanitized = jsonString
                        .replace(/:(\s*)(NaN|Infinity|-Infinity)(\s*)([,}\]])/g, ': null$3$4')
                        .replace(/,(\s*[}\]])/g, '$1');
                    
                    const data2 = JSON.parse(sanitized);
                    console.warn('[Worker] JSON corrigido');
                    processWebSocketMessage(data2);
                } catch (e2) {
                    console.error('[Worker] JSON inválido:', e2.message);
                }
            }
            
            jsonStartIndex = jsonEndIndex + 1;
        } else {
            break;  // Aguarda mais dados
        }
    }
    
    // Remove dados processados do buffer
    messageBuffer = messageBuffer.substring(jsonStartIndex);
    
    // Proteção: limpa buffer se muito grande
    if (messageBuffer.length > 10000) {
        console.warn("[Worker] Buffer muito grande, limpando...");
        messageBuffer = "";
    }
};
```

#### Buffer e Processamento de Dados

```javascript
let dataBuffer = [];
let maxForce = -Infinity;
let emaValue = 0;
let emaInitialized = false;
let emaAlpha = 0.2;
let gravity = 9.80665;

function processWebSocketMessage(data) {
    const messageType = data.type || "unknown";
    
    switch (messageType) {
        case 'data':
            processDataPoint(data);
            break;
            
        case 'config':
            // Atualiza parâmetros locais
            gravity = data.gravity || 9.80665;
            self.postMessage({ type: 'config', payload: data });
            break;
            
        case 'status':
            self.postMessage({ type: 'status', payload: data });
            break;
    }
}

function processDataPoint(data) {
    const forceN = data.forca;
    
    // Atualiza máxima
    if (forceN > maxForce) {
        maxForce = forceN;
    }
    
    // Calcula EMA
    const ema = getEmaValue(forceN);
    
    // Converte força → massa
    const massaKg = gravity > 0 ? forceN / gravity : 0;
    
    // Adiciona ao buffer
    dataBuffer.push({
        tempo: data.tempo,
        forca: forceN,
        ema: ema,
        maxForce: maxForce,
        massaKg: massaKg
    });
    
    // Incrementa contador para RPS
    contadorLeituras++;
}

function getEmaValue(newValue) {
    if (!emaInitialized) {
        emaValue = newValue;
        emaInitialized = true;
    } else {
        emaValue = (emaAlpha * newValue) + ((1 - emaAlpha) * emaValue);
    }
    return emaValue;
}
```

#### Interface com Main Thread

```javascript
self.onmessage = (e) => {
    const { type, payload } = e.data;
    
    switch (type) {
        case 'set_ws_url':
            // Configurar URL do WebSocket
            wsURL = payload.url;
            console.log(`[Worker] URL definida: ${wsURL}`);
            if (socket && socket.readyState === WebSocket.CLOSED) {
                connectWebSocket();
            }
            break;
            
        case 'solicitarDados':
            // Envia buffer acumulado para UI
            if (dataBuffer.length > 0) {
                self.postMessage({ 
                    type: 'dadosDisponiveis', 
                    payload: dataBuffer 
                });
                dataBuffer = [];  // Limpa buffer
            }
            break;
            
        case 'getRPS':
            // Retorna leituras por segundo
            self.postMessage({ 
                type: 'rps', 
                payload: rpsAtual.toFixed(1) 
            });
            break;
            
        case 'sendCommand':
            // Envia comando para servidor
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                self.postMessage({
                    type: 'status',
                    status: 'error',
                    message: 'WebSocket não conectado'
                });
                return;
            }
            
            const jsonCommand = JSON.stringify(payload);
            console.log(`[Worker] Enviando: ${jsonCommand}`);
            socket.send(jsonCommand);
            break;
    }
};
```

### Script Principal: script.js

#### Inicialização do Worker

```javascript
// Cria Worker
const worker = new Worker('dataWorker.js');

// Handlers de mensagens do Worker
worker.onmessage = (e) => {
    const { type, payload } = e.data;
    
    switch (type) {
        case 'status':
            handleWorkerStatus(payload);
            break;
            
        case 'dadosDisponiveis':
            processarDadosDoWorker(payload);
            break;
            
        case 'config':
            atualizarInterfaceComConfig(payload);
            break;
            
        case 'rps':
            document.getElementById('leituras-por-segundo').textContent = 
                payload + ' Hz';
            break;
    }
};

// Solicita dados a cada 50ms (20 Hz UI)
setInterval(() => {
    worker.postMessage({ type: 'solicitarDados' });
}, 50);

// Atualiza RPS a cada 500ms
setInterval(() => {
    worker.postMessage({ type: 'getRPS' });
}, 500);
```

#### Gerenciamento de Gráficos

A aplicação usa **ApexCharts** para visualização em tempo real:

```javascript
let chart;
let chartData = [];
let maxDataPoints = 100;  // Configurável
let chartMode = 'deslizante';  // 'deslizante' ou 'acumulado'
let chartPaused = false;

function initChart() {
    const options = {
        series: [{
            name: 'Força (N)',
            data: []
        }],
        chart: {
            type: 'line',
            height: 500,
            animations: {
                enabled: true,
                dynamicAnimation: {
                    speed: 50
                }
            },
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            }
        },
        stroke: {
            curve: 'smooth',  // ou 'straight'
            width: 2
        },
        xaxis: {
            type: 'numeric',
            title: {
                text: 'Tempo (s)'
            }
        },
        yaxis: {
            title: {
                text: 'Força (N)'
            },
            min: 0,
            max: undefined  // Auto ou fixo
        },
        markers: {
            size: 3
        },
        dataLabels: {
            enabled: false  // Toggleável
        }
    };
    
    chart = new ApexCharts(
        document.querySelector('#grafico'), 
        options
    );
    chart.render();
}

function processarDadosDoWorker(dados) {
    if (chartPaused) return;
    
    dados.forEach(ponto => {
        // Adiciona ao buffer
        chartData.push({
            x: ponto.tempo,
            y: ponto.forca
        });
        
        // Atualiza displays
        atualizarDisplays(ponto);
    });
    
    // Modo deslizante: mantém apenas N pontos
    if (chartMode === 'deslizante' && chartData.length > maxDataPoints) {
        chartData = chartData.slice(-maxDataPoints);
    }
    
    // Atualiza gráfico
    chart.updateSeries([{
        data: chartData
    }]);
}

function atualizarDisplays(ponto) {
    // Força atual
    document.getElementById('forca-atual').textContent = 
        formatForce(ponto.forca);
    
    // Força EMS (EMA)
    document.getElementById('forca-ems').textContent = 
        formatForce(ponto.ema);
    
    // Força máxima
    if (ponto.forca > forcaMaxima) {
        forcaMaxima = ponto.forca;
        document.getElementById('forca-maxima').textContent = 
            formatForce(forcaMaxima);
    }
    
    // Barra de esforço
    atualizarBarraEsforco(ponto.forca);
}
```

#### Filtros de Dados

```javascript
// Filtro de Zona Morta
let filtroZonaMortaAtivo = true;
let limiteZonaMorta = 0.1;  // ±0.1N

function aplicarFiltroZonaMorta(valor) {
    if (!filtroZonaMortaAtivo) return valor;
    
    if (Math.abs(valor) < limiteZonaMorta) {
        return 0;
    }
    return valor;
}

// Arredondamento Inteligente
let arredondamentoAtivo = true;
let casasDecimais = 2;

function aplicarArredondamento(valor) {
    if (!arredondamentoAtivo) return valor;
    
    const multiplicador = Math.pow(10, casasDecimais);
    return Math.round(valor * multiplicador) / multiplicador;
}

// Anti-Noising (EMA no lado cliente)
let antiNoisingAtivo = false;
let antiNoisingEMA = 0;
let antiNoisingAlpha = 0.3;

function aplicarAntiNoising(valor) {
    if (!antiNoisingAtivo) return valor;
    
    antiNoisingEMA = (antiNoisingAlpha * valor) + 
                     ((1 - antiNoisingAlpha) * antiNoisingEMA);
    return antiNoisingEMA;
}
```

#### Gravação de Sessões

```javascript
let sessaoAtiva = null;
let gravandoDados = false;

function iniciarSessao() {
    const nome = document.getElementById('nome-sessao').value.trim();
    
    if (!nome) {
        mostrarNotificacao('Por favor, insira um nome para a sessão.', 'warning');
        return;
    }
    
    // Cria nova sessão
    sessaoAtiva = {
        id: Date.now(),
        nome: nome,
        dataInicio: new Date().toISOString(),
        dataFim: null,
        leituras: [],
        metadata: {
            motorName: '',
            motorDiameter: 0,
            motorLength: 0,
            // ... outros metadados
        }
    };
    
    gravandoDados = true;
    
    // Atualiza UI
    document.getElementById('btn-iniciar-sessao').disabled = true;
    document.getElementById('btn-parar-sessao').disabled = false;
    document.getElementById('status-gravacao').textContent = 
        `🔴 Gravando: ${nome}`;
    
    mostrarNotificacao(`Sessão "${nome}" iniciada!`, 'success');
}

function pararSessao() {
    if (!sessaoAtiva) return;
    
    sessaoAtiva.dataFim = new Date().toISOString();
    gravandoDados = false;
    
    // Salva no localStorage
    const sessoes = JSON.parse(localStorage.getItem('sessoes') || '[]');
    sessoes.push(sessaoAtiva);
    localStorage.setItem('sessoes', JSON.stringify(sessoes));
    
    // Pergunta se quer salvar no MySQL
    const salvarMySQL = confirm(
        `Sessão "${sessaoAtiva.nome}" parada com ${sessaoAtiva.leituras.length} leituras.\n\n` +
        `Deseja salvar no banco de dados MySQL?`
    );
    
    if (salvarMySQL) {
        salvarSessaoMySQL(sessaoAtiva);
    }
    
    // Atualiza UI
    document.getElementById('btn-iniciar-sessao').disabled = false;
    document.getElementById('btn-parar-sessao').disabled = true;
    document.getElementById('status-gravacao').textContent = '⚪ Não gravando';
    
    mostrarNotificacao(`Sessão finalizada com ${sessaoAtiva.leituras.length} pontos!`, 'info');
    
    sessaoAtiva = null;
    
    // Recarrega lista de gravações
    carregarListaGravacoes();
}

// Adiciona leituras à sessão ativa
function processarDadosDoWorker(dados) {
    // ... código de gráfico ...
    
    // Se gravando, adiciona à sessão
    if (gravandoDados && sessaoAtiva) {
        dados.forEach(ponto => {
            sessaoAtiva.leituras.push({
                tempo: ponto.tempo,
                forca: ponto.forca
            });
        });
    }
}

function salvarSessaoMySQL(sessao) {
    worker.postMessage({
        type: 'sendCommand',
        payload: {
            cmd: 'save_session_to_mysql',
            sessionData: sessao
        }
    });
}
```

#### Exportação para OpenRocket (.ENG)

```javascript
function exportarParaOpenRocket(sessao) {
    // Calcula metadados
    const metadata = sessao.metadata || {};
    const motorName = metadata.motorName || 'CustomMotor';
    const diameter = metadata.motorDiameter || 18;  // mm
    const length = metadata.motorLength || 70;      // mm
    const delays = metadata.motorDelay || '0';
    const propWeight = metadata.motorPropweight || 0;  // kg
    const totalWeight = metadata.motorTotalweight || 0;  // kg
    const manufacturer = metadata.motorManufacturer || 'DIY';
    
    // Calcula impulso
    const impulso = calcularImpulso(sessao.leituras);
    const impulsoTotal = impulso.total;
    
    // Classifica motor (A, B, C, D, E, F, G, H, I, J, K, L, M, N, O)
    const classe = classificarMotor(impulsoTotal);
    
    // Cabeçalho .ENG
    let eng = '';
    eng += `; ${motorName}\n`;
    eng += `; Motor experimental - ${manufacturer}\n`;
    eng += `; Impulso Total: ${impulsoTotal.toFixed(2)} N⋅s\n`;
    eng += `; Classe: ${classe}\n`;
    eng += `;\n`;
    eng += `${motorName} ${diameter} ${length} ${delays} ${propWeight} ${totalWeight} ${manufacturer}\n`;
    
    // Dados tempo-força
    sessao.leituras.forEach(ponto => {
        // OpenRocket espera: tempo(s) força(N)
        eng += `${ponto.tempo.toFixed(3)} ${Math.max(0, ponto.forca).toFixed(3)}\n`;
    });
    
    // Ponto final (força zero)
    const ultimoPonto = sessao.leituras[sessao.leituras.length - 1];
    eng += `${(ultimoPonto.tempo + 0.001).toFixed(3)} 0.000\n`;
    eng += `;\n`;
    
    // Download do arquivo
    const blob = new Blob([eng], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${motorName}_${sessao.id}.eng`;
    a.click();
    URL.revokeObjectURL(url);
    
    mostrarNotificacao(`Arquivo .ENG exportado: ${motorName}_${sessao.id}.eng`, 'success');
}

function calcularImpulso(leituras) {
    // Método trapezoidal
    let impulsoTotal = 0;
    let impulsoPositivo = 0;
    
    for (let i = 1; i < leituras.length; i++) {
        const dt = leituras[i].tempo - leituras[i-1].tempo;
        const avgForce = (leituras[i].forca + leituras[i-1].forca) / 2;
        
        const dI = avgForce * dt;
        impulsoTotal += dI;
        
        if (avgForce > 0) {
            impulsoPositivo += dI;
        }
    }
    
    return {
        total: impulsoTotal,
        positivo: impulsoPositivo,
        negativo: impulsoTotal - impulsoPositivo
    };
}

function classificarMotor(impulsoTotal) {
    const classes = [
        { limite: 2.5, nome: 'A' },
        { limite: 5, nome: 'B' },
        { limite: 10, nome: 'C' },
        { limite: 20, nome: 'D' },
        { limite: 40, nome: 'E' },
        { limite: 80, nome: 'F' },
        { limite: 160, nome: 'G' },
        { limite: 320, nome: 'H' },
        { limite: 640, nome: 'I' },
        { limite: 1280, nome: 'J' },
        { limite: 2560, nome: 'K' },
        { limite: 5120, nome: 'L' },
        { limite: 10240, nome: 'M' },
        { limite: 20480, nome: 'N' },
        { limite: 40960, nome: 'O' }
    ];
    
    for (const classe of classes) {
        if (impulsoTotal <= classe.limite) {
            return classe.nome;
        }
    }
    
    return 'O+';  // Acima de classe O
}
```

---

## 🔌 Comunicação USB/Serial

### Configuração da Porta Serial

**Servidor Python:**
```python
SERIAL_PORT = "/dev/ttyUSB0"  # ou /dev/ttyACM0
SERIAL_BAUD = 921600
timeout = 1.0
```

**Docker Compose:**
```yaml
devices:
  - "/dev/ttyUSB0:/dev/ttyUSB0"
```

### Características do Protocolo Serial

- **Baud Rate:** 921600 (necessário para 80 Hz)
- **Data Bits:** 8
- **Stop Bits:** 1
- **Parity:** None
- **Flow Control:** None
- **Encoding:** Binário (não ASCII)

### Taxa de Transferência

**Taxa de dados:**
- Frequência: 80 Hz
- Bytes por pacote DATA: 16 bytes
- Throughput: 80 × 16 = 1280 bytes/s = 10240 bits/s
- **Utilização da banda:** 10240 / 921600 ≈ **1.1%**

**Headroom:** O protocolo tem margem de 98.9% para comandos, configurações e status.

### Sincronização de Pacotes

#### Problema: Alinhamento

Ao iniciar a leitura, o buffer serial pode estar no meio de um pacote. O parser precisa **sincronizar** para encontrar o início correto.

#### Solução: Magic Number Search

```python
while len(buf) >= 8:
    # Busca o magic number 0xA1B2 (little-endian: B2 A1)
    magic_idx = buf.find(b'\xB2\xA1')
    
    if magic_idx == -1:
        # Nenhum magic encontrado, limpa buffer antigo
        if len(buf) > 256:
            buf = buf[-256:]  # Mantém últimos 256 bytes
        break
    
    if magic_idx > 0:
        # Dados antes do magic (lixo ou texto de debug)
        text_data = buf[:magic_idx].decode('utf-8', errors='ignore').strip()
        if text_data:
            logging.debug(f"Dados não-binários: {text_data}")
        
        # Remove dados antes do magic
        del buf[:magic_idx]
    
    # Agora buf[0:2] contém o magic
    # Continue processando...
```

### Tratamento de Erros

#### CRC Mismatch

```python
crc_calc = crc16_ccitt(data[:-2])
crc_rx = struct.unpack("<H", data[-2:])[0]

if crc_calc != crc_rx:
    logging.warning(f"CRC mismatch: calc={crc_calc:04X}, rx={crc_rx:04X}")
    # Descarta pacote silenciosamente
    continue
```

#### Pacotes Inválidos Consecutivos

```python
invalid_packet_count = 0
max_invalid_packets = 10

if not valid_packet:
    invalid_packet_count += 1
    
    if invalid_packet_count > max_invalid_packets:
        logging.warning("Muitos pacotes inválidos. Resincronizando.")
        buf.clear()
        invalid_packet_count = 0
```

---

## 🌐 Comunicação WebSocket

### Arquitetura

```
Cliente 1  ──┐
Cliente 2  ──┤
Cliente 3  ──┼──> [WebSocket Server] ──> Broadcast JSON
Cliente N  ──┘            ↕
                    [Serial Thread]
                          ↕
                      [ESP32]
```

### Características

- **Porta:** 81
- **Protocolo:** ws:// (não criptografado)
- **Formato:** JSON
- **Broadcast:** Todos os clientes recebem os mesmos dados
- **Latência:** < 10ms (típico)

### Mensagens Cliente → Servidor

#### 1. Comando de Tara

```json
{
  "cmd": "t"
}
```

ou

```json
{
  "cmd": "tara"
}
```

#### 2. Comando de Calibração

```json
{
  "cmd": "c",
  "massa_g": 500.0
}
```

ou

```json
{
  "cmd": "calibrate",
  "massa_g": 1000.0
}
```

#### 3. Solicitar Configurações

```json
{
  "cmd": "get_config"
}
```

#### 4. Definir Parâmetro

```json
{
  "cmd": "set",
  "param": "gravity",
  "value": 9.81
}
```

**Parâmetros disponíveis:**
- `gravity`
- `conversionFactor`
- `leiturasEstaveis`
- `toleranciaEstabilidade`
- `mode`
- `usarEMA`
- `numAmostrasMedia`
- `tareOffset`
- `timeoutCalibracao`
- `capacidadeMaximaGramas`
- `percentualAcuracia`

#### 5. Salvar Sessão (MySQL)

```json
{
  "cmd": "save_session_to_mysql",
  "sessionData": {
    "id": 1699000000000,
    "nome": "Teste Motor Alpha",
    "dataInicio": "2025-11-03T14:30:00.000Z",
    "dataFim": "2025-11-03T14:35:00.000Z",
    "leituras": [
      { "tempo": 0.0, "forca": 0.0 },
      { "tempo": 0.0125, "forca": 5.2 },
      // ...
    ],
    "metadata": {
      "motorName": "Alpha-1",
      "motorDiameter": 18,
      "motorLength": 70,
      // ...
    }
  }
}
```

### Mensagens Servidor → Cliente

#### 1. Dados de Força

```json
{
  "type": "data",
  "tempo": 123.456,
  "forca": 12.34,
  "status": "Pesando",
  "timestamp": "2025-11-03T14:30:45.123-03:00"
}
```

**Enviado a:** 80 Hz

#### 2. Configurações

```json
{
  "type": "config",
  "conversionFactor": 21000.0,
  "gravity": 9.80665,
  "leiturasEstaveis": 10,
  "toleranciaEstabilidade": 100.0,
  "numAmostrasMedia": 3,
  "numAmostrasCalibracao": 10000,
  "usarMediaMovel": 1,
  "usarEMA": 0,
  "timeoutCalibracao": 20,
  "tareOffset": 0,
  "capacidadeMaximaGramas": 5000.0,
  "percentualAcuracia": 0.05,
  "mode": 0
}
```

**Enviado:**
- Após conexão (automático)
- Após comando `get_config`
- Após alteração de parâmetros

#### 3. Status/Eventos

```json
{
  "type": "status",
  "status": "success",
  "message": "Tara concluída",
  "code": 16,
  "value": 0,
  "timestamp": 123456.789
}
```

**Tipos de status:**
- `info`: Informação
- `success`: Sucesso
- `warning`: Aviso
- `error`: Erro

#### 4. Erro

```json
{
  "type": "error",
  "message": "Comando inválido ou serial desconectado"
}
```

### Reconexão Automática

**No Worker:**

```javascript
setInterval(() => {
    if (socket == null || socket.readyState === WebSocket.CLOSED) {
        console.log("[Worker] Tentando reconectar...");
        connectWebSocket();
    }
}, 1000);  // A cada 1 segundo
```

### Indicadores de Conexão

**Na UI:**

```javascript
function handleWorkerStatus(payload) {
    const wsIndicator = document.getElementById('ws-indicator');
    const wsText = document.getElementById('ws-text');
    
    if (payload.status === 'connected') {
        wsIndicator.className = 'status-indicator status-ok';
        wsText.textContent = 'Conectado';
    } else if (payload.status === 'disconnected') {
        wsIndicator.className = 'status-indicator status-error';
        wsText.textContent = 'Desconectado';
    } else if (payload.status === 'error') {
        wsIndicator.className = 'status-indicator status-warning';
        wsText.textContent = 'Erro';
    }
}
```

---

## ✨ Funcionalidades Detalhadas

### 1. Calibração da Célula de Carga

**Processo:**

1. **Tara (Zerar):**
   - Remove a plataforma e objetos
   - Aguarda estabilização
   - Define offset zero
   
2. **Calibração:**
   - Coloca massa conhecida (ex: 500g)
   - Aguarda estabilização
   - Calcula fator de conversão: `fator = (raw - offset) / massa`

**UI:**

```javascript
async function calibrar() {
    const massaInput = prompt('Massa conhecida (gramas):');
    const massa = parseFloat(massaInput);
    
    if (isNaN(massa) || massa <= 0) {
        alert('Massa inválida!');
        return;
    }
    
    // Envia comando
    worker.postMessage({
        type: 'sendCommand',
        payload: {
            cmd: 'c',
            massa_g: massa
        }
    });
    
    mostrarNotificacao(
        `Calibração iniciada com ${massa}g. Aguarde estabilização...`,
        'info'
    );
}
```

### 2. Modos de Visualização do Gráfico

#### Modo Deslizante

Mantém apenas os últimos N pontos (janela móvel):

```javascript
if (chartMode === 'deslizante' && chartData.length > maxDataPoints) {
    chartData = chartData.slice(-maxDataPoints);
}
```

**Vantagens:**
- Performance constante
- Foco em dados recentes
- Reduz uso de memória

#### Modo Acumulado

Armazena todos os pontos sem limite:

```javascript
// Não remove pontos antigos
chartData.push(newPoint);
```

**Vantagens:**
- Histórico completo
- Ideal para análise pós-teste
- Permite zoom temporal

### 3. Filtros de Sinal

#### Zona Morta

Elimina deriva e ruído próximo a zero:

```javascript
function aplicarFiltroZonaMorta(valor) {
    if (!filtroZonaMortaAtivo) return valor;
    
    // Se |valor| < limiteZonaMorta → retorna 0
    if (Math.abs(valor) < limiteZonaMorta) {
        return 0;
    }
    return valor;
}
```

**Configuração típica:**
- Limite: ±0.1N (±10g)

#### Arredondamento Inteligente

Reduz ruído visual baseado na acurácia da célula:

```javascript
function aplicarArredondamento(valor) {
    if (!arredondamentoAtivo) return valor;
    
    // Arredonda para N casas decimais
    const multiplicador = Math.pow(10, casasDecimais);
    return Math.round(valor * multiplicador) / multiplicador;
}
```

**Casas decimais baseadas em acurácia:**
- Acurácia 5% → 1 casa decimal
- Acurácia 1% → 2 casas decimais
- Acurácia 0.1% → 3 casas decimais

#### Anti-Noising (EMA)

Média Móvel Exponencial aplicada no cliente:

```javascript
function aplicarAntiNoising(valor) {
    if (!antiNoisingAtivo) return valor;
    
    // EMA: y[n] = α·x[n] + (1-α)·y[n-1]
    antiNoisingEMA = (antiNoisingAlpha * valor) + 
                     ((1 - antiNoisingAlpha) * antiNoisingEMA);
    return antiNoisingEMA;
}
```

**Parâmetro α (alpha):**
- 0.1: Suavização forte (lento)
- 0.3: Equilíbrio (padrão)
- 0.5: Resposta rápida

### 4. Alerta de Sobrecarga

Protege a célula de carga contra danos:

```javascript
function verificarSobrecarga(forca, capacidadeMaxima) {
    const percentual = (forca / capacidadeMaxima) * 100;
    
    // Atualiza barra de esforço
    const barra = document.getElementById('barra-esforco-fill');
    barra.style.width = `${percentual}%`;
    
    // Muda cor baseado no percentual
    if (percentual < 50) {
        barra.style.background = '#27ae60';  // Verde
    } else if (percentual < 70) {
        barra.style.background = '#f39c12';  // Amarelo
    } else if (percentual < 80) {
        barra.style.background = '#e67e22';  // Laranja
    } else if (percentual < 90) {
        barra.style.background = '#e74c3c';  // Vermelho
    } else {
        barra.style.background = '#c0392b';  // Vermelho escuro
        
        // Modal de alerta
        mostrarModalSobrecarga(forca, capacidadeMaxima, percentual);
    }
}

function mostrarModalSobrecarga(forca, limite, percentual) {
    const modal = document.getElementById('modal-alerta-sobrecarga');
    
    document.getElementById('modal-sobrecarga-valor-atual').textContent = 
        `${forca.toFixed(2)} N`;
    document.getElementById('modal-sobrecarga-valor-limite').textContent = 
        `${limite.toFixed(2)} N`;
    document.getElementById('modal-sobrecarga-percentual').textContent = 
        `${percentual.toFixed(1)}%`;
    
    // Muda título baseado no perigo
    const titulo = document.getElementById('modal-sobrecarga-titulo');
    if (percentual >= 95) {
        titulo.textContent = '🚨 PERIGO CRÍTICO! PARE AGORA!';
        titulo.style.color = '#c0392b';
    } else {
        titulo.textContent = '⚠️ ATENÇÃO: APROXIMANDO DO LIMITE!';
        titulo.style.color = '#e67e22';
    }
    
    modal.style.display = 'flex';
}
```

### 5. Importação de Testes Externos

Permite importar logs de empuxo de outras fontes:

```javascript
function importarArquivo() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.csv,.log';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = (event) => {
            const conteudo = event.target.result;
            processarArquivoImportado(conteudo, file.name);
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function processarArquivoImportado(conteudo, nomeArquivo) {
    const linhas = conteudo.split('\n');
    const leituras = [];
    
    linhas.forEach(linha => {
        linha = linha.trim();
        
        // Ignora linhas vazias e comentários
        if (!linha || linha.startsWith('#') || linha.startsWith(';')) {
            return;
        }
        
        // Formato esperado: "tempo força" ou "tempo,força"
        const partes = linha.split(/[\s,]+/);
        
        if (partes.length >= 2) {
            const tempo = parseFloat(partes[0]);
            const forca = parseFloat(partes[1]);
            
            if (!isNaN(tempo) && !isNaN(forca)) {
                leituras.push({ tempo, forca });
            }
        }
    });
    
    if (leituras.length === 0) {
        alert('Nenhum dado válido encontrado no arquivo!');
        return;
    }
    
    // Cria sessão importada
    const sessao = {
        id: Date.now(),
        nome: nomeArquivo.replace(/\.[^/.]+$/, ''),  // Remove extensão
        dataInicio: new Date().toISOString(),
        dataFim: new Date().toISOString(),
        leituras: leituras,
        metadata: {},
        importado: true
    };
    
    // Salva no localStorage
    const sessoes = JSON.parse(localStorage.getItem('sessoes') || '[]');
    sessoes.push(sessao);
    localStorage.setItem('sessoes', JSON.stringify(sessoes));
    
    mostrarNotificacao(
        `Arquivo importado: ${leituras.length} pontos carregados!`,
        'success'
    );
    
    carregarListaGravacoes();
}
```

### 6. Geração de Relatórios PDF

Utiliza a função de impressão do navegador:

```javascript
function gerarRelatorio(sessao) {
    // Cria janela de impressão
    const janelaImpressao = window.open('', '_blank');
    
    // Calcula estatísticas
    const stats = calcularEstatisticas(sessao.leituras);
    const impulso = calcularImpulso(sessao.leituras);
    const classe = classificarMotor(impulso.total);
    
    // HTML do relatório
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Relatório - ${sessao.nome}</title>
            <style>
                @media print {
                    body { font-family: Arial, sans-serif; }
                    .page-break { page-break-after: always; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; }
                    th { background-color: #f2f2f2; }
                }
            </style>
        </head>
        <body>
            <h1>Relatório de Teste de Propulsão</h1>
            <h2>${sessao.nome}</h2>
            
            <h3>Informações Gerais</h3>
            <table>
                <tr><th>Data/Hora</th><td>${new Date(sessao.dataInicio).toLocaleString()}</td></tr>
                <tr><th>Duração</th><td>${stats.duracao.toFixed(2)} s</td></tr>
                <tr><th>Amostras</th><td>${sessao.leituras.length}</td></tr>
                <tr><th>Taxa de Amostragem</th><td>${stats.taxaAmostragem.toFixed(1)} Hz</td></tr>
            </table>
            
            <h3>Resultados</h3>
            <table>
                <tr><th>Impulso Total</th><td>${impulso.total.toFixed(2)} N⋅s</td></tr>
                <tr><th>Impulso Positivo</th><td>${impulso.positivo.toFixed(2)} N⋅s</td></tr>
                <tr><th>Classificação</th><td>${classe}</td></tr>
                <tr><th>Força Máxima</th><td>${stats.forcaMaxima.toFixed(2)} N</td></tr>
                <tr><th>Força Média</th><td>${stats.forcaMedia.toFixed(2)} N</td></tr>
                <tr><th>Tempo até Pico</th><td>${stats.tempoAtePico.toFixed(3)} s</td></tr>
            </table>
            
            <div class="page-break"></div>
            
            <h3>Gráfico de Empuxo</h3>
            <canvas id="grafico-relatorio" width="800" height="400"></canvas>
            
            <h3>Tabela de Dados (Primeiros 100 pontos)</h3>
            <table>
                <thead>
                    <tr><th>Tempo (s)</th><th>Força (N)</th></tr>
                </thead>
                <tbody>
                    ${sessao.leituras.slice(0, 100).map(p => `
                        <tr>
                            <td>${p.tempo.toFixed(3)}</td>
                            <td>${p.forca.toFixed(3)}</td>
                        </tr>
                    `).join('')}
                    ${sessao.leituras.length > 100 ? '<tr><td colspan="2">... (dados truncados)</td></tr>' : ''}
                </tbody>
            </table>
        </body>
        </html>
    `;
    
    janelaImpressao.document.write(html);
    janelaImpressao.document.close();
    
    // Aguarda carregar e imprime
    janelaImpressao.onload = () => {
        janelaImpressao.print();
    };
}
```

---

## 📊 Fluxos de Dados

### Fluxo 1: Leitura Normal (80 Hz)

```
1. ESP32: Lê HX711 (12.5ms)
         ↓
2. ESP32: Converte raw → gramas → Newtons
         ↓
3. ESP32: Monta PacketData (16 bytes)
         ↓
4. ESP32: Calcula CRC16
         ↓
5. ESP32: Envia via Serial USB
         ↓
6. Python: Recebe no buffer (256 bytes)
         ↓
7. Python: Busca magic number
         ↓
8. Python: Valida CRC
         ↓
9. Python: Parseia struct
         ↓
10. Python: Converte para JSON
         ↓
11. Python: Broadcast WebSocket (todos os clientes)
         ↓
12. Worker: Recebe JSON
         ↓
13. Worker: Processa (EMA, max, etc)
         ↓
14. Worker: Adiciona ao buffer
         ↓
15. Main Thread: Solicita dados (20 Hz)
         ↓
16. Main Thread: Atualiza gráfico e displays
```

**Latência total:** ~15-25ms

### Fluxo 2: Comando de Tara

```
1. UI: Usuário clica "Tara" ou pressiona Shift+T
         ↓
2. Main Thread: Chama função tarar()
         ↓
3. Main Thread: Envia para Worker
         ↓
4. Worker: Monta JSON {"cmd": "t"}
         ↓
5. Worker: Envia via WebSocket
         ↓
6. Python: Recebe JSON
         ↓
7. Python: Converte para binário CmdTara
         ↓
8. Python: Envia via Serial
         ↓
9. ESP32: Recebe comando binário
         ↓
10. ESP32: Valida CRC
         ↓
11. ESP32: Aguarda estabilidade (até 20s)
         ↓
12. ESP32: Executa loadcell.tare()
         ↓
13. ESP32: Salva offset na EEPROM
         ↓
14. ESP32: Envia PacketStatus (sucesso)
         ↓
15. Python: Recebe PacketStatus
         ↓
16. Python: Converte para JSON
         ↓
17. Python: Broadcast WebSocket
         ↓
18. Worker: Recebe status
         ↓
19. Worker: Repassa para Main Thread
         ↓
20. Main Thread: Mostra notificação "Tara concluída!"
```

### Fluxo 3: Salvamento de Sessão

```
1. UI: Usuário clica "Parar Gravação"
         ↓
2. Main Thread: Para gravação
         ↓
3. Main Thread: Salva no localStorage
         ↓
4. Main Thread: Pergunta sobre MySQL
         ↓
         (Se sim)
         ↓
5. Main Thread: Monta comando save_session_to_mysql
         ↓
6. Main Thread: Envia para Worker
         ↓
7. Worker: Envia JSON via WebSocket
         ↓
8. Python: Recebe comando especial
         ↓
9. Python: Extrai sessionData
         ↓
10. Python: Conecta ao MySQL
         ↓
11. Python: BEGIN TRANSACTION
         ↓
12. Python: INSERT INTO sessoes (...)
         ↓
13. Python: INSERT INTO leituras (...) (batch)
         ↓
14. Python: COMMIT
         ↓
15. Python: Envia confirmação via WebSocket
         ↓
16. Worker: Recebe confirmação
         ↓
17. Worker: Repassa para Main Thread
         ↓
18. Main Thread: Mostra notificação "Salvo no MySQL!"
```

---

## 🐳 Infraestrutura Docker

### docker-compose.yml

```yaml
services:
  balanca:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: balanca
    restart: always
    depends_on:
      - db
    mem_limit: 512m
    ports:
      - "80:80"   # HTTP
      - "81:81"   # WebSocket
    
    devices:
      - "/dev/ttyUSB0:/dev/ttyUSB0"  # Serial USB
    
    cap_add:
      - SYS_TIME  # Permite sincronização de hora
    
    environment:
      SERIAL_PORT: "/dev/ttyUSB0"
      SERIAL_BAUD: "921600"
      WS_PORT: "81"
      HTTP_PORT: "80"
      MYSQL_HOST: "db"
      MYSQL_USER: "balanca_user"
      MYSQL_PASSWORD: "balanca_password"
      MYSQL_DB: "balanca_gfig"
      MYSQL_ROOT_PASSWORD: "Hilquias"
      TZ: "America/Sao_Paulo"
    
    volumes:
      - ./:/app
    
    working_dir: /app/data
    command: ["python", "/app/server.py"]
    
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    
    networks:
      - balanca_network
  
  db:
    image: mariadb:11
    container_name: balanca_mysql
    restart: always
    mem_limit: 256m
    mem_reservation: 128m
    
    environment:
      MYSQL_ROOT_PASSWORD_FILE: "/run/secrets/db_root_password"
      MYSQL_DATABASE: "balanca_gfig"
      MYSQL_USER: "balanca_user"
      MYSQL_PASSWORD: "balanca_password"
      TZ: "America/Sao_Paulo"
    
    volumes:
      - mysql_data:/var/lib/mysql
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    
    secrets:
      - db_root_password
    
    ports:
      - "3306:3306"
    
    networks:
      - balanca_network
    
    healthcheck:
      test: ["CMD-SHELL", "mariadb-admin ping -h localhost -u balanca_user -p'balanca_password' || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 30s

networks:
  balanca_network:
    driver: bridge

volumes:
  mysql_data:

secrets:
  db_root_password:
    file: ./db_root_password.txt
```

### Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    git \
    udev \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements.txt
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia código
COPY . .

# Expõe portas
EXPOSE 80 81

# Comando padrão
CMD ["python", "server.py"]
```

### requirements.txt

```
pyserial==3.5
websockets==12.0
pymysql==1.1.0
python-zoneinfo==0.2.1
```

### Gerenciamento de Containers

**Iniciar:**
```bash
docker compose up -d
```

**Parar:**
```bash
docker compose down
```

**Ver logs:**
```bash
docker compose logs -f balanca
```

**Reiniciar:**
```bash
docker compose restart balanca
```

**Reconstruir:**
```bash
docker compose up -d --build
```

---

## 🗄️ Banco de Dados MySQL

### Esquema

#### Tabela: sessoes

```sql
CREATE TABLE sessoes (
    id BIGINT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME,
    data_modificacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Metadados do motor
    motor_name VARCHAR(255),
    motor_diameter FLOAT,
    motor_length FLOAT,
    motor_delay FLOAT,
    motor_propweight FLOAT,
    motor_totalweight FLOAT,
    motor_manufacturer VARCHAR(255),
    motor_description TEXT,
    motor_observations TEXT
);
```

#### Tabela: leituras

```sql
CREATE TABLE leituras (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sessao_id BIGINT NOT NULL,
    tempo DOUBLE NOT NULL,
    forca DOUBLE NOT NULL,
    
    FOREIGN KEY (sessao_id) REFERENCES sessoes(id) ON DELETE CASCADE,
    INDEX idx_sessao (sessao_id),
    INDEX idx_tempo (tempo)
);
```

### Queries Úteis

#### Listar todas as sessões

```sql
SELECT 
    id,
    nome,
    data_inicio,
    data_fim,
    TIMESTAMPDIFF(SECOND, data_inicio, data_fim) AS duracao_segundos,
    motor_name,
    motor_manufacturer
FROM sessoes
ORDER BY data_inicio DESC;
```

#### Obter estatísticas de uma sessão

```sql
SELECT 
    COUNT(*) AS total_leituras,
    MIN(tempo) AS tempo_inicial,
    MAX(tempo) AS tempo_final,
    MAX(forca) AS forca_maxima,
    AVG(forca) AS forca_media
FROM leituras
WHERE sessao_id = ?;
```

#### Calcular impulso total

```sql
SELECT 
    sessao_id,
    SUM(
        (forca + COALESCE(LAG(forca) OVER (ORDER BY tempo), 0)) / 2 
        * (tempo - COALESCE(LAG(tempo) OVER (ORDER BY tempo), tempo))
    ) AS impulso_total
FROM leituras
WHERE sessao_id = ?
GROUP BY sessao_id;
```

#### Deletar sessões antigas

```sql
DELETE FROM sessoes
WHERE data_inicio < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

---

## 🔬 Algoritmos e Filtros

### 1. Média Móvel Exponencial (EMA)

**Fórmula:**
```
y[n] = α · x[n] + (1 - α) · y[n-1]
```

Onde:
- `y[n]`: Saída filtrada no instante n
- `x[n]`: Entrada atual
- `y[n-1]`: Saída anterior
- `α` (alpha): Fator de suavização (0 < α < 1)

**Implementação:**

```javascript
function getEmaValue(newValue) {
    if (!emaInitialized) {
        emaValue = newValue;
        emaInitialized = true;
    } else {
        emaValue = (emaAlpha * newValue) + ((1 - emaAlpha) * emaValue);
    }
    return emaValue;
}
```

**Características:**
- α = 0.1 → Suavização forte, resposta lenta
- α = 0.5 → Equilíbrio
- α = 0.9 → Pouca suavização, resposta rápida

### 2. Detecção de Estabilidade

**Algoritmo:**

```cpp
bool aguardarEstabilidade(const char* proposito) {
    unsigned long start = millis();
    int leiturasConsecutivas = 0;
    float leituraAnterior = 0;
    
    while (millis() - start < config.timeoutCalibracao) {
        if (!loadcell.is_ready()) continue;
        
        float leituraAtual = loadcell.get_units(config.numAmostrasMedia);
        float diferenca = abs(leituraAtual - leituraAnterior);
        
        if (diferenca <= config.toleranciaEstabilidade) {
            leiturasConsecutivas++;
            
            if (leiturasConsecutivas >= config.leiturasEstaveis) {
                return true;  // ESTÁVEL
            }
        } else {
            leiturasConsecutivas = 0;  // Reset
        }
        
        leituraAnterior = leituraAtual;
        delay(10);
    }
    
    return false;  // TIMEOUT
}
```

**Critérios:**
1. Diferença entre leituras consecutivas < tolerância
2. Critério mantido por N leituras
3. Timeout se não estabilizar

### 3. Cálculo de Impulso (Integração Numérica)

**Método Trapezoidal:**

```javascript
function calcularImpulso(leituras) {
    let impulsoTotal = 0;
    let impulsoPositivo = 0;
    
    for (let i = 1; i < leituras.length; i++) {
        // Δt = diferença de tempo
        const dt = leituras[i].tempo - leituras[i-1].tempo;
        
        // Força média no intervalo
        const avgForce = (leituras[i].forca + leituras[i-1].forca) / 2;
        
        // ΔI = F_avg · Δt
        const dI = avgForce * dt;
        impulsoTotal += dI;
        
        if (avgForce > 0) {
            impulsoPositivo += dI;
        }
    }
    
    return {
        total: impulsoTotal,        // N⋅s
        positivo: impulsoPositivo,  // N⋅s
        negativo: impulsoTotal - impulsoPositivo  // N⋅s
    };
}
```

**Fórmula:**
```
I = ∫ F(t) dt ≈ Σ [(F[i] + F[i-1]) / 2] · (t[i] - t[i-1])
```

### 4. Conversão de Unidades

#### Força → Massa

```javascript
// Newton → Quilograma
massaKg = forcaN / gravity;

// Newton → Grama
massaG = (forcaN / gravity) * 1000;

// Newton → Grama-força
gramaForca = (forcaN / gravity) * 1000;

// Newton → Quilograma-força
kgForca = forcaN / gravity;
```

Onde `gravity` = 9.80665 m/s² (aceleração padrão)

### 5. Taxa de Amostragem (RPS)

**Método 1: Contador temporal**

```javascript
let contadorLeituras = 0;
let ultimaAtualizacaoRPS = Date.now();
let rpsAtual = 0;

// A cada nova leitura
contadorLeituras++;

// A cada 1 segundo
const agora = Date.now();
const tempoDecorrido = (agora - ultimaAtualizacaoRPS) / 1000;

if (tempoDecorrido >= 1.0) {
    rpsAtual = contadorLeituras / tempoDecorrido;
    contadorLeituras = 0;
    ultimaAtualizacaoRPS = agora;
}
```

**Método 2: Delta de tempo do MCU**

```javascript
let lastTempoMCU = null;
let rpsCalculadoMCU = 0;
let totalLeiturasMCU = 0;

// A cada nova leitura
if (lastTempoMCU !== null) {
    const deltaTempo = data.tempo - lastTempoMCU;
    if (deltaTempo > 0) {
        const rpsInstantaneo = 1 / deltaTempo;
        
        // Média móvel
        rpsCalculadoMCU = 
            (rpsCalculadoMCU * totalLeiturasMCU + rpsInstantaneo) / 
            (totalLeiturasMCU + 1);
        
        totalLeiturasMCU++;
    }
}
lastTempoMCU = data.tempo;
```

---

## 🎯 Conclusão

Este documento apresenta a **arquitetura completa** e o **funcionamento detalhado** da Balança Digital GFIG para testes de motores de minifoguetes experimentais.

### Principais Destaques

1. **Protocolo Binário Proprietário**
   - Eficiência: apenas 1.1% da banda serial utilizada
   - Integridade: CRC16-CCITT detecta 99.998% dos erros
   - Extensível: 23 bytes reservados para expansões futuras

2. **Arquitetura em 3 Camadas**
   - ESP32: Aquisição de alta velocidade (80 Hz)
   - Python: Gateway bidirecional confiável
   - Web: Interface responsiva com Web Worker

3. **Processamento Distribuído**
   - Worker Thread: processamento sem bloquear UI
   - Main Thread: renderização fluida
   - Serial Thread: leitura contínua sem perda de dados

4. **Funcionalidades Avançadas**
   - Gravação de sessões com metadados
   - Exportação para OpenRocket (.ENG)
   - Cálculo automático de impulso e classificação
   - Filtros configuráveis (zona morta, EMA, arredondamento)
   - Alerta de sobrecarga para proteção de hardware

5. **Infraestrutura Robusta**
   - Containerização Docker para deploy consistente
   - MySQL para persistência confiável
   - Reconexão automática em todas as camadas
   - Healthcheck e auto-recuperação

### Desempenho

- **Latência fim-a-fim:** 15-25ms
- **Taxa de aquisição:** 80 Hz (12.5ms/leitura)
- **Taxa de atualização da UI:** 20 Hz (50ms)
- **Throughput serial:** 10.24 kbps (1.1% de utilização)
- **Múltiplos clientes:** Broadcast assíncrono sem degradação

### Aplicações

- Testes estáticos de motores de foguetes experimentais
- Caracterização de propelentes sólidos
- Validação de simulações (OpenRocket, RASAero)
- Educação em engenharia aeroespacial
- Competições de foguetemodelismo

---

**Versão do Documento:** 1.0  
**Data:** 03 de Novembro de 2025  
**Autor:** Documentação técnica gerada para o projeto GFIG  
**Licença:** MIT (conforme projeto original)
---

## 🧾 Licença e Créditos

Desenvolvido por **Romulo de Aguiar Beninca**
Projeto Controle e Automção - IFSC Campus Gaspar
Projeto "GFIG - Grupo de Foguetes do Instituto Federal de Santa Catarina (IFSC) – Campus Gaspar

Uso educacional e experimental.


