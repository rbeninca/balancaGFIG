# Docker com Suporte USB Opcional

## O que mudou?

Agora o container Docker pode iniciar **mesmo sem o dispositivo USB conectado**! 🎉

### Antes
- ❌ Docker Compose falhava se `/dev/ttyUSB0` não existisse
- ❌ Container não iniciava sem o dispositivo
- ❌ Necessário conectar USB antes de fazer `docker compose up`

### Agora
- ✅ Docker Compose inicia normalmente sem USB
- ✅ Servidor Python detecta automaticamente quando USB é conectado
- ✅ Reconexão automática se USB for desconectado
- ✅ Interface web mostra status claro da conexão

## Como Usar

### Iniciar o Sistema

```bash
# Inicia o sistema (funciona com ou sem USB conectado)
docker compose up -d

# Ver logs
docker compose logs -f balanca
```

### Conectar o Dispositivo USB Depois

1. Conecte o ESP32/NodeMCU via USB
2. Verifique qual porta foi criada:
   ```bash
   ls -la /dev/ttyUSB* /dev/ttyACM*
   ```
3. Se necessário, ajuste permissões:
   ```bash
   sudo chmod 666 /dev/ttyUSB0
   ```
4. O servidor detectará automaticamente em até 5 segundos!

### Verificar Status

```bash
# Ver logs do container
docker compose logs -f balanca

# Acessar a interface web
firefox http://localhost
```

## Troubleshooting

### O dispositivo não é detectado automaticamente

1. **Verifique se o dispositivo existe:**
   ```bash
   ls -la /dev/ttyUSB*
   ```

2. **Verifique as permissões:**
   ```bash
   sudo chmod 666 /dev/ttyUSB0
   ```

3. **Adicione seu usuário ao grupo dialout:**
   ```bash
   sudo usermod -a -G dialout $USER
   # Depois faça logout e login novamente
   ```

4. **Reinicie o container:**
   ```bash
   docker compose restart balanca
   ```

### Trocar a porta serial padrão

Edite o `docker-compose.yml`:

```yaml
environment:
  SERIAL_PORT: "/dev/ttyACM0"  # Mudou de ttyUSB0 para ttyACM0
```

Depois:
```bash
docker compose down
docker compose up -d
```

## Logs do Entrypoint

Quando o container inicia, você verá:

```
===================================
  Balança GFIG - Iniciando
===================================
⚠️  Dispositivo serial não encontrado: /dev/ttyUSB0
    O servidor iniciará mesmo assim e tentará reconectar automaticamente.
    Conecte o dispositivo USB e o servidor detectará automaticamente.

Dispositivos USB disponíveis:
  Nenhum dispositivo USB encontrado

Iniciando servidor Python...
===================================
```

Quando o USB for conectado:
```
✓ Dispositivo serial encontrado: /dev/ttyUSB0
crw-rw-rw- 1 root dialout 188, 0 Nov  6 20:45 /dev/ttyUSB0
```

## Arquitetura

### Componentes

1. **docker-entrypoint.sh**: Script que verifica dispositivos USB antes de iniciar
2. **server.py**: Servidor Python com reconexão automática
3. **docker-compose.yml**: Configuração com modo privilegiado para acesso a `/dev`

### Fluxo de Inicialização

```
Docker Compose Start
        ↓
docker-entrypoint.sh
        ↓
Verifica /dev/ttyUSB0
        ↓
    ┌─────┴─────┐
    ↓           ↓
 Existe     Não Existe
    ↓           ↓
  Log ✓     Log ⚠️
    └─────┬─────┘
          ↓
   Inicia Python
          ↓
   serial_reader()
          ↓
   Loop de Conexão
          ↓
   ┌─────┴─────┐
   ↓           ↓
Conectado  Tentando...
   ↓           ↓
Broadcast  Sleep 5s
  Status    e Retry
```

## Modo Privilegiado

O container roda em **modo privilegiado** para:
- Acessar dispositivos USB dinamicamente
- Detectar hotplug (conectar/desconectar USB em tempo real)
- Ajustar permissões de dispositivos

**Segurança**: Use apenas em ambientes confiáveis. Se necessário, você pode remover `privileged: true` e usar apenas os `devices` específicos, mas perderá a detecção automática de hotplug.

## Alternativa Sem Modo Privilegiado

Se não quiser usar modo privilegiado, pode voltar à abordagem antiga:

```yaml
# docker-compose.yml
devices:
  - "/dev/ttyUSB0:/dev/ttyUSB0"

# Remover:
# privileged: true
# - /dev:/dev:rw
```

Mas neste caso você precisa conectar o USB **antes** de fazer `docker compose up`.
