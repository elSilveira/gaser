#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Backend Flask otimizado para o Mapa de Postos de Combustíveis
Implementa rotas de API para busca ultrarrápida e respostas em lote
"""

import os
import sys
import json
import sqlite3
import pickle
import numpy as np
import math
import time
import logging
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory, render_template
from flask_cors import CORS
import rtree
from concurrent.futures import ThreadPoolExecutor
import threading

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("backend_flask")

# Diretórios
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
INDEX_DIR = os.path.join(DATA_DIR, "indices")
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Caminhos para arquivos de dados
DB_PATH = os.path.join(DATA_DIR, "postos_latest.db")
JSON_PATH = os.path.join(DATA_DIR, "postos_latest.json")
RTREE_PATH = os.path.join(INDEX_DIR, "rtree_latest")
GRID_PATH = os.path.join(INDEX_DIR, "grid_latest.pkl")
KD_TREE_PATH = os.path.join(INDEX_DIR, "kd_tree_latest.pkl")

# Inicializar aplicação Flask
app = Flask(__name__, static_folder=STATIC_DIR)
CORS(app)  # Habilitar CORS para todas as rotas

# Cache global para dados
cache = {
    'dados_json': None,
    'rtree_index': None,
    'grid_index': None,
    'kd_tree_data': None,
    'ultima_atualizacao': None,
    'total_postos': 0
}

# Lock para acesso concorrente ao cache
cache_lock = threading.Lock()

# Função para calcular distância entre coordenadas (Haversine)
def calcular_distancia(lat1, lon1, lat2, lon2):
    """
    Calcula a distância em km entre dois pontos usando a fórmula de Haversine
    """
    # Converter para radianos
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Diferenças
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    # Fórmula de Haversine
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distancia = 6371 * c  # Raio da Terra em km
    
    return distancia

# Função para carregar dados do JSON otimizado
def carregar_dados_json():
    """Carrega dados do JSON otimizado"""
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            dados = json.load(f)
        return dados
    except Exception as e:
        logger.error(f"Erro ao carregar JSON: {str(e)}")
        return None

# Função para carregar índice R-tree
def carregar_rtree():
    """Carrega índice R-tree"""
    try:
        idx = rtree.index.Index(RTREE_PATH)
        return idx
    except Exception as e:
        logger.error(f"Erro ao carregar R-tree: {str(e)}")
        return None

# Função para carregar índice de grid
def carregar_grid():
    """Carrega índice de grid"""
    try:
        with open(GRID_PATH, 'rb') as f:
            grid = pickle.load(f)
        return grid
    except Exception as e:
        logger.error(f"Erro ao carregar Grid: {str(e)}")
        return None

# Função para carregar dados do KD-Tree
def carregar_kd_tree():
    """Carrega dados do KD-Tree"""
    try:
        with open(KD_TREE_PATH, 'rb') as f:
            kd_data = pickle.load(f)
        return kd_data
    except Exception as e:
        logger.error(f"Erro ao carregar KD-Tree: {str(e)}")
        return None

# Função para inicializar cache
def inicializar_cache():
    """Inicializa o cache com todos os dados necessários"""
    global cache
    
    with cache_lock:
        # Carregar dados JSON
        dados_json = carregar_dados_json()
        if dados_json:
            cache['dados_json'] = dados_json
            cache['total_postos'] = dados_json['metadata']['total_postos']
        
        # Carregar índice R-tree
        rtree_index = carregar_rtree()
        if rtree_index:
            cache['rtree_index'] = rtree_index
        
        # Carregar índice de grid
        grid_index = carregar_grid()
        if grid_index:
            cache['grid_index'] = grid_index
        
        # Carregar dados do KD-Tree
        kd_tree_data = carregar_kd_tree()
        if kd_tree_data:
            cache['kd_tree_data'] = kd_tree_data
        
        # Atualizar timestamp
        cache['ultima_atualizacao'] = datetime.now().isoformat()
        
        logger.info(f"Cache inicializado com {cache['total_postos']} postos")

# Função para buscar postos por proximidade usando R-tree
def buscar_postos_proximidade_rtree(lat, lon, raio_km=5.0, limite=50):
    """
    Busca postos próximos usando R-tree
    
    Args:
        lat: Latitude do ponto central
        lon: Longitude do ponto central
        raio_km: Raio de busca em km
        limite: Número máximo de resultados
        
    Returns:
        Lista de postos próximos
    """
    # Verificar se o índice R-tree está disponível
    if not cache['rtree_index']:
        logger.warning("Índice R-tree não disponível")
        return []
    
    # Converter raio de km para graus (aproximação)
    # 1 grau de latitude ≈ 111 km
    raio_lat = raio_km / 111.0
    # 1 grau de longitude varia com a latitude
    raio_lon = raio_km / (111.0 * math.cos(math.radians(lat)))
    
    # Definir bounding box para busca
    bbox = (lon - raio_lon, lat - raio_lat, lon + raio_lon, lat + raio_lat)
    
    # Buscar no índice R-tree
    ids_proximos = list(cache['rtree_index'].intersection(bbox, objects=True))
    
    # Limitar resultados
    ids_proximos = ids_proximos[:limite]
    
    # Obter postos completos
    postos_proximos = []
    for item in ids_proximos:
        posto_id = item.object
        posto = cache['dados_json']['postos_por_id'].get(posto_id)
        if posto:
            # Calcular distância exata
            dist = calcular_distancia(lat, lon, posto['latitude'], posto['longitude'])
            if dist <= raio_km:
                posto['distancia'] = round(dist, 2)
                postos_proximos.append(posto)
    
    # Ordenar por distância
    postos_proximos.sort(key=lambda x: x['distancia'])
    
    return postos_proximos

# Função para buscar postos por proximidade usando Grid
def buscar_postos_proximidade_grid(lat, lon, raio_km=5.0, limite=50):
    """
    Busca postos próximos usando índice de Grid
    
    Args:
        lat: Latitude do ponto central
        lon: Longitude do ponto central
        raio_km: Raio de busca em km
        limite: Número máximo de resultados
        
    Returns:
        Lista de postos próximos
    """
    # Verificar se o índice de Grid está disponível
    if not cache['grid_index']:
        logger.warning("Índice de Grid não disponível")
        return []
    
    # Obter parâmetros do grid
    grid = cache['grid_index']['grid']
    tamanho_celula = cache['grid_index']['tamanho_celula']
    postos_ids = cache['grid_index']['postos_ids']
    
    # Converter raio de km para graus (aproximação)
    raio_graus = raio_km / 111.0
    
    # Calcular células do grid a verificar
    lat_idx_central = int(lat / tamanho_celula)
    lon_idx_central = int(lon / tamanho_celula)
    
    # Número de células a verificar em cada direção
    num_celulas = int(math.ceil(raio_graus / tamanho_celula)) + 1
    
    # Postos encontrados
    postos_encontrados = []
    
    # Verificar células ao redor
    for i in range(-num_celulas, num_celulas + 1):
        for j in range(-num_celulas, num_celulas + 1):
            lat_idx = lat_idx_central + i
            lon_idx = lon_idx_central + j
            
            # Chave do grid
            grid_key = f"{lat_idx}_{lon_idx}"
            
            # Verificar se a célula existe no grid
            if grid_key in grid:
                # Obter IDs dos postos na célula
                ids_celula = grid[grid_key]
                
                # Verificar cada posto
                for posto_id in ids_celula:
                    # Obter coordenadas do posto
                    posto_lat, posto_lon = postos_ids.get(posto_id, (0, 0))
                    
                    # Calcular distância
                    dist = calcular_distancia(lat, lon, posto_lat, posto_lon)
                    
                    # Verificar se está dentro do raio
                    if dist <= raio_km:
                        # Obter posto completo
                        posto = cache['dados_json']['postos_por_id'].get(posto_id)
                        if posto:
                            posto['distancia'] = round(dist, 2)
                            postos_encontrados.append(posto)
    
    # Ordenar por distância
    postos_encontrados.sort(key=lambda x: x['distancia'])
    
    # Limitar resultados
    return postos_encontrados[:limite]

# Função para buscar postos por filtros
def buscar_postos_filtros(filtros, limite=100):
    """
    Busca postos por filtros
    
    Args:
        filtros: Dicionário com filtros
        limite: Número máximo de resultados
        
    Returns:
        Lista de postos filtrados
    """
    # Verificar se os dados JSON estão disponíveis
    if not cache['dados_json']:
        logger.warning("Dados JSON não disponíveis")
        return []
    
    # Obter todos os postos
    todos_postos = cache['dados_json']['postos']
    
    # Aplicar filtros
    postos_filtrados = todos_postos
    
    # Filtrar por estado
    if 'estado' in filtros and filtros['estado']:
        estado = filtros['estado'].upper()
        ids_estado = cache['dados_json']['postos_por_estado'].get(estado, [])
        postos_filtrados = [p for p in postos_filtrados if p['id'] in ids_estado]
    
    # Filtrar por cidade
    if 'cidade' in filtros and filtros['cidade']:
        cidade = filtros['cidade']
        ids_cidade = cache['dados_json']['postos_por_cidade'].get(cidade, [])
        postos_filtrados = [p for p in postos_filtrados if p['id'] in ids_cidade]
    
    # Filtrar por bandeira
    if 'bandeira' in filtros and filtros['bandeira']:
        bandeira = filtros['bandeira']
        ids_bandeira = cache['dados_json']['postos_por_bandeira'].get(bandeira, [])
        postos_filtrados = [p for p in postos_filtrados if p['id'] in ids_bandeira]
    
    # Filtrar por preço máximo de gasolina
    if 'preco_max_gasolina' in filtros and filtros['preco_max_gasolina']:
        preco_max = float(filtros['preco_max_gasolina'])
        postos_filtrados = [p for p in postos_filtrados if p.get('preco_gasolina') is not None and float(p['preco_gasolina']) <= preco_max]
    
    # Filtrar por preço máximo de álcool
    if 'preco_max_alcool' in filtros and filtros['preco_max_alcool']:
        preco_max = float(filtros['preco_max_alcool'])
        postos_filtrados = [p for p in postos_filtrados if p.get('preco_alcool') is not None and float(p['preco_alcool']) <= preco_max]
    
    # Filtrar por preço máximo de diesel
    if 'preco_max_diesel' in filtros and filtros['preco_max_diesel']:
        preco_max = float(filtros['preco_max_diesel'])
        postos_filtrados = [p for p in postos_filtrados if p.get('preco_diesel') is not None and float(p['preco_diesel']) <= preco_max]
    
    # Ordenar por preço de gasolina
    if 'ordenar_por' in filtros:
        if filtros['ordenar_por'] == 'preco_gasolina':
            postos_filtrados.sort(key=lambda x: float(x.get('preco_gasolina', 999999)))
        elif filtros['ordenar_por'] == 'preco_alcool':
            postos_filtrados.sort(key=lambda x: float(x.get('preco_alcool', 999999)))
        elif filtros['ordenar_por'] == 'preco_diesel':
            postos_filtrados.sort(key=lambda x: float(x.get('preco_diesel', 999999)))
    
    # Limitar resultados
    return postos_filtrados[:limite]

# Função para buscar postos em lote
def buscar_postos_lote(pontos, raio_km=5.0, limite_por_ponto=20):
    """
    Busca postos próximos a múltiplos pontos em lote
    
    Args:
        pontos: Lista de dicionários com lat e lon
        raio_km: Raio de busca em km
        limite_por_ponto: Número máximo de resultados por ponto
        
    Returns:
        Dicionário com resultados por ponto
    """
    resultados = {}
    
    # Processar cada ponto em paralelo
    with ThreadPoolExecutor(max_workers=min(len(pontos), 10)) as executor:
        # Criar tarefas
        futures = {}
        for i, ponto in enumerate(pontos):
            lat = ponto.get('lat')
            lon = ponto.get('lon')
            if lat is not None and lon is not None:
                future = executor.submit(
                    buscar_postos_proximidade_rtree,
                    lat, lon, raio_km, limite_por_ponto
                )
                futures[future] = i
        
        # Coletar resultados
        for future in futures:
            i = futures[future]
            try:
                postos = future.result()
                resultados[i] = postos
            except Exception as e:
                logger.error(f"Erro ao processar ponto {i}: {str(e)}")
                resultados[i] = []
    
    return resultados

# Rota para a página inicial
@app.route('/')
def index():
    """Rota para a página inicial"""
    return send_from_directory(STATIC_DIR, 'index.html')

# Rota para arquivos estáticos
@app.route('/<path:path>')
def static_files(path):
    """Rota para arquivos estáticos"""
    return send_from_directory(STATIC_DIR, path)

# Rota para status da API
@app.route('/api/status')
def api_status():
    """Rota para verificar o status da API"""
    return jsonify({
        'status': 'online',
        'total_postos': cache['total_postos'],
        'ultima_atualizacao': cache['ultima_atualizacao'],
        'indices_disponiveis': {
            'rtree': cache['rtree_index'] is not None,
            'grid': cache['grid_index'] is not None,
            'kd_tree': cache['kd_tree_data'] is not None
        }
    })

# Rota para buscar postos próximos
@app.route('/api/postos/proximos')
def api_postos_proximos():
    """Rota para buscar postos próximos a um ponto"""
    # Obter parâmetros
    try:
        lat = float(request.args.get('lat', 0))
        lon = float(request.args.get('lon', 0))
        raio = float(request.args.get('raio', 5.0))
        limite = int(request.args.get('limite', 50))
    except ValueError:
        return jsonify({'erro': 'Parâmetros inválidos'}), 400
    
    # Verificar parâmetros
    if lat == 0 and lon == 0:
        return jsonify({'erro': 'Latitude e longitude são obrigatórios'}), 400
    
    # Limitar raio e limite
    raio = min(raio, 50.0)  # Máximo 50 km
    limite = min(limite, 100)  # Máximo 100 postos
    
    # Medir tempo de execução
    inicio = time.time()
    
    # Buscar postos
    postos = buscar_postos_proximidade_rtree(lat, lon, raio, limite)
    
    # Calcular tempo de execução
    tempo_execucao = time.time() - inicio
    
    # Retornar resultados
    return jsonify({
        'postos': postos,
        'total': len(postos),
        'tempo_execucao': tempo_execucao,
        'parametros': {
            'lat': lat,
            'lon': lon,
            'raio': raio,
            'limite': limite
        }
    })

# Rota para buscar postos por filtros
@app.route('/api/postos/filtros')
def api_postos_filtros():
    """Rota para buscar postos por filtros"""
    # Obter parâmetros
    filtros = {
        'estado': request.args.get('estado'),
        'cidade': request.args.get('cidade'),
        'bandeira': request.args.get('bandeira'),
        'preco_max_gasolina': request.args.get('preco_max_gasolina'),
        'preco_max_alcool': request.args.get('preco_max_alcool'),
        'preco_max_diesel': request.args.get('preco_max_diesel'),
        'ordenar_por': request.args.get('ordenar_por', 'preco_gasolina')
    }
    
    limite = int(request.args.get('limite', 100))
    limite = min(limite, 500)  # Máximo 500 postos
    
    # Medir tempo de execução
    inicio = time.time()
    
    # Buscar postos
    postos = buscar_postos_filtros(filtros, limite)
    
    # Calcular tempo de execução
    tempo_execucao = time.time() - inicio
    
    # Retornar resultados
    return jsonify({
        'postos': postos,
        'total': len(postos),
        'tempo_execucao': tempo_execucao,
        'filtros': filtros
    })

# Rota para buscar postos em lote
@app.route('/api/postos/lote', methods=['POST'])
def api_postos_lote():
    """Rota para buscar postos próximos a múltiplos pontos em lote"""
    # Obter dados do corpo da requisição
    dados = request.json
    
    if not dados or 'pontos' not in dados:
        return jsonify({'erro': 'Dados inválidos'}), 400
    
    pontos = dados['pontos']
    raio = float(dados.get('raio', 5.0))
    limite = int(dados.get('limite', 20))
    
    # Limitar raio e limite
    raio = min(raio, 50.0)  # Máximo 50 km
    limite = min(limite, 50)  # Máximo 50 postos por ponto
    
    # Medir tempo de execução
    inicio = time.time()
    
    # Buscar postos em lote
    resultados = buscar_postos_lote(pontos, raio, limite)
    
    # Calcular tempo de execução
    tempo_execucao = time.time() - inicio
    
    # Retornar resultados
    return jsonify({
        'resultados': resultados,
        'total_pontos': len(pontos),
        'tempo_execucao': tempo_execucao,
        'parametros': {
            'raio': raio,
            'limite': limite
        }
    })

# Rota para obter metadados
@app.route('/api/metadados')
def api_metadados():
    """Rota para obter metadados dos postos"""
    if not cache['dados_json']:
        return jsonify({'erro': 'Dados não disponíveis'}), 500
    
    return jsonify(cache['dados_json']['metadata'])

# Rota para obter lista de estados
@app.route('/api/estados')
def api_estados():
    """Rota para obter lista de estados"""
    if not cache['dados_json']:
        return jsonify({'erro': 'Dados não disponíveis'}), 500
    
    estados = list(cache['dados_json']['postos_por_estado'].keys())
    estados.sort()
    
    return jsonify({
        'estados': estados,
        'total': len(estados)
    })

# Rota para obter lista de cidades por estado
@app.route('/api/cidades/<estado>')
def api_cidades(estado):
    """Rota para obter lista de cidades por estado"""
    if not cache['dados_json']:
        return jsonify({'erro': 'Dados não disponíveis'}), 500
    
    estado = estado.upper()
    
    # Obter postos do estado
    ids_estado = cache['dados_json']['postos_por_estado'].get(estado, [])
    
    # Obter cidades dos postos
    cidades = set()
    for posto_id in ids_estado:
        posto = cache['dados_json']['postos_por_id'].get(posto_id)
        if posto and 'cidade' in posto:
            cidades.add(posto['cidade'])
    
    cidades = list(cidades)
    cidades.sort()
    
    return jsonify({
        'estado': estado,
        'cidades': cidades,
        'total': len(cidades)
    })

# Rota para obter lista de bandeiras
@app.route('/api/bandeiras')
def api_bandeiras():
    """Rota para obter lista de bandeiras"""
    if not cache['dados_json']:
        return jsonify({'erro': 'Dados não disponíveis'}), 500
    
    bandeiras = list(cache['dados_json']['postos_por_bandeira'].keys())
    bandeiras.sort()
    
    return jsonify({
        'bandeiras': bandeiras,
        'total': len(bandeiras)
    })

# Rota para buscar postos por texto
@app.route('/api/postos/busca')
def api_postos_busca():
    """Rota para buscar postos por texto"""
    # Obter parâmetros
    texto = request.args.get('q', '').lower()
    limite = int(request.args.get('limite', 50))
    
    if not texto:
        return jsonify({'erro': 'Texto de busca é obrigatório'}), 400
    
    # Limitar limite
    limite = min(limite, 100)  # Máximo 100 postos
    
    # Verificar se os dados JSON estão disponíveis
    if not cache['dados_json']:
        return jsonify({'erro': 'Dados não disponíveis'}), 500
    
    # Medir tempo de execução
    inicio = time.time()
    
    # Buscar postos
    postos_encontrados = []
    
    # Buscar em todos os postos
    for posto in cache['dados_json']['postos']:
        # Verificar se o texto está no nome, endereço, bairro ou cidade
        if (texto in posto.get('nome', '').lower() or
            texto in posto.get('endereco', '').lower() or
            texto in posto.get('bairro', '').lower() or
            texto in posto.get('cidade', '').lower()):
            postos_encontrados.append(posto)
            
            # Limitar resultados
            if len(postos_encontrados) >= limite:
                break
    
    # Calcular tempo de execução
    tempo_execucao = time.time() - inicio
    
    # Retornar resultados
    return jsonify({
        'postos': postos_encontrados,
        'total': len(postos_encontrados),
        'tempo_execucao': tempo_execucao,
        'parametros': {
            'texto': texto,
            'limite': limite
        }
    })

# Inicializar cache ao iniciar a aplicação
# Usando with_app_context para compatibilidade com versões mais recentes do Flask
@app.route('/api/init-cache', methods=['GET'])
def init_cache_route():
    """Rota para inicializar o cache manualmente"""
    inicializar_cache()
    return jsonify({"status": "Cache inicializado com sucesso"})

# Inicializar cache imediatamente
with app.app_context():
    inicializar_cache()

# Função principal
if __name__ == '__main__':
    # Inicializar cache
    inicializar_cache()
    
    # Obter porta da linha de comando ou usar 5000 como padrão
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    
    # Iniciar servidor
    app.run(host='0.0.0.0', port=porta, debug=True)
