// --- Variáveis Globais do Worker ---
console.log("🚀 dataWorker.js carregado com sucesso!");
let socket;
let dataBuffer = [];
let gravity = 9.80665;
let emaAlpha = 0.2;
let emaValue = 0;
let emaInitialized = false;
let maxForce = -Infinity;
let wsURL = ''; // NOVO: Variável para armazenar a URL do WebSocket

// NOVO: Buffer para mensagens parciais do WebSocket
let messageBuffer = "";

// --- Variáveis para cálculo de Leituras por Segundo (RPS) ---
let lastTempoMCU = null;
let totalLeiturasMCU = 0;
let rpsCalculadoMCU = 0;

/**
 * Conecta ao servidor WebSocket do Host (Raspberry Pi/PC).
 */
function connectWebSocket() {
    // Evita criar múltiplas conexões se uma já estiver ativa ou tentando conectar.
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        console.log(`[Worker] Socket já existe. Estado: ${socket.readyState}`);
        return;
    }

    let finalWsURL = wsURL;

    // Se a URL não foi definida pela UI, usa a lógica de fallback
    if (!finalWsURL) {
        console.log("[Worker] Nenhuma URL customizada. Usando lógica de fallback.");
        let host = location.hostname;
        let port = 81;

        if (location.port === '5500' || host === 'localhost' || host === '127.0.0.1') {
            host = 'localhost';
        }
        finalWsURL = `ws://${host}:${port}`;
    } else {
        let givenUrl = finalWsURL.trim();

        // 1. Adiciona o protocolo se não estiver presente
        if (!givenUrl.startsWith('ws://') && !givenUrl.startsWith('wss://')) {
            givenUrl = `ws://${givenUrl}`;
        }

        // 2. Verifica a presença da porta de forma robusta
        const lastColon = givenUrl.lastIndexOf(':');
        const lastBracket = givenUrl.lastIndexOf(']');

        // A porta existe se o último dois-pontos vem depois do último colchete (para IPv6)
        // ou se não há colchetes e há um dois-pontos (para IPv4/hostname)
        const hasPort = lastColon > lastBracket;

        if (!hasPort) {
            givenUrl += ':81';
        }

        finalWsURL = givenUrl;
    }
    
    console.log(`[Worker] 🔄 Tentando conectar WebSocket: ${finalWsURL}`);

    try {
        socket = new WebSocket(finalWsURL);
    } catch (e) {
        console.error("[Worker] ❌ Erro ao criar WebSocket:", e);
        self.postMessage({ type: 'status', status: 'error', message: 'URL de WebSocket inválida: ' + e.message });
        return;
    }

    socket.onopen = () => {
        console.log(`[Worker] ✅ WebSocket CONECTADO! Estado: ${socket.readyState}, URL: ${socket.url}`);
        self.postMessage({ type: 'status', status: 'connected', message: 'Conectado ao Gateway Serial (Host)' });
    };

    socket.onclose = (event) => {
        console.log(`[Worker] ⚠️ WebSocket FECHADO. Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}. Estado: ${socket.readyState}, URL: ${socket.url}`);
        self.postMessage({ type: 'status', status: 'disconnected', message: `Desconectado (${event.code}). Tentando reconectar...` });
        socket = null;
    };

    socket.onerror = (error) => {
        console.error("[Worker] ❌ Erro WebSocket:", error);
        // Adiciona mais detalhes do socket ao log de erro
        if (socket) {
            console.error(`[Worker] Estado do Socket: ${socket.readyState}, URL: ${socket.url}`);
        }
        self.postMessage({ type: 'status', status: 'error', message: 'Erro na conexão WebSocket com o Host.' });
        socket = null;
    };

    socket.onmessage = (event) => {
        messageBuffer += event.data;
        let jsonStartIndex = 0;
        while (jsonStartIndex < messageBuffer.length) {
            let startChar = messageBuffer[jsonStartIndex];
            if (startChar !== '{' && startChar !== '[') {
                jsonStartIndex++;
                continue;
            }
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
            if (jsonEndIndex !== -1) {
                const jsonString = messageBuffer.substring(jsonStartIndex, jsonEndIndex + 1);
                try {
                    const data = JSON.parse(jsonString);
                    processWebSocketMessage(data);
                } catch (e) {
                    console.error("[Worker] ❌ JSON inválido:", e);
                    console.error("[Worker] String problemática:", jsonString.substring(0, 100));
                }
                jsonStartIndex = jsonEndIndex + 1;
            } else {
                break;
            }
        }
        messageBuffer = messageBuffer.substring(jsonStartIndex);
        if (messageBuffer.length > 10000) {
            console.warn("[Worker] ⚠️ Buffer muito grande, limpando...");
            messageBuffer = "";
        }
    };
}

