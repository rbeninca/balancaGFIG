#!/bin/bash
set -e

echo "==================================="
echo "  Balança GFIG - Iniciando"
echo "==================================="

# Verifica se o dispositivo serial existe
if [ -e "${SERIAL_PORT}" ]; then
    echo "✓ Dispositivo serial encontrado: ${SERIAL_PORT}"
    ls -la "${SERIAL_PORT}"
else
    echo "⚠️  Dispositivo serial não encontrado: ${SERIAL_PORT}"
    echo "    O servidor iniciará mesmo assim e tentará reconectar automaticamente."
    echo "    Conecte o dispositivo USB e o servidor detectará automaticamente."
fi

# Lista todos os dispositivos USB disponíveis
echo ""
echo "Dispositivos USB disponíveis:"
ls -la /dev/tty* 2>/dev/null | grep -E "USB|ACM" || echo "  Nenhum dispositivo USB encontrado"

echo ""
echo "Iniciando servidor Python..."
echo "==================================="
echo ""

# Executa o comando passado como argumento
exec "$@"
