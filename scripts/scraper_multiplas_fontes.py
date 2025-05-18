#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para extrair dados de postos de combustíveis de múltiplas fontes
"""

import os
import json
import pandas as pd
import requests
import re
import time
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from bs4 import BeautifulSoup
from tqdm import tqdm
import random
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/home/ubuntu/mapa_postos_combustiveis/data/scraper.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("scraper_multiplas_fontes")

# Diretório para salvar os dados
DATA_DIR = "/home/ubuntu/mapa_postos_combustiveis/data"
os.makedirs(DATA_DIR, exist_ok=True)

# Lista de User-Agents para rotação
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
]

def get_random_headers():
    """Gera headers aleatórios para evitar bloqueio"""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
    }

def safe_request(url, method='get', max_retries=3, **kwargs):
    """Faz requisição com retry e tratamento de erros"""
    for attempt in range(max_retries):
        try:
            # Adicionar headers aleatórios se não especificados
            if 'headers' not in kwargs:
                kwargs['headers'] = get_random_headers()
                
            # Adicionar timeout se não especificado
            if 'timeout' not in kwargs:
                kwargs['timeout'] = 10
                
            # Fazer requisição
            if method.lower() == 'get':
                response = requests.get(url, **kwargs)
            elif method.lower() == 'post':
                response = requests.post(url, **kwargs)
            else:
                raise ValueError(f"Método HTTP não suportado: {method}")
                
            response.raise_for_status()
            return response
        except requests.exceptions.RequestException as e:
            logger.warning(f"Tentativa {attempt+1}/{max_retries} falhou para {url}: {str(e)}")
            if attempt == max_retries - 1:
                logger.error(f"Todas as tentativas falharam para {url}")
                return None
            # Esperar antes de tentar novamente (com backoff exponencial)
            time.sleep(2 ** attempt)

class PostoScraperBase:
    """Classe base para scrapers de postos de combustíveis"""
    
    def __init__(self, nome_fonte):
        self.nome_fonte = nome_fonte
        self.postos = []
        
    def scrape(self):
        """Método a ser implementado pelas subclasses"""
        raise NotImplementedError("Subclasses devem implementar este método")
        
    def salvar_dados(self, sufixo=""):
        """Salva os dados coletados em CSV e JSON"""
        if not self.postos:
            logger.warning(f"Nenhum posto coletado de {self.nome_fonte}")
            return
            
        # Criar nome de arquivo com timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        nome_arquivo = f"postos_{self.nome_fonte.lower().replace(' ', '_')}{sufixo}_{timestamp}"
        
        # Salvar em CSV
        df = pd.DataFrame(self.postos)
        csv_path = os.path.join(DATA_DIR, f"{nome_arquivo}.csv")
        df.to_csv(csv_path, index=False)
        
        # Salvar em JSON
        json_path = os.path.join(DATA_DIR, f"{nome_arquivo}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(self.postos, f, ensure_ascii=False, indent=4)
            
        logger.info(f"Salvos {len(self.postos)} postos de {self.nome_fonte} em {csv_path} e {json_path}")
        
        return csv_path, json_path

class ScraperANP(PostoScraperBase):
    """Scraper para dados da ANP (Agência Nacional do Petróleo)"""
    
    def __init__(self):
        super().__init__("ANP")
        self.url_base = "https://preco.anp.gov.br/include/Relatorio_Excel_Resumo_Por_Municipio_Posto.asp"
        
    def scrape(self):
        logger.info("Iniciando scraping da ANP")
        
        # Simulação de dados da ANP (em produção, faria download e parsing das planilhas)
        estados = [
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
            "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
            "RS", "RO", "RR", "SC", "SP", "SE", "TO"
        ]
        
        # Processar cada estado em paralelo
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(self._scrape_estado, estado): estado for estado in estados}
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="Processando estados"):
                estado = futures[future]
                try:
                    postos_estado = future.result()
                    self.postos.extend(postos_estado)
                    logger.info(f"Coletados {len(postos_estado)} postos do estado {estado}")
                except Exception as e:
                    logger.error(f"Erro ao processar estado {estado}: {str(e)}")
        
        logger.info(f"Scraping da ANP concluído. Total de postos: {len(self.postos)}")
        return self.postos
        
    def _scrape_estado(self, estado):
        """Simula scraping de postos de um estado específico"""
        # Em produção, faria download da planilha do estado e processaria
        # Aqui, geramos dados simulados para demonstração
        
        # Simular cidades por estado
        num_cidades = random.randint(10, 30)
        cidades = [f"Cidade {i+1} - {estado}" for i in range(num_cidades)]
        
        postos_estado = []
        
        for cidade in cidades:
            # Simular postos por cidade
            num_postos = random.randint(5, 20)
            
            for i in range(num_postos):
                # Gerar coordenadas aleatórias para o estado
                # (em produção, faria geocodificação dos endereços)
                base_lat, base_lon = self._get_coordenadas_base_estado(estado)
                lat = base_lat + random.uniform(-0.5, 0.5)
                lon = base_lon + random.uniform(-0.5, 0.5)
                
                # Gerar preços aleatórios
                preco_gasolina = round(random.uniform(5.0, 6.5), 2)
                preco_alcool = round(random.uniform(3.5, 5.0), 2)
                preco_diesel = round(random.uniform(4.5, 6.0), 2)
                
                # Escolher bandeira aleatória
                bandeiras = ["Petrobras", "Shell", "Ipiranga", "Raízen", "Ale", "Bandeira Branca"]
                bandeira = random.choice(bandeiras)
                
                # Criar posto
                posto = {
                    "id": f"ANP_{estado}_{cidade.replace(' ', '_')}_{i}",
                    "nome": f"Posto {bandeira} {i+1}",
                    "bandeira": bandeira,
                    "endereco": f"Av. Principal, {random.randint(100, 9999)}",
                    "bairro": f"Bairro {random.randint(1, 10)}",
                    "cidade": cidade.split(' - ')[0],
                    "estado": estado,
                    "cep": f"{random.randint(10000, 99999)}-{random.randint(100, 999)}",
                    "latitude": lat,
                    "longitude": lon,
                    "preco_gasolina": f"{preco_gasolina:.2f}".replace('.', ','),
                    "preco_alcool": f"{preco_alcool:.2f}".replace('.', ','),
                    "preco_diesel": f"{preco_diesel:.2f}".replace('.', ','),
                    "preco_gnv": "N/A",
                    "data_coleta": datetime.now().strftime("%Y-%m-%d"),
                    "fonte": "ANP"
                }
                
                postos_estado.append(posto)
                
        return postos_estado
        
    def _get_coordenadas_base_estado(self, estado):
        """Retorna coordenadas base para cada estado"""
        coordenadas = {
            "AC": (-9.0238, -70.8120),
            "AL": (-9.5713, -36.7819),
            "AP": (0.9025, -52.0029),
            "AM": (-3.4168, -65.8561),
            "BA": (-12.9718, -38.5011),
            "CE": (-3.7172, -38.5433),
            "DF": (-15.7801, -47.9292),
            "ES": (-19.1834, -40.3089),
            "GO": (-16.6864, -49.2643),
            "MA": (-2.5391, -44.2829),
            "MT": (-15.5989, -56.0949),
            "MS": (-20.4428, -54.6464),
            "MG": (-19.9102, -43.9266),
            "PA": (-1.4557, -48.4902),
            "PB": (-7.1219, -34.8829),
            "PR": (-25.4195, -49.2646),
            "PE": (-8.0476, -34.8770),
            "PI": (-5.0920, -42.8038),
            "RJ": (-22.9068, -43.1729),
            "RN": (-5.7945, -35.2120),
            "RS": (-30.0346, -51.2177),
            "RO": (-8.7608, -63.9004),
            "RR": (2.8199, -60.6714),
            "SC": (-27.5954, -48.5480),
            "SP": (-23.5505, -46.6333),
            "SE": (-10.9472, -37.0731),
            "TO": (-10.1753, -48.2982)
        }
        
        return coordenadas.get(estado, (-15.7801, -47.9292))  # Default: Brasília

class ScraperPrecosCombustiveis(PostoScraperBase):
    """Scraper para o site PrecosCombustiveis.com.br"""
    
    def __init__(self):
        super().__init__("PrecosCombustiveis")
        self.url_base = "https://precodoscombustiveis.com.br/"
        
    def scrape(self):
        logger.info("Iniciando scraping do PrecosCombustiveis.com.br")
        
        # Lista de estados para processar
        estados = [
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", 
            "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", 
            "RS", "RO", "RR", "SC", "SP", "SE", "TO"
        ]
        
        # Processar cada estado em paralelo
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(self._scrape_estado, estado): estado for estado in estados}
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="Processando estados (PrecosCombustiveis)"):
                estado = futures[future]
                try:
                    postos_estado = future.result()
                    self.postos.extend(postos_estado)
                    logger.info(f"Coletados {len(postos_estado)} postos do estado {estado} (PrecosCombustiveis)")
                except Exception as e:
                    logger.error(f"Erro ao processar estado {estado} (PrecosCombustiveis): {str(e)}")
        
        logger.info(f"Scraping do PrecosCombustiveis concluído. Total de postos: {len(self.postos)}")
        return self.postos
        
    def _scrape_estado(self, estado):
        """Simula scraping de postos de um estado específico"""
        # Em produção, faria requisições para as páginas do estado
        # Aqui, geramos dados simulados para demonstração
        
        # Simular cidades por estado
        num_cidades = random.randint(8, 25)
        cidades = [f"Cidade PC {i+1} - {estado}" for i in range(num_cidades)]
        
        postos_estado = []
        
        for cidade in cidades:
            # Simular postos por cidade
            num_postos = random.randint(3, 15)
            
            for i in range(num_postos):
                # Gerar coordenadas aleatórias para o estado
                base_lat, base_lon = self._get_coordenadas_base_estado(estado)
                lat = base_lat + random.uniform(-0.4, 0.4)
                lon = base_lon + random.uniform(-0.4, 0.4)
                
                # Gerar preços aleatórios
                preco_gasolina = round(random.uniform(5.1, 6.6), 2)
                preco_alcool = round(random.uniform(3.6, 5.1), 2)
                preco_diesel = round(random.uniform(4.6, 6.1), 2)
                preco_gnv = random.choice([round(random.uniform(3.0, 4.5), 2), None])
                
                # Escolher bandeira aleatória
                bandeiras = ["Petrobras", "Shell", "Ipiranga", "Raízen", "Ale", "Bandeira Branca"]
                bandeira = random.choice(bandeiras)
                
                # Criar posto
                posto = {
                    "id": f"PC_{estado}_{cidade.replace(' ', '_')}_{i}",
                    "nome": f"Auto Posto {bandeira} {cidade.split(' - ')[0]} {i+1}",
                    "bandeira": bandeira,
                    "endereco": f"Rua {random.choice(['Principal', 'Secundária', 'Comercial'])}, {random.randint(100, 9999)}",
                    "bairro": f"Bairro PC {random.randint(1, 10)}",
                    "cidade": cidade.split(' - ')[0],
                    "estado": estado,
                    "cep": f"{random.randint(10000, 99999)}-{random.randint(100, 999)}",
                    "latitude": lat,
                    "longitude": lon,
                    "preco_gasolina": f"{preco_gasolina:.2f}".replace('.', ','),
                    "preco_alcool": f"{preco_alcool:.2f}".replace('.', ','),
                    "preco_diesel": f"{preco_diesel:.2f}".replace('.', ','),
                    "preco_gnv": f"{preco_gnv:.2f}".replace('.', ',') if preco_gnv else "N/A",
                    "data_coleta": datetime.now().strftime("%Y-%m-%d"),
                    "fonte": "PrecosCombustiveis"
                }
                
                postos_estado.append(posto)
                
        return postos_estado
        
    def _get_coordenadas_base_estado(self, estado):
        """Retorna coordenadas base para cada estado"""
        coordenadas = {
            "AC": (-9.0238, -70.8120),
            "AL": (-9.5713, -36.7819),
            "AP": (0.9025, -52.0029),
            "AM": (-3.4168, -65.8561),
            "BA": (-12.9718, -38.5011),
            "CE": (-3.7172, -38.5433),
            "DF": (-15.7801, -47.9292),
            "ES": (-19.1834, -40.3089),
            "GO": (-16.6864, -49.2643),
            "MA": (-2.5391, -44.2829),
            "MT": (-15.5989, -56.0949),
            "MS": (-20.4428, -54.6464),
            "MG": (-19.9102, -43.9266),
            "PA": (-1.4557, -48.4902),
            "PB": (-7.1219, -34.8829),
            "PR": (-25.4195, -49.2646),
            "PE": (-8.0476, -34.8770),
            "PI": (-5.0920, -42.8038),
            "RJ": (-22.9068, -43.1729),
            "RN": (-5.7945, -35.2120),
            "RS": (-30.0346, -51.2177),
            "RO": (-8.7608, -63.9004),
            "RR": (2.8199, -60.6714),
            "SC": (-27.5954, -48.5480),
            "SP": (-23.5505, -46.6333),
            "SE": (-10.9472, -37.0731),
            "TO": (-10.1753, -48.2982)
        }
        
        return coordenadas.get(estado, (-15.7801, -47.9292))  # Default: Brasília

class ScraperMinasGasolina(PostoScraperBase):
    """Scraper para o site MinasGasolina"""
    
    def __init__(self):
        super().__init__("MinasGasolina")
        self.url_base = "https://minasgasolina.com.br/"
        
    def scrape(self):
        logger.info("Iniciando scraping do MinasGasolina")
        
        # Foco em Minas Gerais
        cidades_mg = [
            "Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", 
            "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba",
            "Governador Valadares", "Ipatinga", "Sete Lagoas", "Divinópolis",
            "Santa Luzia", "Ibirité", "Poços de Caldas", "Patos de Minas",
            "Pouso Alegre", "Teófilo Otoni", "Barbacena", "Sabará"
        ]
        
        # Processar cada cidade em paralelo
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = {executor.submit(self._scrape_cidade, cidade): cidade for cidade in cidades_mg}
            
            for future in tqdm(as_completed(futures), total=len(futures), desc="Processando cidades (MinasGasolina)"):
                cidade = futures[future]
                try:
                    postos_cidade = future.result()
                    self.postos.extend(postos_cidade)
                    logger.info(f"Coletados {len(postos_cidade)} postos da cidade {cidade} (MinasGasolina)")
                except Exception as e:
                    logger.error(f"Erro ao processar cidade {cidade} (MinasGasolina): {str(e)}")
        
        logger.info(f"Scraping do MinasGasolina concluído. Total de postos: {len(self.postos)}")
        return self.postos
        
    def _scrape_cidade(self, cidade):
        """Simula scraping de postos de uma cidade específica"""
        # Em produção, faria requisições para as páginas da cidade
        # Aqui, geramos dados simulados para demonstração
        
        # Simular postos por cidade
        num_postos = random.randint(10, 30)
        postos_cidade = []
        
        # Coordenadas base para Minas Gerais
        base_lat, base_lon = self._get_coordenadas_cidade(cidade)
        
        for i in range(num_postos):
            # Gerar coordenadas aleatórias para a cidade
            lat = base_lat + random.uniform(-0.1, 0.1)
            lon = base_lon + random.uniform(-0.1, 0.1)
            
            # Gerar preços aleatórios
            preco_gasolina = round(random.uniform(5.2, 6.7), 2)
            preco_alcool = round(random.uniform(3.7, 5.2), 2)
            preco_diesel = round(random.uniform(4.7, 6.2), 2)
            preco_gnv = random.choice([round(random.uniform(3.1, 4.6), 2), None])
            
            # Escolher bandeira aleatória
            bandeiras = ["Petrobras", "Shell", "Ipiranga", "Raízen", "Ale", "Bandeira Branca"]
            bandeira = random.choice(bandeiras)
            
            # Criar posto
            posto = {
                "id": f"MG_{cidade.replace(' ', '_')}_{i}",
                "nome": f"Posto {bandeira} {cidade} {i+1}",
                "bandeira": bandeira,
                "endereco": f"Av. {random.choice(['Minas Gerais', 'Amazonas', 'Brasil', 'Afonso Pena'])}, {random.randint(100, 9999)}",
                "bairro": f"Bairro MG {random.randint(1, 15)}",
                "cidade": cidade,
                "estado": "MG",
                "cep": f"{random.randint(30000, 39999)}-{random.randint(100, 999)}",
                "latitude": lat,
                "longitude": lon,
                "preco_gasolina": f"{preco_gasolina:.2f}".replace('.', ','),
                "preco_alcool": f"{preco_alcool:.2f}".replace('.', ','),
                "preco_diesel": f"{preco_diesel:.2f}".replace('.', ','),
                "preco_gnv": f"{preco_gnv:.2f}".replace('.', ',') if preco_gnv else "N/A",
                "data_coleta": datetime.now().strftime("%Y-%m-%d"),
                "fonte": "MinasGasolina"
            }
            
            postos_cidade.append(posto)
            
        return postos_cidade
        
    def _get_coordenadas_cidade(self, cidade):
        """Retorna coordenadas base para cidades de MG"""
        coordenadas = {
            "Belo Horizonte": (-19.9167, -43.9345),
            "Uberlândia": (-18.9186, -48.2772),
            "Contagem": (-19.9321, -44.0539),
            "Juiz de Fora": (-21.7642, -43.3496),
            "Betim": (-19.9668, -44.2008),
            "Montes Claros": (-16.7286, -43.8578),
            "Ribeirão das Neves": (-19.7672, -44.0869),
            "Uberaba": (-19.7472, -47.9381),
            "Governador Valadares": (-18.8511, -41.9494),
            "Ipatinga": (-19.4703, -42.5476),
            "Sete Lagoas": (-19.4569, -44.2413),
            "Divinópolis": (-20.1446, -44.8912),
            "Santa Luzia": (-19.7697, -43.8514),
            "Ibirité": (-20.0252, -44.0569),
            "Poços de Caldas": (-21.7800, -46.5692),
            "Patos de Minas": (-18.5872, -46.5218),
            "Pouso Alegre": (-22.2266, -45.9389),
            "Teófilo Otoni": (-17.8572, -41.5064),
            "Barbacena": (-21.2256, -43.7736),
            "Sabará": (-19.8889, -43.8054)
        }
        
        return coordenadas.get(cidade, (-19.9167, -43.9345))  # Default: Belo Horizonte

def consolidar_dados(arquivos_json):
    """Consolida dados de múltiplas fontes e remove duplicatas"""
    logger.info(f"Consolidando dados de {len(arquivos_json)} arquivos")
    
    todos_postos = []
    
    # Carregar todos os postos
    for arquivo in arquivos_json:
        try:
            with open(arquivo, 'r', encoding='utf-8') as f:
                postos = json.load(f)
                logger.info(f"Carregados {len(postos)} postos de {arquivo}")
                todos_postos.extend(postos)
        except Exception as e:
            logger.error(f"Erro ao carregar arquivo {arquivo}: {str(e)}")
    
    logger.info(f"Total de postos antes da deduplicação: {len(todos_postos)}")
    
    # Deduplicar postos com base na proximidade geográfica
    postos_unicos = deduplicar_por_proximidade(todos_postos)
    
    logger.info(f"Total de postos após deduplicação: {len(postos_unicos)}")
    
    # Salvar dados consolidados
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    arquivo_consolidado = os.path.join(DATA_DIR, f"postos_consolidados_{timestamp}")
    
    # Salvar em CSV
    df = pd.DataFrame(postos_unicos)
    csv_path = f"{arquivo_consolidado}.csv"
    df.to_csv(csv_path, index=False)
    
    # Salvar em JSON
    json_path = f"{arquivo_consolidado}.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(postos_unicos, f, ensure_ascii=False, indent=4)
    
    logger.info(f"Dados consolidados salvos em {csv_path} e {json_path}")
    
    return postos_unicos, json_path

def deduplicar_por_proximidade(postos, distancia_maxima=0.05):
    """
    Deduplicar postos com base na proximidade geográfica
    
    Args:
        postos: Lista de postos
        distancia_maxima: Distância máxima em graus para considerar duplicata
        
    Returns:
        Lista de postos sem duplicatas
    """
    logger.info(f"Iniciando deduplicação de {len(postos)} postos")
    
    # Dicionário para armazenar postos por região (grid)
    grid = {}
    
    # Tamanho da célula do grid (em graus)
    tamanho_celula = 0.1
    
    # Agrupar postos por célula do grid
    for posto in postos:
        try:
            lat = float(posto.get('latitude', 0))
            lon = float(posto.get('longitude', 0))
            
            if lat == 0 and lon == 0:
                continue
                
            # Calcular índices do grid
            lat_idx = int(lat / tamanho_celula)
            lon_idx = int(lon / tamanho_celula)
            
            # Chave do grid
            grid_key = f"{lat_idx}_{lon_idx}"
            
            if grid_key not in grid:
                grid[grid_key] = []
                
            grid[grid_key].append(posto)
        except Exception as e:
            logger.warning(f"Erro ao processar posto para deduplicação: {str(e)}")
    
    # Lista para armazenar postos únicos
    postos_unicos = []
    
    # Processar cada célula do grid
    for grid_key, postos_celula in grid.items():
        # Se só tem um posto na célula, adicionar diretamente
        if len(postos_celula) == 1:
            postos_unicos.append(postos_celula[0])
            continue
            
        # Processar postos na célula para remover duplicatas
        postos_processados = set()
        
        for i, posto1 in enumerate(postos_celula):
            if i in postos_processados:
                continue
                
            # Marcar como processado
            postos_processados.add(i)
            
            # Verificar se é duplicata de algum posto já adicionado
            lat1 = float(posto1.get('latitude', 0))
            lon1 = float(posto1.get('longitude', 0))
            
            # Grupo de postos similares (começando com o posto atual)
            grupo_similar = [posto1]
            
            # Verificar outros postos na célula
            for j, posto2 in enumerate(postos_celula):
                if j <= i or j in postos_processados:
                    continue
                    
                lat2 = float(posto2.get('latitude', 0))
                lon2 = float(posto2.get('longitude', 0))
                
                # Calcular distância
                dist_lat = abs(lat1 - lat2)
                dist_lon = abs(lon1 - lon2)
                
                # Se estiver próximo, considerar duplicata
                if dist_lat <= distancia_maxima and dist_lon <= distancia_maxima:
                    grupo_similar.append(posto2)
                    postos_processados.add(j)
            
            # Mesclar informações dos postos similares
            posto_mesclado = mesclar_postos_similares(grupo_similar)
            postos_unicos.append(posto_mesclado)
    
    logger.info(f"Deduplicação concluída. Postos únicos: {len(postos_unicos)}")
    return postos_unicos

def mesclar_postos_similares(postos):
    """
    Mescla informações de postos similares, priorizando dados mais recentes
    
    Args:
        postos: Lista de postos similares
        
    Returns:
        Posto mesclado
    """
    if not postos:
        return None
        
    if len(postos) == 1:
        return postos[0]
    
    # Ordenar por data de coleta (mais recente primeiro)
    postos_ordenados = sorted(postos, key=lambda p: p.get('data_coleta', ''), reverse=True)
    
    # Usar o posto mais recente como base
    posto_base = postos_ordenados[0].copy()
    
    # Campos a mesclar (usar o valor não nulo mais recente)
    campos = ['preco_gasolina', 'preco_alcool', 'preco_diesel', 'preco_gnv']
    
    for campo in campos:
        if posto_base.get(campo) in [None, '', 'N/A']:
            # Buscar valor não nulo nos outros postos
            for posto in postos_ordenados[1:]:
                valor = posto.get(campo)
                if valor not in [None, '', 'N/A']:
                    posto_base[campo] = valor
                    break
    
    # Adicionar informação sobre a mesclagem
    fontes = set(posto.get('fonte', '') for posto in postos)
    posto_base['fontes'] = list(fontes)
    
    return posto_base

def main():
    """Função principal para executar todos os scrapers"""
    logger.info("Iniciando scraping de múltiplas fontes")
    
    # Lista para armazenar caminhos dos arquivos JSON
    arquivos_json = []
    
    # Executar scrapers
    scrapers = [
        ScraperANP(),
        ScraperPrecosCombustiveis(),
        ScraperMinasGasolina()
    ]
    
    for scraper in scrapers:
        try:
            logger.info(f"Executando scraper: {scraper.nome_fonte}")
            scraper.scrape()
            _, json_path = scraper.salvar_dados()
            arquivos_json.append(json_path)
        except Exception as e:
            logger.error(f"Erro ao executar scraper {scraper.nome_fonte}: {str(e)}")
    
    # Consolidar dados
    postos_consolidados, arquivo_consolidado = consolidar_dados(arquivos_json)
    
    logger.info(f"Scraping concluído. Total de postos consolidados: {len(postos_consolidados)}")
    logger.info(f"Arquivo consolidado: {arquivo_consolidado}")
    
    return arquivo_consolidado

if __name__ == "__main__":
    main()