/**
 * Processa uma mensagem WebSocket completa (JSON já parseado)
 */
function processWebSocketMessage(data) {
    if (Array.isArray(data)) {
        // Array de leituras
        data.forEach(reading => {
            processDataPoint(reading);
        });
    }
    else if (typeof data === 'object' && data.type) {
        switch (data.type) {
            case "data":
                processDataPoint(data);
                break;

            case "config":
                if (data.gravity) {
                    gravity = parseFloat(data.gravity);
                }
                console.log("[Worker] CONFIGURAÇÃO RECEBIDA:", data);
                self.postMessage({ type: 'config', payload: data });
                break;

            case "success":
            case "error":
            case "info":
                // Retransmite a mensagem de status/erro do ESP8266
                self.postMessage({ type: 'status', status: data.type, message: data.message });
                break;
        }
    }
}

/**
 * Processa um ÚNICO ponto de dado recebido do ESP32.
 */
function processDataPoint(data) {
    if (data.type !== 'data') {
        console.log(`[Worker] ⚠️ Ignorando ponto que não é 'data'. Tipo: ${data.type}`);
        return;
    }

    const forceN = data.forca;
    //console.log(`[Worker] ⚡ Processando ponto: tempo=${data.tempo}s, força=${forceN}N`);

    if (forceN > maxForce) {
        maxForce = forceN;
    }

    const ema = getEmaValue(forceN);
    const massaKg = gravity > 0 ? forceN / gravity : 0;

    dataBuffer.push({
        tempo: data.tempo,
        forca: forceN,
        ema: ema,
        maxForce: maxForce,
        massaKg: massaKg
    });

    //console.log(`[Worker] 📦 Buffer agora tem ${dataBuffer.length} pontos`);

    // --- RPS USANDO TEMPO DO MICROCONTROLADOR ---
    if (lastTempoMCU !== null) {
        const deltaTempo = data.tempo - lastTempoMCU;
        if (deltaTempo > 0) {
            const rpsInstantaneo = 1 / deltaTempo;
            rpsCalculadoMCU = (rpsCalculadoMCU * totalLeiturasMCU + rpsInstantaneo) / (totalLeiturasMCU + 1);
            totalLeiturasMCU++;
        }
    }
    lastTempoMCU = data.tempo;
}

/**
 * Calcula a Média Móvel Exponencial (EMA).
 */
function getEmaValue(newValue) {
    if (!emaInitialized) {
        emaValue = newValue;
        emaInitialized = true;
    } else {
        emaValue = (emaAlpha * newValue) + ((1 - emaAlpha) * emaValue);
    }
    return emaValue;
}

/**
 * Manipulador de mensagens vindas da thread principal (UI, script.js).
 */
