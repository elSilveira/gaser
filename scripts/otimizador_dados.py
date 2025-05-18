#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script para otimização de armazenamento e indexação de dados de postos de combustíveis
Implementa estruturas de dados espaciais para busca ultrarrápida
"""

import os
import json
import pandas as pd
import numpy as np
import sqlite3
import rtree
import logging
from datetime import datetime
import pickle
import math
from tqdm import tqdm
import shutil

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("/home/ubuntu/mapa_postos_combustiveis/data/otimizador.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("otimizador_dados")

# Diretório para dados
DATA_DIR = "/home/ubuntu/mapa_postos_combustiveis/data"
INDEX_DIR = os.path.join(DATA_DIR, "indices")
os.makedirs(INDEX_DIR, exist_ok=True)

class OtimizadorDados:
    """Classe para otimização de armazenamento e indexação de dados"""
    
    def __init__(self, arquivo_entrada=None):
        # Se não for especificado, usar o arquivo geocodificado mais recente
        if arquivo_entrada is None:
            # Encontrar o arquivo geocodificado mais recente
            arquivos = [f for f in os.listdir(DATA_DIR) if f.startswith('postos_geocodificados_') and f.endswith('.json')]
            if not arquivos:
                # Se não encontrar geocodificado, tentar consolidado
                arquivos = [f for f in os.listdir(DATA_DIR) if f.startswith('postos_consolidados_') and f.endswith('.json')]
                
            if not arquivos:
                raise ValueError("Nenhum arquivo de postos encontrado")
                
            # Ordenar por data (mais recente primeiro)
            arquivos.sort(reverse=True)
            self.arquivo_entrada = os.path.join(DATA_DIR, arquivos[0])
        else:
            self.arquivo_entrada = arquivo_entrada
            
        self.postos = []
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.db_path = os.path.join(DATA_DIR, f"postos_otimizados_{self.timestamp}.db")
        self.rtree_path = os.path.join(INDEX_DIR, f"rtree_index_{self.timestamp}")
        self.grid_index_path = os.path.join(INDEX_DIR, f"grid_index_{self.timestamp}.pkl")
        self.kd_tree_path = os.path.join(INDEX_DIR, f"kd_tree_{self.timestamp}.pkl")
        self.json_otimizado_path = os.path.join(DATA_DIR, f"postos_otimizados_{self.timestamp}.json")
        
    def carregar_dados(self):
        """Carrega os dados do arquivo de entrada"""
        logger.info(f"Carregando dados de {self.arquivo_entrada}")
        
        try:
            with open(self.arquivo_entrada, 'r', encoding='utf-8') as f:
                self.postos = json.load(f)
                
            logger.info(f"Carregados {len(self.postos)} postos")
            return True
        except Exception as e:
            logger.error(f"Erro ao carregar arquivo: {str(e)}")
            return False
            
    def validar_dados(self):
        """Valida os dados e corrige problemas"""
        logger.info("Validando e corrigindo dados...")
        
        postos_validos = []
        postos_invalidos = 0
        
        for posto in self.postos:
            # Verificar se tem coordenadas válidas
            try:
                lat = float(posto.get('latitude', 0))
                lon = float(posto.get('longitude', 0))
                
                if lat == 0 and lon == 0:
                    postos_invalidos += 1
                    continue
                    
                # Normalizar campos numéricos
                for campo in ['latitude', 'longitude']:
                    if campo in posto:
                        posto[campo] = float(posto[campo])
                        
                # Normalizar preços
                for campo in ['preco_gasolina', 'preco_alcool', 'preco_diesel', 'preco_gnv']:
                    if campo in posto and posto[campo] not in [None, '', 'N/A']:
                        # Converter de string com vírgula para float
                        try:
                            valor = posto[campo].replace(',', '.')
                            posto[campo] = float(valor)
                        except:
                            posto[campo] = None
                            
                # Garantir que todos os campos necessários existam
                campos_obrigatorios = {
                    'id': posto.get('id', f"posto_{len(postos_validos)}"),
                    'nome': posto.get('nome', 'Posto sem nome'),
                    'bandeira': posto.get('bandeira', 'Bandeira Branca'),
                    'endereco': posto.get('endereco', ''),
                    'bairro': posto.get('bairro', ''),
                    'cidade': posto.get('cidade', ''),
                    'estado': posto.get('estado', ''),
                    'latitude': lat,
                    'longitude': lon,
                    'preco_gasolina': posto.get('preco_gasolina', None),
                    'preco_alcool': posto.get('preco_alcool', None),
                    'preco_diesel': posto.get('preco_diesel', None),
                    'preco_gnv': posto.get('preco_gnv', None),
                    'data_coleta': posto.get('data_coleta', datetime.now().strftime("%Y-%m-%d")),
                    'fonte': posto.get('fonte', 'Desconhecida')
                }
                
                # Atualizar posto com campos normalizados
                posto.update(campos_obrigatorios)
                
                postos_validos.append(posto)
            except Exception as e:
                logger.warning(f"Erro ao validar posto: {str(e)}")
                postos_invalidos += 1
                
        logger.info(f"Validação concluída. Postos válidos: {len(postos_validos)}, inválidos: {postos_invalidos}")
        self.postos = postos_validos
        
    def criar_banco_sqlite(self):
        """Cria banco SQLite otimizado para consultas"""
        logger.info(f"Criando banco SQLite em {self.db_path}")
        
        try:
            # Conectar ao banco
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Criar tabela principal
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS postos (
                id TEXT PRIMARY KEY,
                nome TEXT,
                bandeira TEXT,
                endereco TEXT,
                bairro TEXT,
                cidade TEXT,
                estado TEXT,
                latitude REAL,
                longitude REAL,
                preco_gasolina REAL,
                preco_alcool REAL,
                preco_diesel REAL,
                preco_gnv REAL,
                data_coleta TEXT,
                fonte TEXT
            )
            ''')
            
            # Criar índices para campos de busca frequente
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_cidade ON postos (cidade)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_estado ON postos (estado)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_bandeira ON postos (bandeira)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_preco_gasolina ON postos (preco_gasolina)')
            
            # Inserir dados
            for posto in tqdm(self.postos, desc="Inserindo no SQLite"):
                cursor.execute('''
                INSERT INTO postos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    posto['id'],
                    posto['nome'],
                    posto['bandeira'],
                    posto['endereco'],
                    posto['bairro'],
                    posto['cidade'],
                    posto['estado'],
                    posto['latitude'],
                    posto['longitude'],
                    posto['preco_gasolina'],
                    posto['preco_alcool'],
                    posto['preco_diesel'],
                    posto['preco_gnv'],
                    posto['data_coleta'],
                    posto['fonte']
                ))
            
            # Commit e fechar
            conn.commit()
            conn.close()
            
            logger.info(f"Banco SQLite criado com sucesso: {self.db_path}")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar banco SQLite: {str(e)}")
            return False
            
    def criar_rtree_index(self):
        """Cria índice R-tree para consultas espaciais ultrarrápidas"""
        logger.info(f"Criando índice R-tree em {self.rtree_path}")
        
        try:
            # Criar índice
            idx = rtree.index.Index(self.rtree_path)
            
            # Inserir dados
            for i, posto in enumerate(tqdm(self.postos, desc="Criando R-tree")):
                lat = posto['latitude']
                lon = posto['longitude']
                
                # Inserir ponto (como um retângulo mínimo)
                idx.insert(i, (lon, lat, lon, lat), obj=posto['id'])
            
            # Fechar índice
            idx.close()
            
            logger.info(f"Índice R-tree criado com sucesso: {self.rtree_path}")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar índice R-tree: {str(e)}")
            return False
            
    def criar_grid_index(self, tamanho_celula=0.1):
        """
        Cria índice de grid para consultas espaciais rápidas
        
        Args:
            tamanho_celula: Tamanho da célula do grid em graus
        """
        logger.info(f"Criando índice de grid em {self.grid_index_path}")
        
        try:
            # Dicionário para armazenar postos por célula do grid
            grid = {}
            
            # Inserir dados
            for posto in tqdm(self.postos, desc="Criando Grid Index"):
                lat = posto['latitude']
                lon = posto['longitude']
                
                # Calcular índices do grid
                lat_idx = int(lat / tamanho_celula)
                lon_idx = int(lon / tamanho_celula)
                
                # Chave do grid
                grid_key = f"{lat_idx}_{lon_idx}"
                
                if grid_key not in grid:
                    grid[grid_key] = []
                    
                grid[grid_key].append(posto['id'])
            
            # Salvar índice
            with open(self.grid_index_path, 'wb') as f:
                pickle.dump({
                    'grid': grid,
                    'tamanho_celula': tamanho_celula,
                    'postos_ids': {posto['id']: (posto['latitude'], posto['longitude']) for posto in self.postos}
                }, f)
            
            logger.info(f"Índice de grid criado com sucesso: {self.grid_index_path}")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar índice de grid: {str(e)}")
            return False
            
    def criar_kd_tree(self):
        """Cria KD-Tree para consultas de vizinhos mais próximos"""
        logger.info(f"Criando KD-Tree em {self.kd_tree_path}")
        
        try:
            # Extrair coordenadas
            coords = np.array([(posto['latitude'], posto['longitude']) for posto in self.postos])
            ids = [posto['id'] for posto in self.postos]
            
            # Salvar dados para KD-Tree
            with open(self.kd_tree_path, 'wb') as f:
                pickle.dump({
                    'coords': coords,
                    'ids': ids
                }, f)
            
            logger.info(f"Dados para KD-Tree salvos com sucesso: {self.kd_tree_path}")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar KD-Tree: {str(e)}")
            return False
            
    def otimizar_json(self):
        """Cria versão otimizada do JSON para carregamento rápido"""
        logger.info(f"Criando JSON otimizado em {self.json_otimizado_path}")
        
        try:
            # Criar dicionário de postos por ID para acesso O(1)
            postos_por_id = {posto['id']: posto for posto in self.postos}
            
            # Criar listas de postos por estado para filtragem rápida
            postos_por_estado = {}
            for posto in self.postos:
                estado = posto['estado']
                if estado not in postos_por_estado:
                    postos_por_estado[estado] = []
                postos_por_estado[estado].append(posto['id'])
            
            # Criar listas de postos por cidade para filtragem rápida
            postos_por_cidade = {}
            for posto in self.postos:
                cidade = posto['cidade']
                if cidade not in postos_por_cidade:
                    postos_por_cidade[cidade] = []
                postos_por_cidade[cidade].append(posto['id'])
            
            # Criar listas de postos por bandeira para filtragem rápida
            postos_por_bandeira = {}
            for posto in self.postos:
                bandeira = posto['bandeira']
                if bandeira not in postos_por_bandeira:
                    postos_por_bandeira[bandeira] = []
                postos_por_bandeira[bandeira].append(posto['id'])
            
            # Criar estrutura otimizada
            dados_otimizados = {
                'postos': self.postos,
                'postos_por_id': postos_por_id,
                'postos_por_estado': postos_por_estado,
                'postos_por_cidade': postos_por_cidade,
                'postos_por_bandeira': postos_por_bandeira,
                'metadata': {
                    'total_postos': len(self.postos),
                    'total_estados': len(postos_por_estado),
                    'total_cidades': len(postos_por_cidade),
                    'total_bandeiras': len(postos_por_bandeira),
                    'data_geracao': datetime.now().isoformat()
                }
            }
            
            # Salvar JSON otimizado
            with open(self.json_otimizado_path, 'w', encoding='utf-8') as f:
                json.dump(dados_otimizados, f, ensure_ascii=False)
            
            logger.info(f"JSON otimizado criado com sucesso: {self.json_otimizado_path}")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar JSON otimizado: {str(e)}")
            return False
            
    def criar_links_mais_recentes(self):
        """Cria links simbólicos para os arquivos mais recentes"""
        logger.info("Criando links simbólicos para os arquivos mais recentes")
        
        try:
            # Definir caminhos para links
            db_link = os.path.join(DATA_DIR, "postos_latest.db")
            json_link = os.path.join(DATA_DIR, "postos_latest.json")
            rtree_link = os.path.join(INDEX_DIR, "rtree_latest")
            grid_link = os.path.join(INDEX_DIR, "grid_latest.pkl")
            kd_tree_link = os.path.join(INDEX_DIR, "kd_tree_latest.pkl")
            
            # Remover links existentes
            for link in [db_link, json_link, rtree_link, grid_link, kd_tree_link]:
                if os.path.exists(link):
                    if os.path.islink(link):
                        os.unlink(link)
                    else:
                        os.remove(link)
            
            # Criar cópias em vez de links simbólicos (mais compatível)
            shutil.copy2(self.db_path, db_link)
            shutil.copy2(self.json_otimizado_path, json_link)
            
            # Copiar arquivos do rtree (vários arquivos com extensões)
            for ext in ['.dat', '.idx']:
                src = f"{self.rtree_path}{ext}"
                dst = f"{rtree_link}{ext}"
                if os.path.exists(src):
                    shutil.copy2(src, dst)
            
            shutil.copy2(self.grid_index_path, grid_link)
            shutil.copy2(self.kd_tree_path, kd_tree_link)
            
            logger.info("Links para arquivos mais recentes criados com sucesso")
            return True
        except Exception as e:
            logger.error(f"Erro ao criar links: {str(e)}")
            return False
            
    def executar_otimizacao(self):
        """Executa todo o processo de otimização"""
        logger.info("Iniciando processo de otimização")
        
        # Carregar dados
        if not self.carregar_dados():
            return False
            
        # Validar dados
        self.validar_dados()
        
        # Criar estruturas otimizadas
        self.criar_banco_sqlite()
        self.criar_rtree_index()
        self.criar_grid_index()
        self.criar_kd_tree()
        self.otimizar_json()
        
        # Criar links para os arquivos mais recentes
        self.criar_links_mais_recentes()
        
        logger.info("Processo de otimização concluído com sucesso")
        
        # Retornar caminhos dos arquivos gerados
        return {
            'db_path': self.db_path,
            'json_path': self.json_otimizado_path,
            'rtree_path': self.rtree_path,
            'grid_path': self.grid_index_path,
            'kd_tree_path': self.kd_tree_path,
            'latest_db': os.path.join(DATA_DIR, "postos_latest.db"),
            'latest_json': os.path.join(DATA_DIR, "postos_latest.json")
        }

def main():
    """Função principal"""
    try:
        otimizador = OtimizadorDados()
        resultados = otimizador.executar_otimizacao()
        
        if resultados:
            logger.info("Otimização concluída com sucesso")
            logger.info(f"Arquivos gerados: {resultados}")
            return resultados
        else:
            logger.error("Falha na otimização")
            return None
    except Exception as e:
        logger.error(f"Erro durante a otimização: {str(e)}")
        return None

if __name__ == "__main__":
    main()
