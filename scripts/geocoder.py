#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para geocodificar endereços de postos de combustíveis
"""

import os
import json
import pandas as pd
import requests
import time
from tqdm import tqdm

def geocode_address(endereco, cidade, estado):
    """
    Geocodifica um endereço usando a API do Nominatim (OpenStreetMap)
    """
    # Formatar o endereço completo
    endereco_completo = f"{endereco}, {cidade}, {estado}, Brasil"
    
    # Parâmetros da requisição
    params = {
        'q': endereco_completo,
        'format': 'json',
        'limit': 1,
        'countrycodes': 'br'
    }
    
    # URL da API Nominatim
    url = "https://nominatim.openstreetmap.org/search"
    
    try:
        # Fazer a requisição
        response = requests.get(url, params=params)
        response.raise_for_status()
        
        # Processar a resposta
        data = response.json()
        
        # Verificar se encontrou resultados
        if data and len(data) > 0:
            lat = float(data[0]['lat'])
            lon = float(data[0]['lon'])
            return lat, lon
        else:
            print(f"Nenhum resultado encontrado para: {endereco_completo}")
            return None, None
    
    except Exception as e:
        print(f"Erro ao geocodificar {endereco_completo}: {e}")
        return None, None

def process_and_geocode():
    """
    Processa e geocodifica os endereços dos postos
    """
    # Caminho para o arquivo JSON com os dados dos postos
    input_path = "/home/ubuntu/mapa_postos_combustiveis/data/postos_dados.json"
    
    # Verificar se o arquivo existe
    if not os.path.exists(input_path):
        print(f"Arquivo não encontrado: {input_path}")
        return
    
    # Carregar os dados
    with open(input_path, 'r', encoding='utf-8') as f:
        postos = json.load(f)
    
    print(f"Processando {len(postos)} postos...")
    
    # Contador de postos já geocodificados
    geocoded_count = 0
    
    # Processar cada posto
    for posto in tqdm(postos):
        # Verificar se já tem coordenadas
        if 'latitude' in posto and 'longitude' in posto and posto['latitude'] and posto['longitude']:
            geocoded_count += 1
            continue
        
        # Extrair informações de endereço
        endereco = posto.get('endereco', '')
        cidade = posto.get('cidade', '')
        estado = posto.get('estado', '')
        
        # Geocodificar o endereço
        lat, lon = geocode_address(endereco, cidade, estado)
        
        # Atualizar o posto com as coordenadas
        if lat and lon:
            posto['latitude'] = lat
            posto['longitude'] = lon
            geocoded_count += 1
        
        # Esperar um pouco para não sobrecarregar a API
        time.sleep(1)
    
    print(f"Geocodificação concluída: {geocoded_count}/{len(postos)} postos com coordenadas")
    
    # Salvar os dados atualizados
    output_path = "/home/ubuntu/mapa_postos_combustiveis/data/postos_geocoded.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(postos, f, ensure_ascii=False, indent=4)
    
    # Salvar também em CSV
    df = pd.DataFrame(postos)
    csv_path = "/home/ubuntu/mapa_postos_combustiveis/data/postos_geocoded.csv"
    df.to_csv(csv_path, index=False)
    
    print(f"Dados geocodificados salvos em {output_path} e {csv_path}")
    
    return postos

if __name__ == "__main__":
    process_and_geocode()