self.onmessage = (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'set_ws_url':
            if (payload && payload.url) {
                wsURL = payload.url;
                console.log(`[Worker] URL do WebSocket definida para: ${wsURL}`);
                // Força a reconexão se o socket já existir e estiver fechado
                if (socket && socket.readyState === WebSocket.CLOSED) {
                    connectWebSocket();
                }
            }
            break;

        case 'solicitarDados':
            if (dataBuffer.length > 0) {
                //  console.log(`[Worker] 📤 Enviando ${dataBuffer.length} pontos para a UI`);
                self.postMessage({ type: 'dadosDisponiveis', payload: dataBuffer });
                dataBuffer = [];
            } else {
                //  console.log(`[Worker] 🔭 Buffer vazio, nada para enviar`);
            }
            break;

        case 'getRPS':
            self.postMessage({ type: 'rps', payload: rpsCalculadoMCU.toFixed(1) });
            break;
            
        case 'sendCommand':
            // CORREÇÃO CRÍTICA: Verifica se o socket está conectado ANTES de processar
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                console.error("[Worker] ❌ WebSocket não está conectado! Estado:", socket ? socket.readyState : 'null');
                self.postMessage({ 
                    type: 'status', 
                    status: 'error', 
                    message: 'Erro: WebSocket não conectado. Não foi possível enviar o comando.' 
                });
                return; // SAI IMEDIATAMENTE
            }

            // NOVO: Log detalhado do payload recebido
            console.log(`[Worker] 📤 Comando recebido da UI: "${payload}"`);

            const commandObject = {};

            // Comando de Tara
            if (payload === 't') {
                commandObject.cmd = 't';
                console.log('[Worker] ✅ Comando de TARA identificado');
            }

            // Comando 'get_config'
            else if (payload === 'get_config') {
                commandObject.cmd = 'get_config';
                console.log('[Worker] ✅ Comando GET_CONFIG identificado');
            }

            // Comando de Calibração: c:1000
            else if (payload.startsWith('c:')) {
                const mass = parseFloat(payload.substring(2));
                if (isNaN(mass) || mass <= 0) {
                    console.error("[Worker] ❌ Comando 'c:' inválido. Massa não numérica ou <= 0.");
                    self.postMessage({ type: 'status', status: 'error', message: 'Massa de calibração inválida.' });
                    return; // CRÍTICO: SAI IMEDIATAMENTE.
                }
                commandObject.cmd = 'c';
                commandObject.massa_g = mass;
                console.log(`[Worker] ✅ Comando de CALIBRAÇÃO identificado com massa: ${mass}g`);
            }

            // CORREÇÃO: Comando Set Param: set_param:gravity:9.81
            else if (payload.startsWith('set_param:')) {
                console.log(`[Worker] 🔧 Processando comando set_param: "${payload}"`);
                
                // Remove o prefixo 'set_param:' e divide o resto
                const paramsString = payload.substring(10); // Remove 'set_param:'
                const parts = paramsString.split(':');
                
                console.log(`[Worker] 🔍 Partes após split: [${parts.join(', ')}]`);
                
                if (parts.length === 2) {
                    const param = parts[0].trim();
                    const value = parseFloat(parts[1]);

                    console.log(`[Worker] 📝 Parâmetro: "${param}", Valor: ${value}`);

                    if (isNaN(value)) {
                        console.error(`[Worker] ❌ Comando 'set_param' inválido para ${param}. Valor não numérico: "${parts[1]}"`);
                        self.postMessage({ 
                            type: 'status', 
                            status: 'error', 
                            message: `Erro: Valor inválido para ${param}` 
                        });
                        return; // CRÍTICO: SAI IMEDIATAMENTE.
                    }

                    commandObject.cmd = 'set';
                    commandObject.param = param;
                    commandObject.value = value;
                    
                    console.log(`[Worker] ✅ Comando SET_PARAM montado:`, commandObject);
                } else {
                    console.error(`[Worker] ❌ Formato inválido para set_param. Esperado 2 partes, recebido ${parts.length}`);
                    self.postMessage({ 
                        type: 'status', 
                        status: 'error', 
                        message: 'Formato de comando inválido' 
                    });
                    return;
                }
            }

            // Comando desconhecido
            else {
                console.warn(`[Worker] ⚠️ Payload desconhecido: "${payload}"`);
                self.postMessage({ 
                    type: 'status', 
                    status: 'error', 
                    message: `Comando desconhecido: ${payload}` 
                });
                return;
            }

            // Envia a string JSON para o Host, SOMENTE SE commandObject.cmd FOI DEFINIDO
            if (commandObject.cmd) {
                const jsonCommand = JSON.stringify(commandObject);
                console.log(`[Worker] 🚀 Enviando para WebSocket: ${jsonCommand}`);
                
                try {
                    socket.send(jsonCommand);
                    console.log(`[Worker] ✅ Comando enviado com sucesso`);
                    
                    // Notifica a UI sobre o envio bem-sucedido
                    self.postMessage({ 
                        type: 'status', 
                        status: 'info', 
                        message: `Comando "${commandObject.cmd}" enviado ao ESP32` 
                    });
                } catch (error) {
                    console.error(`[Worker] ❌ Erro ao enviar comando:`, error);
                    self.postMessage({ 
                        type: 'status', 
                        status: 'error', 
                        message: `Erro ao enviar comando: ${error.message}` 
                    });
                }
            } else {
                console.error(`[Worker] ❌ commandObject.cmd não foi definido!`);
            }
            break;
    }
};


/**
 * Inicia o Gerenciador de Conexão.
 * Este loop verifica o estado da conexão a cada 5 segundos e tenta conectar se necessário.
 */
setInterval(() => {
    if (socket == null || socket.readyState === WebSocket.CLOSED) {
        console.log("Tentando reconectar ao WebSocket do Host...");
        connectWebSocket();
    }
}, 5000);