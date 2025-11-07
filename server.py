import asyncio
import websockets
import serial
import serial.tools.list_ports
import threading
import http.server
import socket
import socketserver
import os
import json
import logging
import struct
import time
from typing import Optional, Dict, Any
import pymysql.cursors
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# ================== Calculation Helpers ==================
def classificar_motor(impulso_ns):
    """Classifica um motor baseado no seu impulso total em Ns."""
    EPS = 1e-6
    classificacoes = [
        {"min": 0.00, "max": 0.3125, "classe": 'Micro 1/8A', "cor": '#8e44ad'},
        {"min": 0.3126, "max": 0.625, "classe": '¼A', "cor": '#9b59b6'},
        {"min": 0.626, "max": 1.25, "classe": '½A', "cor": '#e74c3c'},
        {"min": 1.26, "max": 2.50, "classe": 'A', "cor": '#e67e22'},
        {"min": 2.51, "max": 5.00, "classe": 'B', "cor": '#f39c12'},
        {"min": 5.01, "max": 10.00, "classe": 'C', "cor": '#f1c40f'},
        {"min": 10.01, "max": 20.00, "classe": 'D', "cor": '#2ecc71'},
        {"min": 20.01, "max": 40.00, "classe": 'E', "cor": '#1abc9c'},
        {"min": 40.01, "max": 80.00, "classe": 'F', "cor": '#3498db'},
        {"min": 80.01, "max": 160.00, "classe": 'G', "cor": '#9b59b6'},
        {"min": 160.01, "max": 320.00, "classe": 'H', "cor": '#e74c3c'},
        {"min": 320.01, "max": 640.00, "classe": 'I', "cor": '#e67e22'},
        {"min": 640.01, "max": 1280.00, "classe": 'J', "cor": '#f39c12'},
        {"min": 1280.01, "max": 2560.00, "classe": 'K', "cor": '#2ecc71'},
        {"min": 2560.01, "max": 5120.00, "classe": 'L', "cor": '#3498db'},
        {"min": 5120.01, "max": 10240.00, "classe": 'M', "cor": '#9b59b6'},
        {"min": 10240.01, "max": 20480.00, "classe": 'N', "cor": '#e74c3c'},
        {"min": 20480.01, "max": 40960.00, "classe": 'O', "cor": '#c0392b'},
    ]
    if impulso_ns is None:
        return {"classe": 'Indefinido', "cor": '#95a5a6'}
    for c in classificacoes:
        if (c["min"] - EPS) <= impulso_ns <= (c["max"] + EPS):
            return {"classe": c["classe"], "cor": c["cor"]}
    return {"classe": 'Indefinido', "cor": '#95a5a6'}

def calcular_impulso_total(tempos, forcas):
    """Calcula o impulso total positivo de uma série de leituras de força."""
    if not tempos or not forcas or len(tempos) != len(forcas) or len(tempos) < 2:
        return 0
    
    impulso_total_positivo = 0
    for i in range(len(tempos) - 1):
        # Garante que os valores são numéricos
        try:
            delta_t = float(tempos[i+1]) - float(tempos[i])
            f1 = float(forcas[i])
            f2 = float(forcas[i+1])
        except (ValueError, TypeError):
            continue # Pula iteração se houver dados inválidos

        # Apenas considera a área do trapézio se ela for positiva
        # Isso corresponde à lógica do frontend que usa `areaPositiva`
        area_trap = delta_t * (f1 + f2) / 2
        if area_trap > 0:
            impulso_total_positivo += area_trap
            
    return impulso_total_positivo


"""
Binary Protocol Server - Balança GFIG (IPv4 + IPv6)
- Supports multiple binary packet types
- Converts binary → JSON for WebSocket clients
- Converts JSON commands → binary for ESP32
- HTTP and WebSocket servers listen on IPv6 (::) with dual-stack when available
"""

# ================== Config ==================
SERIAL_BAUD = int(os.environ.get("SERIAL_BAUD", "921600"))
SERIAL_PORT = os.environ.get("SERIAL_PORT", "/dev/ttyUSB0")
HTTP_PORT   = int(os.environ.get("HTTP_PORT", "80"))
WS_PORT     = int(os.environ.get("WS_PORT", "81"))
BIND_HOST   = os.environ.get("BIND_HOST", "0.0.0.0")
V6ONLY_ENV  = os.environ.get("IPV6_V6ONLY", "0")

# MySQL Config
MYSQL_HOST = os.environ.get("MYSQL_HOST", "db")
MYSQL_USER = os.environ.get("MYSQL_USER", "balanca_user")
MYSQL_PASSWORD = os.environ.get("MYSQL_PASSWORD", "balanca_password")
MYSQL_DB = os.environ.get("MYSQL_DB", "balanca_gfig")
MYSQL_ROOT_PASSWORD = os.environ.get("MYSQL_ROOT_PASSWORD", "Hilquias")

# Binary Protocol Constants
MAGIC = 0xA1B2
VERSION = 0x01

# Packet Types
TYPE_DATA        = 0x01
TYPE_CONFIG      = 0x02
TYPE_STATUS      = 0x03
CMD_TARA         = 0x10
CMD_CALIBRATE    = 0x11
CMD_GET_CONFIG   = 0x12
CMD_SET_PARAM    = 0x13

# Packet sizes
SIZE_DATA       = 16
SIZE_CONFIG     = 64
SIZE_STATUS     = 14
SIZE_CMD_TARA   = 8
SIZE_CMD_CALIB  = 10
SIZE_CMD_GETCONF = 8
SIZE_CMD_SETPAR = 18

logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logging.info(f"Configuração de BIND_HOST: {BIND_HOST}")
logging.info(f"Configuração de IPV6_V6ONLY: {V6ONLY_ENV}")
logging.info(f"MySQL DB: {MYSQL_DB}")
logging.info(f"MYSQL_DB from env: {os.environ.get('MYSQL_DB')}")

CONNECTED_CLIENTS = set()
serial_connection: Optional[serial.Serial] = None
serial_lock = threading.Lock()
mysql_connection = None
mysql_connected = False
serial_connected = False
serial_last_error = None

# ================== MySQL Utils ==================
def connect_to_mysql():
    global mysql_connection, mysql_connected

    # Validate existing connection with ping
    if mysql_connection:
        try:
            mysql_connection.ping(reconnect=False)
            if mysql_connection.open:
                return mysql_connection
        except (pymysql.Error, AttributeError):
            logging.warning("Conexão MySQL existente está inválida, criando nova conexão...")
            mysql_connection = None
            mysql_connected = False

    max_retries = 3
    for attempt in range(max_retries):
        try:
            mysql_connection = pymysql.connect(
                host=MYSQL_HOST,
                user=MYSQL_USER,
                password=MYSQL_PASSWORD,
                database=MYSQL_DB,
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=5,
                autocommit=False,
                charset='utf8mb4'
            )
            logging.info("Conectado ao MySQL com sucesso!")
            mysql_connected = True
            return mysql_connection
        except pymysql.Error as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** (attempt + 1)
                logging.warning(f"Erro ao conectar ao MySQL (tentativa {attempt + 1}/{max_retries}): {e}. Aguardando {wait_time}s...")
                time.sleep(wait_time)
            else:
                logging.error(f"Erro ao conectar ao MySQL após {max_retries} tentativas: {e}")
                mysql_connected = False
                mysql_connection = None
                return None

