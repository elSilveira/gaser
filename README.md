# Mapa de Postos de Combustíveis do Brasil

Aplicativo web que mapeia todos os postos de combustíveis do Brasil e mostra os preços dos combustíveis em tempo real ao selecionar cada posto.

![Screenshot do aplicativo](screenshots/app_screenshot.png)

## Funcionalidades

- **Mapa interativo** com todos os postos de combustíveis do Brasil
- **Busca por endereço ou cidade** para encontrar postos em qualquer região
- **Filtros por tipo de combustível** (gasolina, álcool, diesel, GNV)
- **Filtros por bandeira** (Petrobras, Shell, Ipiranga, etc.)
- **Ordenação** por distância ou menor preço
- **Detalhes completos** ao clicar em um posto
- **Geolocalização** para encontrar postos próximos à sua localização atual
- **Interface responsiva** para desktop e dispositivos móveis

## Tecnologias Utilizadas

- **Backend**: Python, Flask, SQLite
- **Frontend**: HTML5, CSS3, JavaScript
- **Mapa**: Leaflet.js, OpenStreetMap
- **Dados**: Web scraping, API da ANP, geocodificação

## Estrutura do Projeto

```
mapa_postos_combustiveis/
├── backend/                # Servidor Flask
│   ├── app.py              # Aplicação principal
│   ├── src/                # Código-fonte
│   │   ├── static/         # Arquivos estáticos
│   │   │   ├── css/        # Estilos
│   │   │   ├── js/         # Scripts
│   │   │   └── img/        # Imagens
│   │   └── templates/      # Templates HTML
│   └── requirements.txt    # Dependências Python
├── data/                   # Dados dos postos
│   ├── postos_latest.json  # Dados em formato JSON
│   ├── postos_latest.db    # Banco de dados SQLite
│   └── indices/            # Índices espaciais
├── scripts/                # Scripts de processamento
│   ├── scraper_multiplas_fontes.py  # Web scraping
│   ├── geocoder_em_lote.py          # Geocodificação
│   └── otimizador_dados.py          # Otimização de dados
└── README.md               # Este arquivo
```

## Como Rodar Localmente

### Pré-requisitos

- Python 3.8 ou superior
- pip (gerenciador de pacotes Python)
- Git (opcional)

### Passos para Instalação

1. Clone o repositório (ou baixe o ZIP):
   ```bash
   git clone https://github.com/seu-usuario/mapa-postos-combustiveis.git
   cd mapa-postos-combustiveis
   ```

2. Crie e ative um ambiente virtual:
   ```bash
   # No Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   
   # No Windows
   python -m venv venv
   venv\Scripts\activate
   ```

3. Instale as dependências:
   ```bash
   pip install -r backend/requirements.txt
   ```

4. Execute o servidor Flask:
   ```bash
   cd backend
   python app.py
   ```

5. Acesse o aplicativo no navegador:
   ```
   http://localhost:5000
   ```

## Como Implantar em um Servidor

### Opção 1: Implantação com Gunicorn e Nginx (Linux)

1. Instale o Gunicorn e outras dependências:
   ```bash
   pip install gunicorn
   ```

2. Crie um arquivo de serviço systemd:
   ```bash
   sudo nano /etc/systemd/system/mapa-postos.service
   ```

3. Adicione o seguinte conteúdo (ajuste os caminhos conforme necessário):
   ```ini
   [Unit]
   Description=Mapa de Postos de Combustíveis
   After=network.target

   [Service]
   User=www-data
   WorkingDirectory=/caminho/para/mapa-postos-combustiveis/backend
   ExecStart=/caminho/para/mapa-postos-combustiveis/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

4. Habilite e inicie o serviço:
   ```bash
   sudo systemctl enable mapa-postos
   sudo systemctl start mapa-postos
   ```

5. Configure o Nginx como proxy reverso:
   ```bash
   sudo nano /etc/nginx/sites-available/mapa-postos
   ```

6. Adicione a configuração do Nginx:
   ```nginx
   server {
       listen 80;
       server_name seu-dominio.com;

       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

7. Ative o site e reinicie o Nginx:
   ```bash
   sudo ln -s /etc/nginx/sites-available/mapa-postos /etc/nginx/sites-enabled
   sudo systemctl restart nginx
   ```

### Opção 2: Implantação com Docker

1. Crie um Dockerfile na raiz do projeto:
   ```bash
   nano Dockerfile
   ```

2. Adicione o seguinte conteúdo:
   ```dockerfile
   FROM python:3.9-slim

   WORKDIR /app

   COPY backend/requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   RUN pip install gunicorn

   COPY backend/ .
   COPY data/ ./data/

   EXPOSE 5000

   CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
   ```

3. Construa a imagem Docker:
   ```bash
   docker build -t mapa-postos-combustiveis .
   ```

4. Execute o contêiner:
   ```bash
   docker run -d -p 80:5000 --name mapa-postos mapa-postos-combustiveis
   ```

### Opção 3: Implantação em Plataformas de Nuvem

#### Heroku

1. Crie um arquivo `Procfile` na raiz do projeto:
   ```
   web: cd backend && gunicorn app:app
   ```

2. Crie um arquivo `runtime.txt`:
   ```
   python-3.9.7
   ```

3. Implante no Heroku:
   ```bash
   heroku create mapa-postos-combustiveis
   git push heroku main
   ```

#### Google Cloud Run

1. Construa a imagem Docker:
   ```bash
   gcloud builds submit --tag gcr.io/seu-projeto/mapa-postos-combustiveis
   ```

2. Implante no Cloud Run:
   ```bash
   gcloud run deploy mapa-postos --image gcr.io/seu-projeto/mapa-postos-combustiveis --platform managed
   ```

## Atualização de Dados

Para atualizar os dados dos postos de combustíveis:

1. Execute o script de scraping:
   ```bash
   cd scripts
   python scraper_multiplas_fontes.py
   ```

2. Execute o script de geocodificação (se necessário):
   ```bash
   python geocoder_em_lote.py
   ```

3. Otimize os dados:
   ```bash
   python otimizador_dados.py
   ```

4. Reinicie o servidor para carregar os novos dados.

## Personalização

### Alterando a Aparência

Os estilos do aplicativo estão localizados em `backend/static/css/`. Você pode modificar:

- `styles.css` - Estilos gerais da interface
- `markers.css` - Estilos dos marcadores e popups no mapa

### Adicionando Novas Fontes de Dados

Para adicionar novas fontes de dados:

1. Modifique o script `scraper_multiplas_fontes.py` para incluir a nova fonte
2. Ajuste o formato dos dados para corresponder ao esquema existente
3. Execute o pipeline de atualização de dados

## Solução de Problemas

### O mapa não carrega

- Verifique se o servidor Flask está em execução
- Verifique se há erros no console do navegador
- Certifique-se de que as dependências JavaScript estão sendo carregadas corretamente

### Postos não aparecem no mapa

- Verifique se os arquivos de dados existem em `data/`
- Verifique se o cache está sendo inicializado corretamente
- Tente acessar a rota `/api/status` para verificar o status da API

### Erros de CORS

- Certifique-se de que o CORS está configurado corretamente no backend
- Verifique se está acessando o aplicativo pela URL correta

## Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues ou enviar pull requests.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.

## Contato

Para dúvidas ou sugestões, entre em contato através do email: seu-email@exemplo.com
