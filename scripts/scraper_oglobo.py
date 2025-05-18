#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para extrair dados de postos de combustíveis do infográfico de O Globo
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import json
import os
from datetime import datetime

# URL do infográfico
URL = "https://infograficos.oglobo.globo.com/economia/veja-o-preco-da-gasolina-perto-de-voce.html"

def extract_posto_data(html_content):
    """
    Extrai dados de postos de combustíveis do HTML do infográfico
    """
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Encontrar todos os blocos de postos
    posto_blocks = []
    
    # O padrão observado é que cada posto tem um nome, endereço, bairro e cidade/estado
    # Vamos extrair esses blocos de texto
    
    # Primeiro, vamos tentar encontrar todos os textos relevantes
    all_text = soup.get_text()
    
    # Padrão para encontrar blocos de postos
    pattern = r"Posto\s+([^\n]+)\s*\n\s*([^\n]+)\s*\n\s*([^\n]+)\s*\n\s*([^,]+),\s*([A-Z]{2})"
    
    matches = re.findall(pattern, all_text)
    
    postos = []
    for match in matches:
        bandeira, endereco, bairro, cidade, estado = match
        
        # Extrair preço (se disponível)
        # Como não temos um padrão claro para o preço no texto, vamos usar um valor padrão
        preco = "N/A"
        
        # Procurar por padrões de preço próximos ao posto
        price_pattern = r"R\$\s*(\d+,\d+)"
        price_matches = re.findall(price_pattern, all_text)
        if price_matches:
            preco = price_matches[0]
        
        posto = {
            "nome": f"Posto {bandeira}",
            "bandeira": bandeira,
            "endereco": endereco,
            "bairro": bairro,
            "cidade": cidade,
            "estado": estado,
            "preco_gasolina": preco,
            "data_coleta": datetime.now().strftime("%Y-%m-%d"),
            "fonte": "O Globo"
        }
        postos.append(posto)
    
    return postos

def scrape_oglobo():
    """
    Função principal para fazer scraping do infográfico de O Globo
    """
    print(f"Iniciando scraping de {URL}")
    
    try:
        # Fazer requisição para a página
        response = requests.get(URL)
        response.raise_for_status()
        
        # Extrair dados dos postos
        postos = extract_posto_data(response.text)
        
        print(f"Extraídos {len(postos)} postos de combustíveis")
        
        # Salvar dados em CSV
        output_dir = "/home/ubuntu/mapa_postos_combustiveis/data"
        os.makedirs(output_dir, exist_ok=True)
        
        df = pd.DataFrame(postos)
        csv_path = os.path.join(output_dir, "postos_oglobo.csv")
        df.to_csv(csv_path, index=False)
        
        # Salvar também em JSON para facilitar o uso posterior
        json_path = os.path.join(output_dir, "postos_oglobo.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(postos, f, ensure_ascii=False, indent=4)
        
        print(f"Dados salvos em {csv_path} e {json_path}")
        
        return postos
    
    except Exception as e:
        print(f"Erro ao fazer scraping: {e}")
        return []

if __name__ == "__main__":
    scrape_oglobo()