def init_mysql_db():
    global mysql_connection, mysql_connected
    max_retries = 5
    retry_count = 0
    
    # Connect as root to create the database and grant privileges
    while retry_count < max_retries:
        try:
            root_conn = pymysql.connect(
                host=MYSQL_HOST, user="root", password=MYSQL_ROOT_PASSWORD,
                cursorclass=pymysql.cursors.DictCursor, connect_timeout=5
            )
            with root_conn.cursor() as cursor:
                cursor.execute(f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DB}`")
                cursor.execute(f"GRANT ALL PRIVILEGES ON `{MYSQL_DB}`.* TO '{MYSQL_USER}'@'%'")
                cursor.execute("FLUSH PRIVILEGES")
            root_conn.close()
            logging.info(f"Database '{MYSQL_DB}' created/verified and privileges granted.")
            break
        except pymysql.Error as e:
            retry_count += 1
            wait_time = 2 ** retry_count  # exponential backoff: 2, 4, 8, 16, 32 seconds
            if retry_count < max_retries:
                logging.warning(f"Erro ao conectar ao MySQL (tentativa {retry_count}/{max_retries}): {e}. Aguardando {wait_time}s...")
                time.sleep(wait_time)
            else:
                logging.error(f"Não foi possível criar o banco de dados '{MYSQL_DB}' após {max_retries} tentativas: {e}")
                mysql_connected = False
                return

    # Now connect as balanca_user to the specific database to create tables
    mysql_connection = connect_to_mysql()

    if mysql_connection:
        try:
            with mysql_connection.cursor() as cursor:
                sql_sessoes_create = """
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
                    motor_observations TEXT,
                    impulso_total FLOAT,
                    motor_class VARCHAR(50),
                    class_color VARCHAR(20),
                    burn_start_time FLOAT,
                    burn_end_time FLOAT
                )
                """
                cursor.execute(sql_sessoes_create)

                # Migrate existing table to add motor metadata columns if they don't exist
                motor_columns = [
                    ('data_modificacao', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
                    ('motor_name', 'VARCHAR(255)'),
                    ('motor_diameter', 'FLOAT'),
                    ('motor_length', 'FLOAT'),
                    ('motor_delay', 'FLOAT'),
                    ('motor_propweight', 'FLOAT'),
                    ('motor_totalweight', 'FLOAT'),
                    ('motor_manufacturer', 'VARCHAR(255)'),
                    ('motor_description', 'TEXT'),
                    ('motor_observations', 'TEXT'),
                    ('motor_temperatura', 'FLOAT'),
                    ('motor_umidade', 'FLOAT'),
                    ('motor_pressao', 'FLOAT'),
                    ('impulso_total', 'FLOAT'),
                    ('motor_class', 'VARCHAR(50)'),
                    ('class_color', 'VARCHAR(20)'),
                    ('burn_start_time', 'FLOAT'),
                    ('burn_end_time', 'FLOAT')
                ]

                for column_name, column_type in motor_columns:
                    try:
                        cursor.execute(f"ALTER TABLE sessoes ADD COLUMN {column_name} {column_type}")
                        logging.info(f"Coluna '{column_name}' adicionada à tabela 'sessoes'")
                    except pymysql.Error as e:
                        # Column already exists (error 1060), ignore
                        if e.args[0] != 1060:
                            logging.warning(f"Erro ao adicionar coluna '{column_name}': {e}")

                sql_leituras_create = """
                CREATE TABLE IF NOT EXISTS leituras (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    sessao_id BIGINT NOT NULL,
                    tempo FLOAT,
                    forca FLOAT,
                    ema FLOAT,
                    massaKg FLOAT,
                    timestamp DATETIME(3),
                    FOREIGN KEY (sessao_id) REFERENCES sessoes(id) ON DELETE CASCADE
                )
                """
                cursor.execute(sql_leituras_create)

            mysql_connection.commit()
            logging.info(f"Banco de dados '{MYSQL_DB}' e tabelas 'sessoes', 'leituras' verificadas/criadas.")

            # Migrate existing sessions to calculate impulse if not already calculated
            migrate_existing_sessions()

        except pymysql.Error as e:
            logging.error(f"Erro ao inicializar o banco de dados MySQL: {e}")
            mysql_connected = False
    else:
        logging.warning("Não foi possível inicializar o banco de dados MySQL: conexão não estabelecida.")

def migrate_existing_sessions():
    """Calculate and update impulso_total, motor_class, and class_color for existing sessions"""
    global mysql_connection
    if not mysql_connection or not mysql_connection.open:
        return

    try:
        with mysql_connection.cursor() as cursor:
            # Find sessions without calculated impulse
            cursor.execute("""
                SELECT id FROM sessoes
                WHERE impulso_total IS NULL OR motor_class IS NULL
            """)
            sessions_to_migrate = cursor.fetchall()

            if not sessions_to_migrate:
                logging.info("Nenhuma sessão precisa de migração de impulso.")
                return

            logging.info(f"Migrando {len(sessions_to_migrate)} sessões para calcular impulso...")

            for session in sessions_to_migrate:
                session_id = session['id']

                # Fetch readings for this session
                cursor.execute("""
                    SELECT tempo, forca FROM leituras
                    WHERE sessao_id = %s ORDER BY tempo ASC
                """, (session_id,))
                leituras = cursor.fetchall()

                if leituras:
                    tempos = [float(l['tempo']) for l in leituras if l['tempo'] is not None]
                    forcas = [float(l['forca']) for l in leituras if l['forca'] is not None]

                    impulso_total = calcular_impulso_total(tempos, forcas)
                    classificacao = classificar_motor(impulso_total)

                    # Update session with calculated values
                    cursor.execute("""
                        UPDATE sessoes
                        SET impulso_total = %s, motor_class = %s, class_color = %s
                        WHERE id = %s
                    """, (impulso_total, classificacao['classe'], classificacao['cor'], session_id))

                    logging.info(f"Sessão {session_id}: Impulso={impulso_total:.2f} Ns, Classe={classificacao['classe']}")
                else:
                    # No readings, set default values
                    cursor.execute("""
                        UPDATE sessoes
                        SET impulso_total = 0, motor_class = 'N/A', class_color = '#95a5a6'
                        WHERE id = %s
                    """, (session_id,))

            mysql_connection.commit()
            logging.info(f"Migração concluída: {len(sessions_to_migrate)} sessões atualizadas.")

    except pymysql.Error as e:
        logging.error(f"Erro durante migração de sessões: {e}")
        if mysql_connection:
            mysql_connection.rollback()

async def save_session_to_mysql_db(session_data: Dict[str, Any]):
    global mysql_connection, mysql_connected

    # Force fresh connection validation before saving
    mysql_connection = connect_to_mysql()
    if not mysql_connection or not mysql_connected:
        logging.error("Não foi possível conectar ao MySQL. Sessão não salva.")
        return False

    try:
        # Validate required fields
        if 'id' not in session_data:
            logging.error("session_data não contém o campo 'id'")
            return False
        if 'nome' not in session_data:
            logging.error("session_data não contém o campo 'nome'")
            return False
        if 'timestamp' not in session_data:
            logging.error("session_data não contém o campo 'timestamp'")
            return False

        logging.info(f"Salvando sessão '{session_data['nome']}' (ID: {session_data['id']}) no MySQL...")

        with mysql_connection.cursor() as cursor:
            dados_tabela = session_data.get('dadosTabela', [])

            # Parse data_inicio - prioritize data_inicio field from localStorage, fallback to timestamp
            data_inicio = None
            if 'data_inicio' in session_data and session_data['data_inicio']:
                try:
                    data_inicio = datetime.fromisoformat(session_data['data_inicio'].replace('Z', '+00:00'))
                    logging.info(f"Usando data_inicio do localStorage: {data_inicio}")
                except (ValueError, KeyError) as e:
                    logging.warning(f"Erro ao converter data_inicio: {e}, tentando timestamp...")

            if not data_inicio and 'timestamp' in session_data:
                try:
                    data_inicio = datetime.fromisoformat(session_data['timestamp'].replace('Z', '+00:00'))
                    logging.info(f"Usando timestamp como data_inicio: {data_inicio}")
                except (ValueError, KeyError) as e:
                    logging.error(f"Erro ao converter timestamp '{session_data.get('timestamp')}': {e}")
                    return False

            if not data_inicio:
                logging.error("session_data não contém data_inicio ou timestamp válidos")
                return False

            # Parse data_fim - prefer direct field from localStorage, fallback to last reading's timestamp
            data_fim = None
            if 'data_fim' in session_data and session_data['data_fim']:
                try:
                    data_fim = datetime.fromisoformat(session_data['data_fim'].replace('Z', '+00:00'))
                    logging.info(f"Usando data_fim do localStorage: {data_fim}")
                except (ValueError, KeyError) as e:
                    logging.warning(f"Erro ao converter data_fim direto: {e}")

            if not data_fim and dados_tabela:
                try:
                    # Timestamp format from frontend: '27/10/2025 15:13:06.334'
                    data_fim = datetime.strptime(dados_tabela[-1]['timestamp'], '%d/%m/%Y %H:%M:%S.%f')
                except (ValueError, IndexError, KeyError) as e:
                    logging.warning(f"Erro ao converter data_fim from reading, usando data_inicio: {e}")
                    data_fim = data_inicio

            if not data_fim:
                data_fim = data_inicio

            # Extract motor metadata
            metadados = session_data.get('metadadosMotor', {})
            motor_name = metadados.get('name')
            motor_diameter = metadados.get('diameter')
            motor_length = metadados.get('length')
            motor_delay = metadados.get('delay')
            motor_propweight = metadados.get('propweight')
            motor_totalweight = metadados.get('totalweight')
            motor_manufacturer = metadados.get('manufacturer')
            motor_description = metadados.get('description')
            motor_observations = metadados.get('observations')

            logging.info(f"Metadados do motor: name={motor_name}, diameter={motor_diameter}, length={motor_length}, "
                        f"delay={motor_delay}, propweight={motor_propweight}, totalweight={motor_totalweight}, "
                        f"manufacturer={motor_manufacturer}")

            # Calculate impulse and classification from readings
            impulso_total = 0
            motor_class = 'N/A'
            class_color = '#95a5a6'

            if dados_tabela:
                try:
                    tempos = [float(l.get('tempo_esp', 0)) for l in dados_tabela if l.get('tempo_esp') is not None]
                    forcas = [float(l.get('newtons', 0)) for l in dados_tabela if l.get('newtons') is not None]

                    if tempos and forcas and len(tempos) == len(forcas):
                        impulso_total = calcular_impulso_total(tempos, forcas)
                        classificacao = classificar_motor(impulso_total)
                        motor_class = classificacao['classe']
                        class_color = classificacao['cor']
                        logging.info(f"Impulso calculado: {impulso_total:.2f} Ns, Classe: {motor_class}")
                except (ValueError, TypeError, KeyError) as e:
                    logging.warning(f"Erro ao calcular impulso: {e}")

            sql_sessoes = """
            INSERT INTO sessoes (id, nome, data_inicio, data_fim, data_modificacao, motor_name, motor_diameter,
                                motor_length, motor_delay, motor_propweight, motor_totalweight, motor_manufacturer,
                                motor_description, motor_observations, motor_temperatura, motor_umidade, motor_pressao,
                                impulso_total, motor_class, class_color)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                nome = VALUES(nome),
                data_inicio = VALUES(data_inicio),
                data_fim = VALUES(data_fim),
                data_modificacao = VALUES(data_modificacao),
                motor_name = VALUES(motor_name),
                motor_diameter = VALUES(motor_diameter),
                motor_length = VALUES(motor_length),
                motor_delay = VALUES(motor_delay),
                motor_propweight = VALUES(motor_propweight),
                motor_totalweight = VALUES(motor_totalweight),
                motor_manufacturer = VALUES(motor_manufacturer),
                motor_description = VALUES(motor_description),
                motor_observations = VALUES(motor_observations),
                motor_temperatura = VALUES(motor_temperatura),
                motor_umidade = VALUES(motor_umidade),
                motor_pressao = VALUES(motor_pressao),
                impulso_total = VALUES(impulso_total),
                motor_class = VALUES(motor_class),
                class_color = VALUES(class_color)
            """
            try:
                motor_temperatura = metadados.get('temperatura') if metadados else None
                motor_umidade = metadados.get('umidade') if metadados else None
                motor_pressao = metadados.get('pressao') if metadados else None

                # Parse data_modificacao - preserve from localStorage if exists, otherwise use current time
                data_modificacao = None
                if 'data_modificacao' in session_data and session_data['data_modificacao']:
                    try:
                        data_modificacao = datetime.fromisoformat(session_data['data_modificacao'].replace('Z', '+00:00'))
                        logging.info(f"Preservando data_modificacao do localStorage: {data_modificacao}")
                    except (ValueError, KeyError) as e:
                        logging.warning(f"Erro ao converter data_modificacao: {e}, usando data atual")
                        data_modificacao = datetime.now()
                else:
                    data_modificacao = datetime.now()
                    logging.info(f"data_modificacao não fornecido, usando data atual: {data_modificacao}")

                cursor.execute(sql_sessoes, (session_data['id'], session_data['nome'], data_inicio, data_fim, data_modificacao,
                                            motor_name, motor_diameter, motor_length, motor_delay,
                                            motor_propweight, motor_totalweight, motor_manufacturer,
                                            motor_description, motor_observations, motor_temperatura, motor_umidade, motor_pressao,
                                            impulso_total, motor_class, class_color))
                logging.info(f"Sessão inserida/atualizada: {session_data['nome']}")
            except pymysql.Error as e:
                logging.error(f"Erro ao inserir sessão: {type(e).__name__}: {e}")
                raise

            try:
                cursor.execute("DELETE FROM leituras WHERE sessao_id = %s", (session_data['id'],))
                logging.info(f"Leituras antigas deletadas para sessão {session_data['id']}")
            except pymysql.Error as e:
                logging.error(f"Erro ao deletar leituras antigas: {type(e).__name__}: {e}")
                raise

            if dados_tabela:
                sql_leituras = "INSERT INTO leituras (sessao_id, tempo, forca, massaKg, timestamp) VALUES (%s, %s, %s, %s, %s)"
                leituras_to_insert = []
                for i, leitura in enumerate(dados_tabela):
                    leitura_timestamp = None
                    try:
                        # Tenta primeiro com milissegundos
                        leitura_timestamp = datetime.strptime(leitura['timestamp'], '%d/%m/%Y %H:%M:%S.%f')
                    except (ValueError, KeyError) as e:
                        try:
                            # Se falhar, tenta sem milissegundos
                            leitura_timestamp = datetime.strptime(leitura.get('timestamp', ''), '%d/%m/%Y %H:%M:%S')
                        except (ValueError, KeyError) as e2:
                            logging.warning(f"Erro ao converter timestamp da leitura {i}: {leitura.get('timestamp')}, usando None")
                            leitura_timestamp = None

                    try:
                        # Safely convert to float, handling None values
                        tempo_esp = float(leitura.get('tempo_esp') or 0)
                        newtons = float(leitura.get('newtons') or 0)
                        quilo_forca = float(leitura.get('quilo_forca') or 0)
                        
                        leituras_to_insert.append((
                            session_data['id'],
                            tempo_esp,
                            newtons,
                            quilo_forca,
                            leitura_timestamp
                        ))
                    except (ValueError, TypeError, KeyError) as e:
                        logging.warning(f"Erro ao processar leitura {i}: {type(e).__name__}: {e}, pulando...")
                        continue

                if leituras_to_insert:
                    try:
                        cursor.executemany(sql_leituras, leituras_to_insert)
                        logging.info(f"Inseridas {len(leituras_to_insert)} leituras para sessão {session_data['id']}")
                    except pymysql.Error as e:
                        logging.error(f"Erro ao inserir leituras: {type(e).__name__}: {e}")
                        raise

        mysql_connection.commit()
        logging.info(f"Sessão '{session_data['nome']}' (ID: {session_data['id']}) salva/atualizada no MySQL com sucesso!")
        return True
    except pymysql.Error as e:
        logging.error(f"Erro de MySQL ao salvar sessão: {type(e).__name__}: {e}")
        mysql_connected = False
        if mysql_connection:
            try:
                mysql_connection.rollback()
            except:
                pass
            try:
                mysql_connection.close()
            except:
                pass
        mysql_connection = None
        return False
    except Exception as e:
        logging.error(f"Erro inesperado ao salvar sessão no MySQL: {type(e).__name__}: {e}", exc_info=True)
        if mysql_connection:
            try:
                mysql_connection.rollback()
            except:
                pass
        return False

# ================== HTTP Server & API ==================
class APIRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory='/app/data', **kwargs)

    def do_GET(self):
        start = time.perf_counter()
        try:
            if self.path == '/api/sessoes':
                self.handle_get_sessoes()
            elif self.path.startswith('/api/sessoes/') and self.path.endswith('/leituras'):
                self.handle_get_leituras()
            elif self.path.startswith('/api/sessoes/'):
                self.handle_get_sessao_by_id()
            elif self.path == '/api/time':
                self.handle_get_time()
            elif self.path == '/api/info':
                self.handle_get_info()
            else:
                super().do_GET()
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError) as e:
            logging.debug(
                f"Cliente desconectou durante requisição GET {self.path}: {type(e).__name__}"
            )
        except Exception as e:
            logging.error(
                f"Erro inesperado ao processar requisição GET {self.path}: {e}",
                exc_info=True
            )
        finally:
            elapsed = (time.perf_counter() - start) * 1000
            logging.info(f"GET {self.path} levou {elapsed:.1f} ms")

    def do_POST(self):
        try:
            if self.path == '/api/sessoes':
                self.handle_post_sessao()
            elif self.path == '/api/time/sync':
                self.handle_sync_time()
            elif self.path.startswith('/api/sessoes/') and self.path.endswith('/burn-metadata'):
                self.handle_update_burn_metadata()
            else:
                self.send_error(404, "Not Found")
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError) as e:
            logging.debug(
                f"Cliente desconectou durante requisição POST {self.path}: {type(e).__name__}"
            )
        except Exception as e:
            logging.error(
                f"Erro inesperado ao processar requisição POST {self.path}: {e}",
                exc_info=True
            )

    def do_DELETE(self):
        try:
            if self.path.startswith('/api/sessoes/'):
                self.handle_delete_sessao()
            else:
                self.send_error(404, "Not Found")
        except (ConnectionResetError, BrokenPipeError, ConnectionAbortedError) as e:
            # Cliente desconectou durante transferência - normal, não precisa logar erro
            logging.debug(f"Cliente desconectou durante requisição DELETE {self.path}: {type(e).__name__}")
        except Exception as e:
            # Outros erros devem ser logados
            logging.error(f"Erro inesperado ao processar requisição DELETE {self.path}: {e}", exc_info=True)

    def log_error(self, format, *args):
        """Sobrescreve log_error para suprimir erros comuns de conexão"""
        # Não loga erros de conexão que são esperados
        if args and len(args) > 0:
            error_msg = str(args[0]) if args[0] else ""
            # Ignora erros comuns de clientes desconectando
            if any(err in error_msg for err in ["Connection reset", "Broken pipe", "Connection aborted"]):
                return
        # Loga outros erros normalmente
        super().log_error(format, *args)

    def handle_get_sessoes(self):
        if not mysql_connected:
            self.send_error(503, "MySQL Service Unavailable")
            return
        try:
            with mysql_connection.cursor() as cursor:
                cursor.execute("""
                    SELECT id, nome, data_inicio, data_fim, data_modificacao,
                           motor_name, motor_diameter, motor_length, motor_delay,
                           motor_propweight, motor_totalweight, motor_manufacturer,
                           motor_description, motor_observations, motor_temperatura, motor_umidade, motor_pressao,
                           impulso_total, motor_class, class_color
                    FROM sessoes ORDER BY data_inicio DESC
                """)
                sessoes = cursor.fetchall()

                for sessao in sessoes:
                    # Use pre-calculated values from database
                    sessao['impulsoTotal'] = sessao.pop('impulso_total', 0) or 0
                    sessao['motorClass'] = sessao.pop('motor_class', 'N/A') or 'N/A'
                    sessao['classColor'] = sessao.pop('class_color', '#95a5a6') or '#95a5a6'

                    # Transform motor fields into metadadosMotor object
                    sessao['metadadosMotor'] = {
                        'name': sessao.pop('motor_name', None),
                        'diameter': sessao.pop('motor_diameter', None),
                        'length': sessao.pop('motor_length', None),
                        'delay': sessao.pop('motor_delay', None),
                        'propweight': sessao.pop('motor_propweight', None),
                        'totalweight': sessao.pop('motor_totalweight', None),
                        'manufacturer': sessao.pop('motor_manufacturer', None),
                        'description': sessao.pop('motor_description', None),
                        'observations': sessao.pop('motor_observations', None),
                        'temperatura': sessao.pop('motor_temperatura', None),
                        'umidade': sessao.pop('motor_umidade', None),
                        'pressao': sessao.pop('motor_pressao', None)
                    }
                self.send_json_response(200, sessoes)
        except pymysql.Error as e:
            logging.error(f"API Error (get_sessoes): {e}")
            self.send_error(500, "Internal Server Error")

    def handle_get_leituras(self):
        try:
            sessao_id = int(self.path.split('/')[-2])
        except (ValueError, IndexError):
            self.send_error(400, "Invalid Session ID")
            return
        
        if not mysql_connected:
            self.send_error(503, "MySQL Service Unavailable")
            return
        try:
            with mysql_connection.cursor() as cursor:
                cursor.execute("SELECT tempo, forca, ema, massaKg, timestamp FROM leituras WHERE sessao_id = %s ORDER BY tempo ASC", (sessao_id,))
                leituras = cursor.fetchall()
                self.send_json_response(200, leituras)
        except pymysql.Error as e:
            logging.error(f"API Error (get_leituras): {e}")
            self.send_error(500, "Internal Server Error")

    def handle_get_sessao_by_id(self):
        try:
            sessao_id = int(self.path.split('/')[-1])
        except (ValueError, IndexError):
            self.send_error(400, "Invalid Session ID")
            return

        if not mysql_connected:
            self.send_error(503, "MySQL Service Unavailable")
            return
        try:
            with mysql_connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT id, nome, data_inicio, data_fim, data_modificacao,
                               motor_name, motor_diameter, motor_length, motor_delay,
                               motor_propweight, motor_totalweight, motor_manufacturer,
                               motor_description, motor_observations, motor_temperatura, motor_umidade, motor_pressao,
                               burn_start_time, burn_end_time
                        FROM sessoes WHERE id = %s
                    """, (sessao_id,))
                    sessao = cursor.fetchone()
                    if sessao:
                        # Transform motor fields into metadadosMotor object
                        sessao['metadadosMotor'] = {
                            'name': sessao.pop('motor_name', None),
                            'diameter': sessao.pop('motor_diameter', None),
                            'length': sessao.pop('motor_length', None),
                            'delay': sessao.pop('motor_delay', None),
                            'propweight': sessao.pop('motor_propweight', None),
                            'totalweight': sessao.pop('motor_totalweight', None),
                            'manufacturer': sessao.pop('motor_manufacturer', None),
                            'description': sessao.pop('motor_description', None),
                            'observations': sessao.pop('motor_observations', None),
                            'temperatura': sessao.pop('motor_temperatura', None),
                            'umidade': sessao.pop('motor_umidade', None),
                            'pressao': sessao.pop('motor_pressao', None)
                        }
                        # Add burn metadata
                        sessao['burnMetadata'] = {
                            'burnStartTime': sessao.pop('burn_start_time', None),
                            'burnEndTime': sessao.pop('burn_end_time', None)
                        }
                        self.send_json_response(200, sessao)
                    else:
                        self.send_error(404, "Session Not Found")
        except pymysql.Error as e:
            logging.error(f"API Error (get_sessao_by_id): {e}")
            self.send_error(500, "Internal Server Error")

    def handle_post_sessao(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            session_data = json.loads(post_data)
        except (json.JSONDecodeError, TypeError, KeyError):
            self.send_error(400, "Invalid JSON")
            return

        # We need to run the async save function in the main event loop
        # This is a bit tricky from a synchronous handler in a different thread
        # A simpler approach for now is to call it directly if it can be made synchronous,
        # or use a thread-safe call to the loop.
        # For this implementation, let's assume we can create a new loop to run the async task.
        # This is not ideal but works for this isolated case.
        
        # asyncio.run() cannot be called from a running event loop.
        # Since the http server runs in its own thread, we can get/create a loop for this thread.
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:  # 'RuntimeError: There is no current event loop...'
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        success = loop.run_until_complete(save_session_to_mysql_db(session_data))

        if success:
            self.send_json_response(201, {"message": "Session created/updated successfully"})
        else:
            self.send_error(500, "Failed to save session to database")

    def handle_delete_sessao(self):
        try:
            sessao_id = int(self.path.split('/')[-1])
        except (ValueError, IndexError):
            self.send_error(400, "Invalid Session ID")
            return

        if not mysql_connected:
            self.send_error(503, "MySQL Service Unavailable")
            return
        try:
            with mysql_connection.cursor() as cursor:
                result = cursor.execute("DELETE FROM sessoes WHERE id = %s", (sessao_id,))
                mysql_connection.commit()
                if result > 0:
                    self.send_json_response(200, {"message": f"Sessão {sessao_id} deletada."})
                else:
                    self.send_error(404, "Session Not Found")
        except pymysql.Error as e:
            logging.error(f"API Error (delete_sessao): {e}")
            self.send_error(500, "Internal Server Error")

    def handle_get_time(self):
        """Retorna a hora atual do servidor no timezone local do sistema"""
        # Obtém o timezone do sistema (TZ env var ou timezone do sistema)
        tz_name = os.getenv('TZ', 'America/Sao_Paulo')
        try:
            tz = ZoneInfo(tz_name)
            current_time = datetime.now(tz).isoformat()
        except Exception as e:
            logging.warning(f"Erro ao carregar timezone {tz_name}: {e}, usando datetime.now()")
            current_time = datetime.now().isoformat()
        self.send_json_response(200, {"time": current_time})

    def handle_get_info(self):
        """Retorna informações do servidor: IP, hostname, porta"""
        try:
            # Get local IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("10.255.255.255", 1))
            local_ip = s.getsockname()[0]
            s.close()
        except Exception:
            local_ip = "127.0.0.1"
        
        info = {
            "ip": local_ip,
            "hostname": "gfig.local",
            "port": HTTP_PORT,
            "mdns_hostname": "gfig",
            "service_name": "Balança GFIG",
            "version": "1.0",
            "access_urls": [
                f"http://{local_ip}",
                "http://gfig.local"
            ]
        }
        self.send_json_response(200, info)

    def handle_update_burn_metadata(self):
        """Atualiza os metadados de queima (burn_start_time e burn_end_time) de uma sessão"""
        try:
            sessao_id = int(self.path.split('/')[-2])
        except (ValueError, IndexError):
            self.send_error(400, "Invalid Session ID")
            return

        if not mysql_connected:
            self.send_error(503, "MySQL Service Unavailable")
            return

        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)

            burn_start_time = data.get('burn_start_time')
            burn_end_time = data.get('burn_end_time')

            if burn_start_time is None or burn_end_time is None:
                self.send_error(400, "Missing burn_start_time or burn_end_time")
                return

            with mysql_connection.cursor() as cursor:
                cursor.execute("""
                    UPDATE sessoes
                    SET burn_start_time = %s, burn_end_time = %s
                    WHERE id = %s
                """, (float(burn_start_time), float(burn_end_time), sessao_id))

                mysql_connection.commit()

                if cursor.rowcount > 0:
                    logging.info(f"Metadados de queima atualizados para sessão {sessao_id}: "
                               f"início={burn_start_time}s, fim={burn_end_time}s")
                    self.send_json_response(200, {"message": "Burn metadata updated successfully"})
                else:
                    self.send_error(404, "Session Not Found")

        except (json.JSONDecodeError, TypeError, ValueError) as e:
            logging.error(f"Erro ao processar dados de burn metadata: {e}")
            self.send_error(400, "Invalid JSON or data format")
        except pymysql.Error as e:
            logging.error(f"API Error (update_burn_metadata): {e}")
            self.send_error(500, "Internal Server Error")

    def handle_sync_time(self):
        """Sincroniza a hora do servidor com a hora recebida do cliente considerando timezone"""
        logging.info("Requisição de sincronização de hora recebida")
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            logging.info(f"Dados recebidos: {post_data.decode('utf-8')}")
            data = json.loads(post_data)

            new_time_str = data.get('time')
            timezone_offset = data.get('timezoneOffset', 0)  # offset em segundos
            timezone_name = data.get('timezoneName', 'Unknown')
            local_time = data.get('localTime', 'Unknown')
            
            if not new_time_str:
                logging.error("Campo 'time' não fornecido")
                self.send_json_response(400, {"error": "Missing 'time' field"})
                return

            logging.info(f"Timezone do cliente: {timezone_name} (offset: {timezone_offset}s)")
            logging.info(f"Hora local do cliente: {local_time}")

            # Parse a nova hora (vem em UTC/ISO)
            new_time_utc = datetime.fromisoformat(new_time_str.replace('Z', '+00:00'))
            logging.info(f"Hora ISO recebida (UTC): {new_time_utc}")

            # Ajusta para a hora local do cliente aplicando o offset inverso
            # Se o cliente tem offset de -10800 (UTC-3), precisamos ADD 10800 segundos
            # para voltar de UTC para a hora local do cliente
            adjusted_time = new_time_utc + timedelta(seconds=-timezone_offset)
            
            logging.info(f"Hora ajustada para timezone do cliente: {adjusted_time}")
            logging.info(f"Interpretação: o cliente está em UTC{-timezone_offset//3600:+d}, "
                        f"portanto a hora {new_time_utc} em UTC = {adjusted_time} no timezone do cliente")

            # Formata para o comando date do Linux
            # Formato: MMDDhhmmYYYY.ss
            time_str = adjusted_time.strftime('%m%d%H%M%Y.%S')
            logging.info(f"Comando date: date {time_str}")

            # Tenta ajustar a hora do sistema (requer privilégios)
            import subprocess
            import os

            # Verifica se está rodando como root
            is_root = os.geteuid() == 0 if hasattr(os, 'geteuid') else False

            try:
                result = subprocess.run(['date', time_str],
                                      capture_output=True,
                                      text=True,
                                      check=True)
                logging.info(f"Hora do servidor sincronizada para: {adjusted_time}")
                logging.info(f"Saída do comando: {result.stdout}")
                self.send_json_response(200, {
                    "message": "Hora sincronizada com sucesso!",
                    "new_time": adjusted_time.isoformat(),
                    "client_timezone": timezone_name,
                    "client_local_time": local_time
                })
            except subprocess.CalledProcessError as e:
                error_msg = e.stderr.strip() if e.stderr else str(e)
                logging.error(f"Erro ao ajustar hora do sistema: {error_msg}")

                # Mensagem mais detalhada baseada no erro
                if "Operation not permitted" in error_msg or "Permission denied" in error_msg:
                    help_msg = (
                        "O servidor não tem permissões para ajustar a hora do sistema.\n\n"
                        "Para habilitar a sincronização, você pode:\n\n"
                        "1. Rodar o servidor com sudo:\n"
                        "   sudo python3 server.py\n\n"
                        "2. No Docker, adicionar --privileged ou --cap-add=SYS_TIME:\n"
                        "   docker run --cap-add=SYS_TIME ...\n\n"
                        "3. Ajustar a hora manualmente no sistema:\n"
                        f"   sudo date {time_str}"
                    )
                    self.send_json_response(403, {
                        "error": "Permissão negada",
                        "message": help_msg,
                        "requested_time": adjusted_time.isoformat(),
                        "client_timezone": timezone_name,
                        "client_local_time": local_time
                    })
                else:
                    self.send_json_response(500, {
                        "error": error_msg,
                        "message": "Falha ao executar comando 'date'.",
                        "requested_time": adjusted_time.isoformat(),
                        "client_timezone": timezone_name,
                        "client_local_time": local_time
                    })
            except FileNotFoundError:
                # Se o comando 'date' não existir (Windows, etc)
                logging.warning("Comando 'date' não disponível - sincronização apenas simulada")
                self.send_json_response(200, {
                    "message": "Sincronização simulada (comando 'date' não disponível no sistema)",
                    "new_time": adjusted_time.isoformat(),
                    "client_timezone": timezone_name,
                    "client_local_time": local_time,
                    "warning": "Sistema operacional não suporta comando 'date'"
                })

        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logging.error(f"Erro ao processar sincronização de hora: {e}", exc_info=True)
            self.send_json_response(400, {
                "error": f"Invalid request: {str(e)}",
                "message": "Erro ao processar dados da requisição"
            })

    def send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode('utf-8'))

class DualStackTCPServer(socketserver.ThreadingMixIn,socketserver.TCPServer):
    address_family = socket.AF_INET # Force IPv4
    allow_reuse_address = True
    daemon_threads = True   
    
    def handle_error(self, request, client_address):
        """Sobrescreve handle_error para tratar exceções sem travar o servidor"""
        import sys
        import traceback
        
        exc_type, exc_value, exc_tb = sys.exc_info()
        
        # Não loga erros comuns de conexão - são normais
        if exc_type in (ConnectionResetError, BrokenPipeError, ConnectionAbortedError):
            logging.debug(f"Cliente {client_address} desconectou durante requisição: {exc_type.__name__}")
            return
        
        # Loga outros erros mas não trava o servidor
        logging.error(f"Erro ao processar requisição de {client_address}:")
        logging.error(''.join(traceback.format_exception(exc_type, exc_value, exc_tb)))
        
        # Não propaga a exceção - isso permite que o servidor continue funcionando

def start_http_server():
    try:
        server_address = (BIND_HOST, HTTP_PORT)
        httpd = DualStackTCPServer(server_address, APIRequestHandler)

        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        logging.info(f"Servidor HTTP/API iniciado em {BIND_HOST}:{HTTP_PORT}")
        return httpd
    except OSError as e:
        logging.error(f"Falha ao iniciar servidor HTTP: {e}", exc_info=True)
        return None


# ================== WebSocket ==================
async def ws_handler(websocket):
    CONNECTED_CLIENTS.add(websocket)
    try:
        # Send initial status on connect
        await websocket.send(json.dumps({
            "mysql_connected": mysql_connected,
            "serial_connected": serial_connected,
            "serial_error": serial_last_error
        }))

        async for message in websocket:
            try:
                cmd = json.loads(message)
                cmd_type = cmd.get("cmd")

                if cmd_type == "save_session_to_mysql":
                    session_data = cmd.get("payload")
                    if session_data:
                        success = await save_session_to_mysql_db(session_data)
                        response_type = "mysql_save_success" if success else "mysql_save_error"
                        await websocket.send(json.dumps({
                            "type": response_type,
                            "message": session_data.get("nome"),
                            "sessionId": session_data.get("id")
                        }))
                else:
                    binary_packet = json_to_binary_command(cmd)
                    if binary_packet:
                        with serial_lock:
                            if serial_connection and serial_connection.is_open:
                                try:
                                    serial_connection.write(binary_packet)
                                    serial_connection.flush()
                                    logging.debug(f"Comando serial enviado: {cmd_type}")
                                except Exception as e:
                                    logging.error(f"Erro ao enviar comando serial: {e}")
                    else:
                        logging.debug(f"Comando desconhecido ou inválido: {cmd_type}")

            except json.JSONDecodeError:
                logging.error(f"Mensagem WS inválida: {message}")
            except Exception as e:
                logging.error(f"Erro ao processar comando WS: {e}", exc_info=True)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        CONNECTED_CLIENTS.remove(websocket)

async def ws_server_main():
    try:
        async with websockets.serve(ws_handler, BIND_HOST, WS_PORT, max_size=None):
            logging.info(f"WebSocket ativo em {BIND_HOST}:{WS_PORT}")
            await asyncio.Future()
    except OSError as e:
        logging.error(f"Falha ao iniciar WebSocket: {e}", exc_info=True)

def sanitize_for_json(obj):
    """Recursively replace NaN/Infinity with None for valid JSON serialization."""
    import math
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    return obj

async def broadcast_json(obj: Dict[str, Any]):
    if not CONNECTED_CLIENTS:
        return
    obj["mysql_connected"] = mysql_connected
    obj["serial_connected"] = serial_connected
    obj["serial_error"] = serial_last_error
    sanitized = sanitize_for_json(obj)
    data = json.dumps(sanitized, separators=(",", ":"))
    await asyncio.gather(*[ws.send(data) for ws in list(CONNECTED_CLIENTS)], return_exceptions=True)

# ================== Binary Protocol & Serial ==================
def crc16_ccitt(data: bytes) -> int:
    crc = 0xFFFF
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) if crc & 0x8000 else (crc << 1)
    return crc & 0xFFFF

def parse_data_packet(data: bytes) -> Optional[Dict[str, Any]]:
    if len(data) != SIZE_DATA: return None
    try:
        magic, ver, pkt_type, t_ms, forca_N, status, crc_rx = struct.unpack("<HBBIfBxH", data)
        if magic != MAGIC or ver != VERSION or pkt_type != TYPE_DATA: return None
        if crc16_ccitt(data[:-2]) != crc_rx:
            logging.warning("CRC mismatch in DATA packet")
            return None
        return {"type": "data", "tempo": t_ms / 1000.0, "forca": float(forca_N), "status": status}
    except struct.error: return None

def parse_config_packet(data: bytes) -> Optional[Dict[str, Any]]:
    if len(data) != SIZE_CONFIG: return None
    try:
        magic, ver, pkt_type = struct.unpack_from("<HBB", data, 0)
        if magic != MAGIC or ver != VERSION or pkt_type != TYPE_CONFIG: return None
        if crc16_ccitt(data[:-2]) != struct.unpack_from("<H", data, SIZE_CONFIG - 2)[0]:
            logging.debug("CRC mismatch in CONFIG packet - descartando pacote")
            return None
        fields = struct.unpack_from("<ffHfHHBBHiffB23x", data, 4)
        config = {
            "type": "config", "conversionFactor": fields[0], "gravity": fields[1],
            "leiturasEstaveis": fields[2], "toleranciaEstabilidade": fields[3],
            "numAmostrasMedia": fields[4], "numAmostrasCalibracao": fields[5],
            "usarMediaMovel": fields[6], "usarEMA": fields[7], "timeoutCalibracao": fields[8],
            "tareOffset": fields[9], "capacidadeMaximaGramas": fields[10],
            "percentualAcuracia": fields[11], "mode": fields[12]
        }
        # Sanitize NaN/Infinity to None for valid JSON
        sanitized = sanitize_for_json(config)
        # Log dos valores recebidos para debug
        logging.info(f"[CONFIG_PACKET] capacidadeMaximaGramas={sanitized.get('capacidadeMaximaGramas')}, percentualAcuracia={sanitized.get('percentualAcuracia')}")
        return sanitized
    except struct.error: return None

def parse_status_packet(data: bytes) -> Optional[Dict[str, Any]]:
    if len(data) != SIZE_STATUS: return None
    try:
        magic, ver, pkt_type, status_type, code, value, timestamp, crc_rx = struct.unpack("<HBBBBHIH", data)
        if magic != MAGIC or ver != VERSION or pkt_type != TYPE_STATUS: return None
        if crc16_ccitt(data[:-2]) != crc_rx:
            logging.warning("CRC mismatch in STATUS packet")
            return None
        type_map = {0: "info", 1: "success", 2: "warning", 3: "error"}
        messages = {0x10: "Tara concluída", 0x11: "Calibração concluída", 0x12: "Calibração falhou"}
        return {
            "type": "status", "status": type_map.get(status_type, "info"),
            "message": messages.get(code, f"Status code: {code:02X}"),
            "code": code, "value": value, "timestamp": timestamp / 1000.0
        }
    except struct.error: return None

def json_to_binary_command(cmd: Dict[str, Any]) -> Optional[bytes]:
    cmd_type = cmd.get("cmd", "").lower()
    pkt_type, fmt, values = None, None, None

    if cmd_type in ("t", "tara"):
        pkt_type, fmt, values = CMD_TARA, "<HBBH", (MAGIC, VERSION, CMD_TARA, 0)
    elif cmd_type in ("c", "calibrate"):
        massa_g = float(cmd.get("massa_g", 0))
        if massa_g > 0:
            pkt_type, fmt, values = CMD_CALIBRATE, "<HBBf", (MAGIC, VERSION, CMD_CALIBRATE, massa_g)
    elif cmd_type == "get_config":
        pkt_type, fmt, values = CMD_GET_CONFIG, "<HBBH", (MAGIC, VERSION, CMD_GET_CONFIG, 0)
    elif cmd_type in ("set", "set_param"):
        param_map = {
            "gravity": (0x01, "f"),                    # PARAM_GRAVITY
            "conversionFactor": (0x02, "f"),           # PARAM_CONV_FACTOR
            "leiturasEstaveis": (0x03, "I"),           # PARAM_LEIT_ESTAV
            "toleranciaEstabilidade": (0x04, "f"),     # PARAM_TOLERANCIA
            "mode": (0x05, "I"),                       # PARAM_MODE
            "usarEMA": (0x06, "I"),                    # PARAM_USE_EMA
            "numAmostrasMedia": (0x07, "I"),           # PARAM_NUM_AMOSTRAS
            "tareOffset": (0x08, "i"),                 # PARAM_TARE_OFFSET (signed int)
            "timeoutCalibracao": (0x09, "I"),          # PARAM_TIMEOUT_CAL
            "capacidadeMaximaGramas": (0x0A, "f"),     # PARAM_CAPACIDADE
            "percentualAcuracia": (0x0B, "f")          # PARAM_ACURACIA
        }
        param_name = cmd.get("param", "")
        if param_name in param_map:
            param_id, value_type = param_map[param_name]
            value = cmd.get("value", 0)
            value_f = float(value) if value_type == "f" else 0.0
            value_i = int(value) if value_type in ("I", "i") else 0
            pkt_type, fmt, values = CMD_SET_PARAM, "<HBBB3xfI", (MAGIC, VERSION, CMD_SET_PARAM, param_id, value_f, value_i)
            logging.info(f"[SET_PARAM] param_name={param_name}, param_id=0x{param_id:02X}, value_type={value_type}, value={value}")

    if pkt_type and fmt and values:
        data = struct.pack(fmt, *values)
        crc = crc16_ccitt(data)
        result = data + struct.pack("<H", crc)
        logging.debug(f"Binary command gerado: {result.hex()}")
        return result
    return None

def find_serial_port() -> Optional[str]:
    if os.path.exists(SERIAL_PORT): return SERIAL_PORT
    ports = [p.device for p in serial.tools.list_ports.comports() if "USB" in p.device or "ACM" in p.device]
    return ports[0] if ports else None

def serial_reader(loop: asyncio.AbstractEventLoop):
    global serial_connection, serial_connected, serial_last_error
    retry_count = 0
    max_retry_log = 5  # Logar apenas as primeiras 5 tentativas

    while True:
        port = find_serial_port()
        if not port:
            retry_count += 1
            if retry_count <= max_retry_log:
                logging.warning(f"Porta serial não encontrada (tentativa {retry_count}). Aguardando dispositivo USB...")
            elif retry_count == max_retry_log + 1:
                logging.warning("Porta serial não encontrada. Continuarei tentando silenciosamente em background...")

            if not serial_connected:
                serial_connected = False
                serial_last_error = "Dispositivo USB não encontrado. Verifique a conexão do ESP32/NodeMCU."
                # Broadcast status update
                status_update = {
                    "type": "serial_status",
                    "connected": False,
                    "error": serial_last_error
                }
                asyncio.run_coroutine_threadsafe(broadcast_json(status_update), loop)

            time.sleep(5)  # Aguarda 5 segundos antes de tentar novamente
            continue

        try:
            logging.info(f"Tentando conectar à porta serial {port}...")
            serial_connection = serial.Serial(port, SERIAL_BAUD, timeout=1.0)
            serial_connected = True
            serial_last_error = None
            retry_count = 0  # Reset contador de tentativas
            logging.info(f"✓ Conectado à porta serial {port} (baud rate: {SERIAL_BAUD})")

            # Broadcast successful connection
            status_update = {
                "type": "serial_status",
                "connected": True,
                "port": port,
                "baudrate": SERIAL_BAUD
            }
            asyncio.run_coroutine_threadsafe(broadcast_json(status_update), loop)

            buf = bytearray()
            invalid_packet_count = 0
            max_invalid_packets = 10  # Limite para evitar travamento com dados corrompidos
            
            while True:
                chunk = serial_connection.read(256)
                if not chunk: continue
                buf.extend(chunk)
                
                while len(buf) >= 8:
                    magic_idx = buf.find(b'\xB2\xA1')  # Procura pelo magic 0xA1B2 em little-endian
                    if magic_idx == -1:
                        # Nenhum magic encontrado, descarta buffer antigo
                        if len(buf) > 256:
                            buf = buf[-256:]
                        break
                    
                    if magic_idx > 0:
                        try:
                            # Log de dados não-binários encontrados antes do magic
                            text_data = buf[:magic_idx].decode('utf-8', errors='ignore').strip()
                            if text_data:
                                logging.debug(f"Dados não-binários recebidos: {text_data}")
                        except Exception:
                            pass
                        del buf[:magic_idx]
                    
                    if len(buf) < 4:
                        break
                    
                    pkt_type = buf[3]
                    size_map = {TYPE_DATA: SIZE_DATA, TYPE_CONFIG: SIZE_CONFIG, TYPE_STATUS: SIZE_STATUS}
                    expected_size = size_map.get(pkt_type)
                    
                    if not expected_size:
                        # Tipo de pacote desconhecido, descarta este byte e continua
                        del buf[0]
                        invalid_packet_count += 1
                        if invalid_packet_count > max_invalid_packets:
                            logging.warning(f"Muitos pacotes inválidos detectados. Resincronizando buffer.")
                            buf.clear()
                            invalid_packet_count = 0
                        continue
                    
                    if len(buf) < expected_size:
                        break  # Aguarda mais dados
                    
                    packet = bytes(buf[:expected_size])
                    del buf[:expected_size]
                    
                    # Tenta parsear o pacote
                    parsers = {TYPE_DATA: parse_data_packet, TYPE_CONFIG: parse_config_packet, TYPE_STATUS: parse_status_packet}
                    json_obj = parsers.get(pkt_type)(packet) if pkt_type in parsers else None
                    
                    if json_obj:
                        invalid_packet_count = 0  # Reset contador se pacote válido
                        asyncio.run_coroutine_threadsafe(broadcast_json(json_obj), loop)
                    else:
                        # Pacote inválido (CRC falhou, etc), descarta silenciosamente
                        invalid_packet_count += 1
                        if invalid_packet_count > max_invalid_packets:
                            logging.warning(f"Muitos pacotes inválidos ({invalid_packet_count}). Possível problema de sincronização.")
                            buf.clear()
                            invalid_packet_count = 0
                            
        except serial.SerialException as e:
            error_msg = str(e)
            if "device reports readiness" in error_msg.lower() or "disconnected" in error_msg.lower():
                logging.warning(f"Dispositivo USB desconectado ou com problemas: {error_msg}")
                serial_last_error = "Dispositivo USB desconectado ou instável. Verifique o cabo USB e a conexão."
            else:
                logging.error(f"Erro na porta serial: {error_msg}")
                serial_last_error = f"Erro de comunicação serial: {error_msg}"

            serial_connected = False
            # Broadcast error status
            status_update = {
                "type": "serial_status",
                "connected": False,
                "error": serial_last_error
            }
            asyncio.run_coroutine_threadsafe(broadcast_json(status_update), loop)

        except Exception as e:
            logging.error(f"Erro inesperado na leitura serial: {e}", exc_info=True)
            serial_connected = False
            serial_last_error = f"Erro inesperado: {str(e)}"

            # Broadcast error status
            status_update = {
                "type": "serial_status",
                "connected": False,
                "error": serial_last_error
            }
            asyncio.run_coroutine_threadsafe(broadcast_json(status_update), loop)

        finally:
            if serial_connection:
                try:
                    serial_connection.close()
                except:
                    pass
            serial_connection = None
            serial_connected = False
            time.sleep(3)  # Aguarda antes de tentar reconectar

# ================== Main ==================
async def main():
    httpd = None
    try:
        init_mysql_db()
        httpd = start_http_server()
        loop = asyncio.get_running_loop()
        threading.Thread(target=serial_reader, args=(loop,), daemon=True).start()
        await ws_server_main()
    except OSError as e:
        if e.errno == 98: logging.error("Porta já em uso.")
        else: raise
    finally:
        if httpd: httpd.shutdown()
        if mysql_connection and mysql_connection.open:
            mysql_connection.close()
            logging.info("Conexão MySQL fechada.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Encerrado pelo usuário")