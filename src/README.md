# Balança GFIG 
## Introdução
Este repositório contém o código-fonte para a balança GFIG, um projeto de código aberto que visa fornecer uma solução de pesagem acessível e eficiente, com alta frequência de precisão e capacidade de registro dos dados.
A finalidade inicial é que o projeto da balança seja utilizada em projetos de foguete modelismo do grupo de foguetes do campus Gaspar, mas foi projetada para que possa ter uso flexível em diferentes cenários, por isso pode ser facilmente adaptada para outras aplicações, por meio de plugins e módulos adicionais, que podem ser desenvolvuidos por terceiros.
O projeto é baseado em um microcontrolador ESP8266 com display integrado denominado esp8266+hw364 e modulo hx711, que é um conversor analógico-digital (ADC) de alta precisão, ideal para aplicações de pesagem. O módulo hx711 é amplamente utilizado em balanças eletrônicas devido à sua capacidade de medir pequenas variações de tensão, o que é essencial para obter leituras precisas de peso.

## Componentes
- **ESP8266**: Um microcontrolador com conectividade Wi-Fi, ideal para aplicações de Internet das Coisas (IoT).
- **HX711**: Um conversor analógico-digital (ADC) de alta precisão, utilizado para medir sinais de peso.
- **Display**: Um display integrado para exibir as leituras de peso e outras informações relevantes.(opcional), no projeto foi utilizado o display esp8266+hw364, mas foi testado também para uso do esp8266 sem display, neste caso apenas não deve-se ser utilizado os pinos do display.
- **Fonte de Alimentação**: Uma fonte de alimentação adequada para o ESP8266 e o módulo HX711, garantindo que o sistema funcione de maneira estável e eficiente.
- **Célula de Carga**: Um sensor de peso que converte a força aplicada em um sinal elétrico, que é então processado pelo HX711 para obter a leitura de peso.


