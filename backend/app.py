#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Backend Flask para exposição dos dados de postos de combustíveis
"""

import os
import json
import math
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='../frontend')
CORS(app)  # Habilitar CORS para todas as rotas

# Carregar dados dos postos
DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'postos_geocoded.json')

def load_postos():
    """Carrega os dados dos postos do arquivo JSON"""
    try:
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Erro ao carregar dados: {e}")
        return []

# Carregar dados na inicialização
postos_data = load_postos()

def calcular_distancia(lat1, lon1, lat2, lon2):
    """
    Calcula a distância em km entre dois pontos usando a fórmula de Haversine
    """
    # Raio da Terra em km
    R = 6371.0
    
    # Converter graus para radianos
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    # Diferença entre latitudes e longitudes
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    # Fórmula de Haversine
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    # Distância em km
    distance = R * c
    
    return distance

@app.route('/')
def index():
    """Rota principal que serve o frontend"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    """Serve arquivos estáticos do frontend"""
    return send_from_directory(app.static_folder, path)

@app.route('/api/postos', methods=['GET'])
def get_all_postos():
    """Retorna todos os postos"""
    return jsonify(postos_data)

@app.route('/api/postos/proximos', methods=['GET'])
def get_postos_proximos():
    """
    Retorna postos próximos a uma localização
    
    Parâmetros:
    - lat: latitude (obrigatório)
    - lon: longitude (obrigatório)
    - raio: raio de busca em km (opcional, padrão: 5)
    - combustivel: tipo de combustível (opcional)
    - bandeira: bandeira do posto (opcional)
    - ordenar: critério de ordenação (opcional, 'distancia' ou 'preco')
    """
    try:
        # Obter parâmetros
        lat = float(request.args.get('lat', 0))
        lon = float(request.args.get('lon', 0))
        raio = float(request.args.get('raio', 5))
        combustivel = request.args.get('combustivel', None)
        bandeira = request.args.get('bandeira', None)
        ordenar = request.args.get('ordenar', 'distancia')
        
        # Validar parâmetros
        if lat == 0 and lon == 0:
            return jsonify({"error": "Latitude e longitude são obrigatórios"}), 400
        
        # Filtrar postos por distância
        postos_proximos = []
        for posto in postos_data:
            # Verificar se o posto tem coordenadas
            if 'latitude' not in posto or 'longitude' not in posto:
                continue
                
            # Calcular distância
            distancia = calcular_distancia(lat, lon, posto['latitude'], posto['longitude'])
            
            # Adicionar distância ao posto
            posto_com_distancia = posto.copy()
            posto_com_distancia['distancia'] = round(distancia, 2)
            
            # Filtrar por raio
            if distancia <= raio:
                # Filtrar por combustível
                if combustivel and combustivel.lower() == 'gasolina' and posto.get('preco_gasolina', 'N/A') == 'N/A':
                    continue
                elif combustivel and combustivel.lower() == 'alcool' and posto.get('preco_alcool', 'N/A') == 'N/A':
                    continue
                elif combustivel and combustivel.lower() == 'diesel' and posto.get('preco_diesel', 'N/A') == 'N/A':
                    continue
                elif combustivel and combustivel.lower() == 'gnv' and posto.get('preco_gnv', 'N/A') == 'N/A':
                    continue
                
                # Filtrar por bandeira
                if bandeira and bandeira.lower() != 'todas' and posto.get('bandeira', '').lower() != bandeira.lower():
                    continue
                
                postos_proximos.append(posto_com_distancia)
        
        # Ordenar resultados
        if ordenar == 'distancia':
            postos_proximos.sort(key=lambda x: x['distancia'])
        elif ordenar == 'preco' and combustivel:
            # Ordenar por preço do combustível selecionado
            preco_key = f'preco_{combustivel.lower()}'
            
            def get_preco(posto):
                preco = posto.get(preco_key, posto.get('preco_gasolina', 'N/A'))
                try:
                    # Converter preço de string para float
                    return float(preco.replace(',', '.'))
                except:
                    return float('inf')  # Preços inválidos vão para o final
                
            postos_proximos.sort(key=get_preco)
        
        return jsonify(postos_proximos)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/postos/cidades', methods=['GET'])
def get_cidades():
    """Retorna lista de cidades disponíveis"""
    cidades = set()
    for posto in postos_data:
        if 'cidade' in posto and posto['cidade']:
            cidades.add(posto['cidade'])
    
    return jsonify(sorted(list(cidades)))

@app.route('/api/postos/bandeiras', methods=['GET'])
def get_bandeiras():
    """Retorna lista de bandeiras disponíveis"""
    bandeiras = set()
    for posto in postos_data:
        if 'bandeira' in posto and posto['bandeira']:
            bandeiras.add(posto['bandeira'])
    
    return jsonify(sorted(list(bandeiras)))

@app.route('/api/postos/cidade/<cidade>', methods=['GET'])
def get_postos_por_cidade(cidade):
    """Retorna postos de uma cidade específica"""
    postos_cidade = [posto for posto in postos_data if posto.get('cidade', '').lower() == cidade.lower()]
    return jsonify(postos_cidade)

@app.route('/api/postos/<int:posto_id>', methods=['GET'])
def get_posto_by_id(posto_id):
    """Retorna detalhes de um posto específico pelo ID"""
    posto = next((p for p in postos_data if p.get('posto') == posto_id), None)
    if posto:
        return jsonify(posto)
    else:
        return jsonify({"error": "Posto não encontrado"}), 404

@app.route('/api/status', methods=['GET'])
def get_status():
    """Retorna status da API e estatísticas básicas"""
    total_postos = len(postos_data)
    cidades = set(posto.get('cidade') for posto in postos_data if 'cidade' in posto)
    estados = set(posto.get('estado') for posto in postos_data if 'estado' in posto)
    
    return jsonify({
        "status": "online",
        "total_postos": total_postos,
        "total_cidades": len(cidades),
        "total_estados": len(estados),
        "ultima_atualizacao": postos_data[0].get('data_coleta') if postos_data else None
    })

if __name__ == '__main__':
    # Verificar se os dados foram carregados corretamente
    if not postos_data:
        print(f"AVISO: Nenhum dado de posto encontrado em {DATA_PATH}")
    else:
        print(f"Carregados {len(postos_data)} postos de combustíveis")
    
    # Iniciar o servidor
    app.run(host='0.0.0.0', port=5000, debug=True)
