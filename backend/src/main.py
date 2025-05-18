import os
import sys
import json
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

app = Flask(__name__, static_folder='static')
CORS(app)

# Configuração para cache de resposta
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 86400  # 1 dia em segundos

# Dados simulados para postos de combustíveis
POSTOS_SIMULADOS = []

# Carregar dados simulados
def carregar_dados_simulados():
    global POSTOS_SIMULADOS
    try:
        # Tentar carregar de um arquivo JSON se existir
        if os.path.exists('data/postos_simulados.json'):
            with open('data/postos_simulados.json', 'r', encoding='utf-8') as f:
                POSTOS_SIMULADOS = json.load(f)
                print(f"Carregados {len(POSTOS_SIMULADOS)} postos simulados do arquivo")
        else:
            # Gerar dados simulados básicos
            from src.utils.dados_simulados import gerar_postos_simulados
            POSTOS_SIMULADOS = gerar_postos_simulados(500)
            print(f"Gerados {len(POSTOS_SIMULADOS)} postos simulados")
            
            # Salvar para uso futuro
            os.makedirs('data', exist_ok=True)
            with open('data/postos_simulados.json', 'w', encoding='utf-8') as f:
                json.dump(POSTOS_SIMULADOS, f, ensure_ascii=False)
    except Exception as e:
        print(f"Erro ao carregar dados simulados: {e}")
        # Dados mínimos para fallback
        POSTOS_SIMULADOS = [
            {
                "id": "1",
                "nome": "Auto Posto Exemplo",
                "bandeira": "Petrobras",
                "endereco": "Av. Paulista, 1000",
                "bairro": "Bela Vista",
                "cidade": "São Paulo",
                "estado": "SP",
                "latitude": -23.5505,
                "longitude": -46.6333,
                "preco_gasolina": "5.69",
                "preco_alcool": "3.99",
                "preco_diesel": "4.79",
                "preco_gnv": "3.29",
                "ultima_atualizacao": "2025-05-18",
                "distancia": 0.5
            }
        ]

# Rotas para arquivos estáticos
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

# API Routes
@app.route('/api/status')
def api_status():
    """Verificar status da API"""
    return jsonify({
        "status": "online",
        "version": "1.0.0",
        "timestamp": os.path.getmtime(__file__),
        "cache_enabled": True,
        "postos_count": len(POSTOS_SIMULADOS)
    })

@app.route('/api/postos/proximos')
def postos_proximos():
    """Buscar postos próximos a uma localização"""
    try:
        # Parâmetros da requisição
        lat = float(request.args.get('lat', -23.5505))
        lon = float(request.args.get('lon', -46.6333))
        raio = float(request.args.get('raio', 5))
        combustivel = request.args.get('combustivel', 'gasolina')
        bandeira = request.args.get('bandeira', 'todas')
        ordenar = request.args.get('ordenar', 'distancia')
        
        # Filtrar postos por distância
        from src.utils.geo_utils import calcular_distancia
        
        postos_filtrados = []
        for posto in POSTOS_SIMULADOS:
            # Calcular distância
            distancia = calcular_distancia(
                lat, lon, 
                float(posto['latitude']), float(posto['longitude'])
            )
            
            # Filtrar por raio
            if distancia <= raio:
                # Copiar posto e adicionar distância
                posto_com_distancia = posto.copy()
                posto_com_distancia['distancia'] = round(distancia, 2)
                postos_filtrados.append(posto_com_distancia)
        
        # Filtrar por combustível
        if combustivel != 'todas':
            campo_preco = f'preco_{combustivel}'
            postos_filtrados = [p for p in postos_filtrados if p.get(campo_preco, 'N/A') != 'N/A']
        
        # Filtrar por bandeira
        if bandeira != 'todas':
            postos_filtrados = [p for p in postos_filtrados if p['bandeira'].lower() == bandeira.lower()]
        
        # Ordenar resultados
        if ordenar == 'distancia':
            postos_filtrados.sort(key=lambda p: p['distancia'])
        elif ordenar == 'preco' and combustivel != 'todas':
            campo_preco = f'preco_{combustivel}'
            postos_filtrados.sort(key=lambda p: float(p.get(campo_preco, '999.99')))
        
        # Limitar a 100 resultados para performance
        postos_filtrados = postos_filtrados[:100]
        
        return jsonify({
            "postos": postos_filtrados,
            "total": len(postos_filtrados),
            "parametros": {
                "lat": lat,
                "lon": lon,
                "raio": raio,
                "combustivel": combustivel,
                "bandeira": bandeira,
                "ordenar": ordenar
            }
        })
    except Exception as e:
        return jsonify({
            "erro": str(e),
            "postos": []
        }), 500