<!--json protoloco  de messagens do via websocket , a ideia é que o json seja um array de messagens, podendo cada array conter multiplas mensagens -->
## Protocolo de Mensagens
As mensagens são enviadas via WebSocket e seguem o seguinte formato JSON:
```json
[
  {
    "type": "weight",        // tipo de mensagem
    "ts": 1723200123456,     // timestamp em ms desde epoch, datetime 
    "f": 12.347,             // força em Newtons (pós-fator, já com tara e g)
    "raw": 834512,           // leitura bruta do HX711 (opcional)
    "stable": true,          // leitura estável (filtro/variação baixa)
    "tare": -0.123,          // offset de tara aplicado (N)
    "g": 9.80665,            // gravidade usada
    "factor": 12345.    67       // fator de conversão raw->N
  },
  {
    "type": "status",        // tipo de mensagem
    "ts": 1723200123456,     // timestamp em ms desde epoch, datetime 
    "status": "ok",          // status da balança (ok, error, calibrating, etc.)
    "message": "Balança pronta para uso" // mensagem adicional
    "heap": 12345,        // heap disponível no ESP8266
    "uptime": 3600,       // tempo de atividade em segundos
    "version": "1.0.0"    // versão do firmware
    },  
  { "type": "calibration",   // tipo de mensagem
        "ts": 1723200123456,     // timestamp em ms desde epoch, datetime 
        "factor": 12345.67,      // fator de calibração usado
        "tare": -0.123,          // offset de tara aplicado (N)
        "data": [1.23, 2.34, 3.45], // dados de calibração (opcional)
        "message": "Calibração concluída com sucesso" // mensagem adicional
  },
  {"type": "error",         // tipo de mensagem
    "ts": 1723200123456,     // timestamp em ms desde epoch, datetime 
    "code": 404,             // código de erro
    "message": "Erro ao conectar ao HX711" // mensagem de erro 
  },
  {
    "type": "config",        // tipo de mensagem
    "ts": 1723200123456,     // timestamp em ms desde epoch, datetime 
    "config": {              // configuração atual da balança
      "unit": "kg",          // unidade de medida (kg, g, lb, oz)
      "tare": -0.123,        // offset de tara aplicado (N)
      "factor": 12345.67     // fator de conversão raw->N
      "display": {             // configuração do display (opcional)
        "enabled": true,      // se o display está habilitado
        "brightness": 80,     // brilho do display (0-100)
        "timeout": 30000      // tempo de desligamento automático em ms
      },
        "wifiClient": {              // configuração de Wi-Fi (opcional)
            "ssid": "nome_da_rede", // SSID da rede Wi-Fi
            "password": "senha_da_rede", // senha da rede Wi-Fi
            "enabled": true,       // se o Wi-Fi está habilitado
            "ipv6": true, // se o IPv6 está habilitado
        },
        "wifiSTA": {             // configuração de Wi-Fi (opcional)
            "ssid": "nome_da_rede", // SSID da rede Wi-Fi
            "password": "senha_da_rede", // senha da rede Wi-Fi
            "enabled": true,       // se o Wi-Fi está habilitado
            "ip": "192.168.1.100"
            
        },
      "mqtt": {              // configuração do MQTT (opcional)
        "enabled": true,      // se o MQTT está habilitado
        "broker": "mqtt://broker.hivemq.com", // URL do broker MQTT
        "port": 1883,         // porta do broker MQTT
        "topic": "balanca/gfig" // tópico para publicar as mensagens
      },
      "http": {              // configuração do HTTP (opcional)
        "enabled": true,      // se o HTTP está habilitado
        "port": 80,           // porta do servidor HTTP
        "path": "/api/weight", // caminho para acessar as mensagens de peso
        "cors": true,         // se CORS está habilitado
        "auth": {             // configuração de autenticação (opcional)
          "enabled": false,   // se a autenticação está habilitada
          "username": "user",  // nome de usuário
          "password": "pass"    // senha
        }
      },
      "websocket": {         // configuração do WebSocket (opcional)
        "enabled": true,      // se o WebSocket está habilitado
        "port": 8080,         // porta do WebSocket
        "path": "/ws"         // caminho do WebSocket
      }
    }
  }
]
```
Os endpoints de comunicação são fixos. As mensagens podem ser enviadas e recebidas via WebSocket, HTTP ou MQTT, dependendo da configuração escolhida. Os endpoints são:

## Comunicação por WebSocket
A balança GFIG pode ser acessada via WebSocket, permitindo uma comunicação em tempo real. O WebSocket é configurado para enviar mensagens de peso, status, calibração e erros.
- **WebSocket**: `/ws` para receber mensagens em tempo real.
- **Mensagens de Peso**: `/api/weight` para obter as últimas leituras de peso.
- **Mensagens de Status**: `/api/status` para obter o status atual da balança, incluindo informações sobre o heap, uptime e versão do firmware, cliente Wi-Fi, MQTT e HTTP.
- **Mensagens de Calibração**: `/api/calibration` para iniciar ou obter o status da calibração.
- **Mensagens de Erro**: `/api/error` para obter informações sobre erros ocorridos.
- **Mensagens de Configuração**: `/api/config` para obter ou atualizar a configuração da balança.
- **Mensagens de Tara**: `/api/tare` para aplicar ou remover a tara.
- **Mensagens de Wi-Fi**: `/api/wifi` para obter ou atualizar as configurações de Wi-Fi.
- **Mensagens de MQTT**: `/api/mqtt` para obter ou atualizar as configurações de MQTT.
- **Mensagens de HTTP**: `/api/http` para obter ou atualizar as configurações de HTTP.
- **Mensagens de WebSocket**: `/api/websocket` para obter ou atualizar as configurações do WebSocket.


## Comunicação por USB ou Serial
Por usb ou serial, o protocolo é o mesmo, mas as mensagens são enviadas como strings JSON, com cada mensagem em uma linha separada. O formato é o mesmo, mas sem a estrutura de array.

















## Características
- 
 A balança é projetada para ser usada em diversas aplicações, desde o uso doméstico até o industrial, e é baseada em componentes eletrônicos comuns.