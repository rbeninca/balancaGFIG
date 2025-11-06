#!/bin/bash

# Detectar a interface Wi-Fi real (ignora interfaces p2p-dev)
iface=$(nmcli device | grep wifi | awk '{print $1}' | grep -v '^p2p-' | head -n 1)

# Verificação de existência da interface
if [ -z "$iface" ]; then
  echo "❌ Nenhuma interface Wi-Fi válida encontrada."
  exit 1
fi

# Nome da conexão
con_name="BenincaGaspar"
ssid="gfig_pc"
password="aabbccddee"

# Apagar conexão anterior com mesmo nome, se existir
nmcli connection delete "$con_name" &>/dev/null

# Criar a conexão como Access Point
nmcli connection add type wifi ifname "$iface" mode ap con-name "$con_name" ssid "$ssid"

# Configurar segurança WPA2 com senha
nmcli connection modify "$con_name" wifi-sec.key-mgmt wpa-psk
nmcli connection modify "$con_name" wifi-sec.psk "$password"

# Ativar compartilhamento de internet (NAT)
nmcli connection modify "$con_name" ipv4.method shared

# Subir o hotspot
nmcli connection up "$con_name"

# Mostrar mensagem de sucesso
echo "✅ Ponto de acesso '$ssid' ativado na interface '$iface' com a senha '$password'"