@app.route('/api/postos/busca')
def postos_busca():
    """Buscar postos por texto"""
    try:
        # Parâmetros da requisição
        query = request.args.get('q', '').lower()
        combustivel = request.args.get('combustivel', 'gasolina')
        bandeira = request.args.get('bandeira', 'todas')
        ordenar = request.args.get('ordenar', 'distancia')
        
        if not query:
            return jsonify({
                "postos": [],
                "total": 0,
                "erro": "Query de busca vazia"
            }), 400
        
        # Filtrar postos por texto
        postos_filtrados = []
        for posto in POSTOS_SIMULADOS:
            # Verificar se o texto está presente em algum campo relevante
            if (query in posto['nome'].lower() or
                query in posto['endereco'].lower() or
                query in posto['bairro'].lower() or
                query in posto['cidade'].lower() or
                query in posto['estado'].lower()):
                
                postos_filtrados.append(posto.copy())
        
        # Filtrar por combustível
        if combustivel != 'todas':
            campo_preco = f'preco_{combustivel}'
            postos_filtrados = [p for p in postos_filtrados if p.get(campo_preco, 'N/A') != 'N/A']
        
        # Filtrar por bandeira
        if bandeira != 'todas':
            postos_filtrados = [p for p in postos_filtrados if p['bandeira'].lower() == bandeira.lower()]
        
        # Ordenar resultados
        if ordenar == 'preco' and combustivel != 'todas':
            campo_preco = f'preco_{combustivel}'
            postos_filtrados.sort(key=lambda p: float(p.get(campo_preco, '999.99')))
        
        # Limitar a 100 resultados para performance
        postos_filtrados = postos_filtrados[:100]
        
        return jsonify({
            "postos": postos_filtrados,
            "total": len(postos_filtrados),
            "parametros": {
                "q": query,
                "combustivel": combustivel,
                "bandeira": bandeira,
                "ordenar": ordenar
            }
        })
    except Exception as e:
        return jsonify({
            "erro": str(e),
            "postos": []
        }), 500

@app.route('/api/postos/<string:posto_id>')
def posto_detalhes(posto_id):
    """Obter detalhes de um posto específico"""
    try:
        # Buscar posto pelo ID
        posto = next((p for p in POSTOS_SIMULADOS if str(p['id']) == posto_id), None)
        
        if not posto:
            return jsonify({
                "erro": "Posto não encontrado",
                "posto": None
            }), 404
        
        return jsonify({
            "posto": posto
        })
    except Exception as e:
        return jsonify({
            "erro": str(e),
            "posto": None
        }), 500

@app.route('/api/bandeiras')
def bandeiras():
    """Obter lista de bandeiras disponíveis"""
    try:
        # Extrair bandeiras únicas
        bandeiras_unicas = sorted(list(set(p['bandeira'] for p in POSTOS_SIMULADOS)))
        
        # Adicionar opção "Todas" no início
        bandeiras_unicas.insert(0, "Todas")
        
        return jsonify({
            "bandeiras": bandeiras_unicas,
            "total": len(bandeiras_unicas)
        })
    except Exception as e:
        return jsonify({
            "erro": str(e),
            "bandeiras": ["Todas"]
        }), 500

