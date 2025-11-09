import asyncio
import websockets
import json

async def test_get_config():
    """
    Connects to the WebSocket server, sends a get_config command,
    and prints the response.
    """
    uri = "ws://localhost:81"
    try:
        async with websockets.connect(uri) as websocket:
            print(f"--- Conectado a {uri} ---")
            
            # Envia o comando get_config
            command = {"cmd": "get_config"}
            await websocket.send(json.dumps(command))
            print(f"Enviado: {json.dumps(command)}")
            
            # Ouve a resposta. O servidor deve continuar enviando pacotes de dados
            # e também o pacote de status que configuramos como resposta de teste.
            print("--- Aguardando respostas (5 segundos) ---")
            try:
                for _ in range(10): # Tenta ler várias mensagens
                    response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    print(f"Recebido: {response}")
            except asyncio.TimeoutError:
                print("--- Nenhuma resposta recebida em 5 segundos. ---")
                
    except Exception as e:
        print(f"Ocorreu um erro: {e}")

if __name__ == "__main__":
    asyncio.run(test_get_config())
