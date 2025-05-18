/**
 * App.js - Responsável pela lógica principal da aplicação
 */

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar componentes
    const mapManager = new MapManager('map');
    
    // Elementos da interface
    const elements = {
        sidebar: document.querySelector('.sidebar'),
        toggleSidebar: document.getElementById('toggle-sidebar'),
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        searchResults: document.getElementById('search-results'),
        locationBtn: document.getElementById('location-btn'),
        radiusSlider: document.getElementById('radius'),
        radiusValue: document.getElementById('radius-value'),
        fuelType: document.getElementById('fuel-type'),
        brand: document.getElementById('brand'),
        sortBy: document.getElementById('sort-by'),
        applyFilters: document.getElementById('apply-filters'),
        stationsList: document.getElementById('stations-list'),
        stationDetails: document.getElementById('station-details'),
        detailsContent: document.getElementById('details-content'),
        closeDetails: document.getElementById('close-details')
    };
    
    // Templates
    const templates = {
        stationItem: document.getElementById('station-item-template').innerHTML,
        stationDetails: document.getElementById('station-details-template').innerHTML
    };
    
    // Estado da aplicação
    const state = {
        currentLocation: null,
        currentStations: [],
        searchTimeout: null,
        searchMinLength: 3,
        searchDelay: 300,
        radius: 5,
        selectedFuelType: 'gasolina',
        selectedBrand: 'todas',
        sortBy: 'distancia'
    };
    
    // Inicializar interface
    initializeUI();
    
    // Carregar dados iniciais
    loadInitialData();
    
    /**
     * Inicializa a interface do usuário
     */
    function initializeUI() {
        // Toggle da barra lateral
        elements.toggleSidebar.addEventListener('click', () => {
            elements.sidebar.classList.toggle('collapsed');
            setTimeout(() => mapManager.resize(), 300);
        });
        
        // Slider de raio
        elements.radiusSlider.addEventListener('input', () => {
            state.radius = parseInt(elements.radiusSlider.value);
            elements.radiusValue.textContent = `${state.radius} km`;
        });
        
        // Botão de localização
        elements.locationBtn.addEventListener('click', async () => {
            try {
                showLoading('Obtendo sua localização...');
                
                // Obter localização atual
                const location = await mapManager.showCurrentLocation();
                state.currentLocation = location;
                
                // Buscar postos próximos
                await loadNearbyStations(location.latitude, location.longitude);
                
                hideLoading();
            } catch (error) {
                console.error('Erro ao obter localização:', error);
                hideLoading();
            }
        });
        
        // Campo de busca
        elements.searchInput.addEventListener('input', () => {
            const query = elements.searchInput.value.trim();
            
            // Limpar timeout anterior
            if (state.searchTimeout) {
                clearTimeout(state.searchTimeout);
            }
            
            // Verificar se a busca é válida
            if (query.length < state.searchMinLength) {
                elements.searchResults.innerHTML = '';
                elements.searchResults.classList.remove('active');
                return;
            }
            
            // Definir novo timeout para busca
            state.searchTimeout = setTimeout(() => {
                performSearch(query);
            }, state.searchDelay);
        });
        
        // Botão de busca
        elements.searchBtn.addEventListener('click', () => {
            const query = elements.searchInput.value.trim();
            
            if (query.length >= state.searchMinLength) {
                performSearch(query);
            }
        });
        
        // Aplicar filtros
        elements.applyFilters.addEventListener('click', () => {
            // Atualizar estado
            state.selectedFuelType = elements.fuelType.value;
            state.selectedBrand = elements.brand.value;
            state.sortBy = elements.sortBy.value;
            state.radius = parseInt(elements.radiusSlider.value);
            
            // Aplicar filtros
            applyFilters();
        });
        
        // Fechar detalhes
        elements.closeDetails.addEventListener('click', () => {
            elements.stationDetails.classList.remove('active');
        });
        
        // Callback para seleção de posto no mapa
        mapManager.setOnStationSelect(station => {
            showStationDetails(station);
            highlightStationInList(station.id);
        });
        
        // Callback para movimento do mapa
        mapManager.setOnMapMoveEnd((lat, lon, zoom) => {
            // Só carregar novos postos se o zoom for suficiente
            if (zoom >= 12) {
                loadNearbyStations(lat, lon, false);
            }
        });
    }
    
    /**
     * Carrega dados iniciais
     */
    async function loadInitialData() {
        try {
            showLoading('Carregando dados iniciais...');
            
            // Verificar status da API
            const status = await api.getStatus().catch(() => null);
            
            if (!status) {
                console.warn('API indisponível, usando dados simulados');
                showSimulatedDataNotice();
            }
            
            // Carregar bandeiras
            await loadBrands();
            
            // Tentar obter localização do usuário
            try {
                const location = await mapManager.showCurrentLocation();
                state.currentLocation = location;
                
                // Buscar postos próximos
                await loadNearbyStations(location.latitude, location.longitude);
            } catch (error) {
                console.warn('Não foi possível obter localização inicial:', error);
                
                // Carregar postos em localização padrão (São Paulo)
                await loadNearbyStations(-23.5505, -46.6333);
            }
            
            hideLoading();
        } catch (error) {
            console.error('Erro ao carregar dados iniciais:', error);
            hideLoading();
            
            // Mostrar dados simulados em caso de erro
            showSimulatedDataNotice();
            loadSimulatedData();
        }
    }
    
    /**
     * Carrega lista de bandeiras
     */
    async function loadBrands() {
        try {
            // Obter bandeiras da API
            const result = await api.getBandeiras().catch(() => null);
            
            if (!result) {
                // Usar bandeiras padrão
                const defaultBrands = ['Petrobras', 'Shell', 'Ipiranga', 'Raízen', 'Ale', 'Bandeira Branca'];
                populateBrandsDropdown(defaultBrands);
                return;
            }
            
            // Preencher dropdown
            populateBrandsDropdown(result.bandeiras);
        } catch (error) {
            console.error('Erro ao carregar bandeiras:', error);
            
            // Usar bandeiras padrão
            const defaultBrands = ['Petrobras', 'Shell', 'Ipiranga', 'Raízen', 'Ale', 'Bandeira Branca'];
            populateBrandsDropdown(defaultBrands);
        }
    }
    
    /**
     * Preenche o dropdown de bandeiras
     * @param {Array} brands - Lista de bandeiras
     */
    function populateBrandsDropdown(brands) {
        // Limpar opções existentes (exceto a primeira)
        while (elements.brand.options.length > 1) {
            elements.brand.remove(1);
        }
        
        // Adicionar bandeiras
        brands.forEach(brand => {
            const option = document.createElement('option');
            option.value = brand;
            option.textContent = brand;
            elements.brand.appendChild(option);
        });
    }
    
    /**
     * Carrega postos próximos a uma localização
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {boolean} fitBounds - Se deve ajustar o zoom para mostrar todos os marcadores
     */
    async function loadNearbyStations(lat, lon, fitBounds = true) {
        try {
            showLoading('Buscando postos próximos...');
            
            // Buscar postos da API
            const result = await api.getPostosProximos(lat, lon, state.radius).catch(() => null);
            
            if (!result || !result.postos || result.postos.length === 0) {
                console.warn('Nenhum posto encontrado na API, usando dados simulados');
                loadSimulatedData(lat, lon);
                return;
            }
            
            // Atualizar estado
            state.currentStations = result.postos;
            
            // Adicionar ao mapa
            mapManager.addStations(result.postos, fitBounds);
            
            // Atualizar lista
            updateStationsList(result.postos);
            
            hideLoading();
        } catch (error) {
            console.error('Erro ao carregar postos próximos:', error);
            hideLoading();
            
            // Carregar dados simulados em caso de erro
            loadSimulatedData(lat, lon);
        }
    }
    
    /**
     * Carrega dados simulados
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     */
    function loadSimulatedData(lat = -23.5505, lon = -46.6333) {
        // Gerar postos simulados
        const postos = dadosSimulados.gerarPostosSimulados(lat, lon, 30);
        
        // Atualizar estado
        state.currentStations = postos;
        
        // Adicionar ao mapa
        mapManager.addStations(postos, true);
        
        // Atualizar lista
        updateStationsList(postos);
        
        // Mostrar aviso de dados simulados
        showSimulatedDataNotice();
    }
    
    /**
     * Mostra aviso de dados simulados
     */
    function showSimulatedDataNotice() {
        const dataNotice = document.querySelector('.data-notice');
        
        if (dataNotice) {
            dataNotice.innerHTML = `
                <i class="fas fa-info-circle"></i>
                <span>Exibindo dados simulados para demonstração. Em um ambiente de produção, seriam exibidos dados reais da API.</span>
            `;
            dataNotice.style.backgroundColor = '#fff9e6';
            dataNotice.style.borderLeftColor = '#ffcc00';
        }
    }
    
    /**
     * Atualiza a lista de postos
     * @param {Array} stations - Lista de postos
     */
    function updateStationsList(stations) {
        // Limpar lista
        elements.stationsList.innerHTML = '';
        
        // Verificar se há postos
        if (!stations || stations.length === 0) {
            elements.stationsList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Nenhum posto encontrado nesta região.</span>
                </div>
            `;
            return;
        }
        
        // Adicionar cada posto à lista
        stations.forEach(station => {
            // Determinar qual preço mostrar com base no combustível selecionado
            let preco = 'N/A';
            let combustivel = state.selectedFuelType;
            
            switch (state.selectedFuelType) {
                case 'gasolina':
                    preco = station.preco_gasolina || 'N/A';
                    combustivel = 'Gasolina';
                    break;
                case 'alcool':
                    preco = station.preco_alcool || 'N/A';
                    combustivel = 'Álcool';
                    break;
                case 'diesel':
                    preco = station.preco_diesel || 'N/A';
                    combustivel = 'Diesel';
                    break;
                case 'gnv':
                    preco = station.preco_gnv || 'N/A';
                    combustivel = 'GNV';
                    break;
            }
            
            // Formatar preço
            if (preco !== 'N/A') {
                preco = typeof preco === 'string' ? preco : preco.toFixed(2);
            }
            
            // Criar item da lista
            const itemHtml = templates.stationItem
                .replace('{id}', station.id)
                .replace('{nome}', station.nome)
                .replace('{endereco}', station.endereco)
                .replace('{bairro}', station.bairro)
                .replace('{cidade}', station.cidade)
                .replace('{estado}', station.estado)
                .replace('{bandeira}', station.bandeira)
                .replace('{combustivel}', combustivel)
                .replace('{preco}', preco)
                .replace('{distancia}', station.distancia || '?');
            
            // Criar elemento
            const itemElement = document.createElement('div');
            itemElement.innerHTML = itemHtml;
            const item = itemElement.firstElementChild;
            
            // Adicionar evento de clique
            item.addEventListener('click', () => {
                mapManager.selectStation(station);
                showStationDetails(station);
            });
            
            // Adicionar à lista
            elements.stationsList.appendChild(item);
        });
    }
    
    /**
     * Destaca um posto na lista
     * @param {string} stationId - ID do posto
     */
    function highlightStationInList(stationId) {
        // Remover destaque anterior
        const items = elements.stationsList.querySelectorAll('.station-item');
        items.forEach(item => item.classList.remove('selected'));
        
        // Adicionar destaque ao item selecionado
        const selectedItem = elements.stationsList.querySelector(`.station-item[data-id="${stationId}"]`);
        
        if (selectedItem) {
            selectedItem.classList.add('selected');
            
            // Rolar para o item
            selectedItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
    
    /**
     * Mostra os detalhes de um posto
     * @param {Object} station - Posto
     */
    function showStationDetails(station) {
        // Formatar preços
        const precoGasolina = station.preco_gasolina ? `R$ ${station.preco_gasolina}` : 'N/A';
        const precoAlcool = station.preco_alcool ? `R$ ${station.preco_alcool}` : 'N/A';
        const precoDiesel = station.preco_diesel ? `R$ ${station.preco_diesel}` : 'N/A';
        const precoGNV = station.preco_gnv ? `R$ ${station.preco_gnv}` : 'N/A';
        
        // Preencher template
        const detailsHtml = templates.stationDetails
            .replace('{id}', station.id)
            .replace('{nome}', station.nome)
            .replace('{bandeira}', station.bandeira)
            .replace('{endereco}', station.endereco)
            .replace('{bairro}', station.bairro)
            .replace('{cidade}', station.cidade)
            .replace('{estado}', station.estado)
            .replace('{preco_gasolina}', precoGasolina)
            .replace('{preco_alcool}', precoAlcool)
            .replace('{preco_diesel}', precoDiesel)
            .replace('{preco_gnv}', precoGNV)
            .replace('{data_coleta}', station.data_coleta || 'Hoje')
            .replace('{latitude}', station.latitude)
            .replace('{longitude}', station.longitude);
        
        // Atualizar conteúdo
        elements.detailsContent.innerHTML = detailsHtml;
        
        // Mostrar painel
        elements.stationDetails.classList.add('active');
        
        // Adicionar evento ao botão de favorito
        const btnFavorite = elements.detailsContent.querySelector('.btn-favorite');
        if (btnFavorite) {
            btnFavorite.addEventListener('click', () => {
                toggleFavorite(station.id);
            });
            
            // Verificar se já é favorito
            if (isFavorite(station.id)) {
                btnFavorite.innerHTML = '<i class="fas fa-heart"></i> Favorito';
                btnFavorite.classList.add('active');
            }
        }
    }
    
    /**
     * Realiza busca por texto
     * @param {string} query - Texto de busca
     */
    async function performSearch(query) {
        try {
            // Mostrar resultados de busca
            elements.searchResults.innerHTML = '<div class="search-loading">Buscando...</div>';
            elements.searchResults.classList.add('active');
            
            // Buscar na API
            const result = await api.buscarPostos(query).catch(() => null);
            
            // Limpar resultados
            elements.searchResults.innerHTML = '';
            
            if (!result || !result.postos || result.postos.length === 0) {
                elements.searchResults.innerHTML = '<div class="search-no-results">Nenhum resultado encontrado</div>';
                return;
            }
            
            // Mostrar resultados
            result.postos.forEach(station => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div class="search-result-name">${station.nome}</div>
                    <div class="search-result-address">${station.endereco}, ${station.cidade} - ${station.estado}</div>
                `;
                
                // Adicionar evento de clique
                item.addEventListener('click', () => {
                    // Fechar resultados
                    elements.searchResults.classList.remove('active');
                    
                    // Centralizar mapa
                    mapManager.centerMap(station.latitude, station.longitude);
                    
                    // Carregar postos próximos
                    loadNearbyStations(station.latitude, station.longitude);
                    
                    // Selecionar posto
                    setTimeout(() => {
                        mapManager.selectStation(station);
                    }, 500);
                });
                
                elements.searchResults.appendChild(item);
            });
        } catch (error) {
            console.error('Erro ao realizar busca:', error);
            elements.searchResults.innerHTML = '<div class="search-error">Erro ao realizar busca</div>';
        }
    }
    
    /**
     * Aplica filtros aos postos
     */
    function applyFilters() {
        // Verificar se há postos
        if (!state.currentStations || state.currentStations.length === 0) {
            return;
        }
        
        // Clonar lista de postos
        let postosFiltrados = [...state.currentStations];
        
        // Filtrar por bandeira
        if (state.selectedBrand !== 'todas') {
            postosFiltrados = postosFiltrados.filter(posto => 
                posto.bandeira === state.selectedBrand
            );
        }
        
        // Ordenar por preço ou distância
        if (state.sortBy === 'preco') {
            // Determinar qual campo de preço usar
            const campoPreco = `preco_${state.selectedFuelType}`;
            
            // Ordenar por preço (apenas postos com preço válido)
            const postosComPreco = postosFiltrados.filter(posto => 
                posto[campoPreco] && posto[campoPreco] !== 'N/A'
            );
            
            const postosSemPreco = postosFiltrados.filter(posto => 
                !posto[campoPreco] || posto[campoPreco] === 'N/A'
            );
            
            postosComPreco.sort((a, b) => {
                const precoA = parseFloat(a[campoPreco]);
                const precoB = parseFloat(b[campoPreco]);
                return precoA - precoB;
            });
            
            // Concatenar postos com e sem preço
            postosFiltrados = [...postosComPreco, ...postosSemPreco];
        } else {
            // Ordenar por distância
            postosFiltrados.sort((a, b) => {
                const distA = parseFloat(a.distancia || 999);
                const distB = parseFloat(b.distancia || 999);
                return distA - distB;
            });
        }
        
        // Atualizar mapa e lista
        mapManager.addStations(postosFiltrados, false);
        updateStationsList(postosFiltrados);
    }
    
    /**
     * Verifica se um posto é favorito
     * @param {string} stationId - ID do posto
     * @returns {boolean} - Se o posto é favorito
     */
    function isFavorite(stationId) {
        const favorites = getFavorites();
        return favorites.includes(stationId);
    }
    
    /**
     * Alterna o estado de favorito de um posto
     * @param {string} stationId - ID do posto
     */
    function toggleFavorite(stationId) {
        const favorites = getFavorites();
        const index = favorites.indexOf(stationId);
        
        if (index === -1) {
            // Adicionar aos favoritos
            favorites.push(stationId);
            
            // Atualizar botão
            const btnFavorite = elements.detailsContent.querySelector('.btn-favorite');
            if (btnFavorite) {
                btnFavorite.innerHTML = '<i class="fas fa-heart"></i> Favorito';
                btnFavorite.classList.add('active');
            }
        } else {
            // Remover dos favoritos
            favorites.splice(index, 1);
            
            // Atualizar botão
            const btnFavorite = elements.detailsContent.querySelector('.btn-favorite');
            if (btnFavorite) {
                btnFavorite.innerHTML = '<i class="far fa-heart"></i> Favoritar';
                btnFavorite.classList.remove('active');
            }
        }
        
        // Salvar favoritos
        localStorage.setItem('favorites', JSON.stringify(favorites));
    }
    
    /**
     * Obtém a lista de postos favoritos
     * @returns {Array} - Lista de IDs dos postos favoritos
     */
    function getFavorites() {
        const favoritesJson = localStorage.getItem('favorites');
        return favoritesJson ? JSON.parse(favoritesJson) : [];
    }
    
    /**
     * Mostra indicador de carregamento
     * @param {string} message - Mensagem de carregamento
     */
    function showLoading(message = 'Carregando...') {
        elements.stationsList.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-spinner fa-spin"></i>
                <span>${message}</span>
            </div>
        `;
    }
    
    /**
     * Esconde indicador de carregamento
     */
    function hideLoading() {
        // Será substituído pela lista de postos
    }
});