@app.route('/api/estatisticas')
def estatisticas():
    """Obter estatísticas sobre os dados"""
    try:
        # Contar postos por estado
        postos_por_estado = {}
        for posto in POSTOS_SIMULADOS:
            estado = posto['estado']
            if estado not in postos_por_estado:
                postos_por_estado[estado] = 0
            postos_por_estado[estado] += 1
        
        # Contar postos por bandeira
        postos_por_bandeira = {}
        for posto in POSTOS_SIMULADOS:
            bandeira = posto['bandeira']
            if bandeira not in postos_por_bandeira:
                postos_por_bandeira[bandeira] = 0
            postos_por_bandeira[bandeira] += 1
        
        # Calcular preços médios
        soma_gasolina = sum(float(p.get('preco_gasolina', '0')) for p in POSTOS_SIMULADOS if p.get('preco_gasolina', 'N/A') != 'N/A')
        soma_alcool = sum(float(p.get('preco_alcool', '0')) for p in POSTOS_SIMULADOS if p.get('preco_alcool', 'N/A') != 'N/A')
        soma_diesel = sum(float(p.get('preco_diesel', '0')) for p in POSTOS_SIMULADOS if p.get('preco_diesel', 'N/A') != 'N/A')
        soma_gnv = sum(float(p.get('preco_gnv', '0')) for p in POSTOS_SIMULADOS if p.get('preco_gnv', 'N/A') != 'N/A')
        
        count_gasolina = sum(1 for p in POSTOS_SIMULADOS if p.get('preco_gasolina', 'N/A') != 'N/A')
        count_alcool = sum(1 for p in POSTOS_SIMULADOS if p.get('preco_alcool', 'N/A') != 'N/A')
        count_diesel = sum(1 for p in POSTOS_SIMULADOS if p.get('preco_diesel', 'N/A') != 'N/A')
        count_gnv = sum(1 for p in POSTOS_SIMULADOS if p.get('preco_gnv', 'N/A') != 'N/A')
        
        preco_medio_gasolina = round(soma_gasolina / count_gasolina, 2) if count_gasolina > 0 else 0
        preco_medio_alcool = round(soma_alcool / count_alcool, 2) if count_alcool > 0 else 0
        preco_medio_diesel = round(soma_diesel / count_diesel, 2) if count_diesel > 0 else 0
        preco_medio_gnv = round(soma_gnv / count_gnv, 2) if count_gnv > 0 else 0
        
        return jsonify({
            "total_postos": len(POSTOS_SIMULADOS),
            "postos_por_estado": postos_por_estado,
            "postos_por_bandeira": postos_por_bandeira,
            "precos_medios": {
                "gasolina": preco_medio_gasolina,
                "alcool": preco_medio_alcool,
                "diesel": preco_medio_diesel,
                "gnv": preco_medio_gnv
            },
            "cobertura": {
                "gasolina": count_gasolina,
                "alcool": count_alcool,
                "diesel": count_diesel,
                "gnv": count_gnv
            }
        })
    except Exception as e:
        return jsonify({
            "erro": str(e)
        }), 500

# Criar pasta utils se não existir
os.makedirs('src/utils', exist_ok=True)

# Criar arquivo de utilidades geográficas
with open('src/utils/geo_utils.py', 'w', encoding='utf-8') as f:
    f.write('''
import math

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
    
    # Diferenças
    dlon = lon2_rad - lon1_rad
    dlat = lat2_rad - lat1_rad
    
    # Fórmula de Haversine
    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distancia = R * c
    
    return distancia
''')

# Criar arquivo de dados simulados
with open('src/utils/dados_simulados.py', 'w', encoding='utf-8') as f:
    f.write('''
import random
import json
import os
from datetime import datetime, timedelta

# Lista de bandeiras comuns
BANDEIRAS = [
    "Petrobras", "Shell", "Ipiranga", "Raízen", "Ale", "Bandeira Branca",
    "Esso", "Texaco", "Ale Satélite", "Petronac", "Federação", "Larco"
]

# Lista de cidades e estados
CIDADES_ESTADOS = [
    {"cidade": "São Paulo", "estado": "SP", "lat": -23.5505, "lon": -46.6333},
    {"cidade": "Rio de Janeiro", "estado": "RJ", "lat": -22.9068, "lon": -43.1729},
    {"cidade": "Belo Horizonte", "estado": "MG", "lat": -19.9167, "lon": -43.9345},
    {"cidade": "Brasília", "estado": "DF", "lat": -15.7801, "lon": -47.9292},
    {"cidade": "Salvador", "estado": "BA", "lat": -12.9714, "lon": -38.5014},
    {"cidade": "Fortaleza", "estado": "CE", "lat": -3.7172, "lon": -38.5433},
    {"cidade": "Recife", "estado": "PE", "lat": -8.0476, "lon": -34.8770},
    {"cidade": "Porto Alegre", "estado": "RS", "lat": -30.0346, "lon": -51.2177},
    {"cidade": "Curitiba", "estado": "PR", "lat": -25.4290, "lon": -49.2671},
    {"cidade": "Manaus", "estado": "AM", "lat": -3.1190, "lon": -60.0217},
    {"cidade": "Belém", "estado": "PA", "lat": -1.4558, "lon": -48.4902},
    {"cidade": "Goiânia", "estado": "GO", "lat": -16.6799, "lon": -49.2550},
    {"cidade": "Florianópolis", "estado": "SC", "lat": -27.5954, "lon": -48.5480},
    {"cidade": "Vitória", "estado": "ES", "lat": -20.2976, "lon": -40.2958},
    {"cidade": "Campo Grande", "estado": "MS", "lat": -20.4697, "lon": -54.6201},
    {"cidade": "Cuiabá", "estado": "MT", "lat": -15.6014, "lon": -56.0979},
    {"cidade": "João Pessoa", "estado": "PB", "lat": -7.1195, "lon": -34.8450},
    {"cidade": "Teresina", "estado": "PI", "lat": -5.0920, "lon": -42.8038},
    {"cidade": "Natal", "estado": "RN", "lat": -5.7945, "lon": -35.2110},
    {"cidade": "Aracaju", "estado": "SE", "lat": -10.9472, "lon": -37.0731}
]

def gerar_postos_simulados(quantidade=500):
    """
    Gera dados simulados de postos de combustíveis
    """
    postos = []
    
    for i in range(1, quantidade + 1):
        # Selecionar cidade/estado aleatório
        cidade_estado = random.choice(CIDADES_ESTADOS)
        
        # Gerar coordenadas próximas ao centro da cidade
        lat_offset = random.uniform(-0.1, 0.1)
        lon_offset = random.uniform(-0.1, 0.1)
        
        latitude = cidade_estado["lat"] + lat_offset
        longitude = cidade_estado["lon"] + lon_offset
        
        # Gerar preços aleatórios realistas
        preco_gasolina = round(random.uniform(5.29, 6.19), 2)
        preco_alcool = round(random.uniform(3.79, 4.59), 2)
        preco_diesel = round(random.uniform(4.59, 5.39), 2)
        
        # Nem todos os postos têm GNV
        tem_gnv = random.random() < 0.3
        preco_gnv = round(random.uniform(3.19, 3.89), 2) if tem_gnv else "N/A"
        
        # Data de atualização (entre hoje e 7 dias atrás)
        dias_atras = random.randint(0, 7)
        data_atualizacao = (datetime.now() - timedelta(days=dias_atras)).strftime("%Y-%m-%d")
        
        # Gerar nome do posto
        bandeira = random.choice(BANDEIRAS)
        cidade = cidade_estado["cidade"]
        
        # Diferentes formatos de nome
        formato_nome = random.randint(1, 4)
        if formato_nome == 1:
            nome = f"Auto Posto {bandeira} {cidade} {i}"
        elif formato_nome == 2:
            nome = f"Posto {bandeira} {random.choice(['Express', 'Plus', 'Max', 'Super'])}"
        elif formato_nome == 3:
            nome = f"{bandeira} Auto Posto {random.choice(['Central', 'Avenida', 'Rodovia', 'Shopping'])}"
        else:
            nome = f"Posto {random.choice(['São Jorge', 'São Pedro', 'Santa Maria', 'Santo Antônio'])} {bandeira}"
        
        # Gerar endereço
        tipos_logradouro = ["Rua", "Avenida", "Rodovia", "Estrada"]
        nomes_logradouro = ["Principal", "Central", "das Flores", "dos Estados", "Brasil", "Santos Dumont", "JK"]
        
        tipo_logradouro = random.choice(tipos_logradouro)
        nome_logradouro = random.choice(nomes_logradouro)
        numero = random.randint(1, 9999)
        
        endereco = f"{tipo_logradouro} {nome_logradouro}, {numero}"
        
        # Gerar bairro
        bairros = ["Centro", "Jardim América", "Vila Nova", "Parque Industrial", "Bairro PC " + str(random.randint(1, 10))]
        bairro = random.choice(bairros)
        
        # Criar posto
        posto = {
            "id": str(i),
            "nome": nome,
            "bandeira": bandeira,
            "endereco": endereco,
            "bairro": bairro,
            "cidade": cidade_estado["cidade"],
            "estado": cidade_estado["estado"],
            "latitude": latitude,
            "longitude": longitude,
            "preco_gasolina": str(preco_gasolina),
            "preco_alcool": str(preco_alcool),
            "preco_diesel": str(preco_diesel),
            "preco_gnv": str(preco_gnv) if tem_gnv else "N/A",
            "ultima_atualizacao": data_atualizacao
        }
        
        postos.append(posto)
    
    return postos

def salvar_postos_simulados(postos, arquivo='postos_simulados.json'):
    """
    Salva os postos simulados em um arquivo JSON
    """
    os.makedirs('data', exist_ok=True)
    caminho_arquivo = os.path.join('data', arquivo)
    
    with open(caminho_arquivo, 'w', encoding='utf-8') as f:
        json.dump(postos, f, ensure_ascii=False, indent=2)
    
    return caminho_arquivo

if __name__ == "__main__":
    # Gerar e salvar postos simulados quando executado diretamente
    postos = gerar_postos_simulados(500)
    arquivo = salvar_postos_simulados(postos)
    print(f"Gerados {len(postos)} postos simulados e salvos em {arquivo}")
''')

# Inicializar dados simulados
carregar_dados_simulados()

if __name__ == '__main__':
    # Determinar porta
    port = int(os.environ.get('PORT', 5000))
    
    # Iniciar servidor
    app.run(host='0.0.0.0', port=port, debug=False)
