/**
 * Map.js - Responsável pela gestão do mapa e marcadores
 */

const mapManager = {
    // Referência ao mapa Leaflet
    map: null,
    
    // Grupo de marcadores para postos
    markersGroup: null,
    
    // Marcador da localização atual
    currentLocationMarker: null,
    
    // Inicializar o mapa
    init: function(elementId = 'map', center = [-23.5505, -46.6333], zoom = 13) {
        console.log('Inicializando mapa...');
        
        // Criar o mapa
        this.map = L.map(elementId).setView(center, zoom);
        
        // Adicionar camada de tiles do OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Inicializar grupo de marcadores com clustering
        this.markersGroup = L.markerClusterGroup();
        this.map.addLayer(this.markersGroup);
        
        // Adicionar controles de zoom
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        // Registrar eventos do mapa
        this.registerEvents();
        
        console.log('Mapa inicializado com sucesso');
        
        // Tentar obter localização atual
        this.getCurrentLocation();
        
        return this.map;
    },
    
    // Registrar eventos do mapa
    registerEvents: function() {
        // Evento de fim de movimento (pan/zoom)
        this.map.on('moveend', () => {
            // Atualizar postos quando o mapa for movido significativamente
            // Implementação limitada para evitar muitas requisições
            const center = this.map.getCenter();
            console.log(`Mapa movido para ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
        });
        
        // Evento de clique no mapa
        this.map.on('click', (e) => {
            console.log(`Clique no mapa em ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`);
        });
    },
    
    // Obter localização atual do usuário
    getCurrentLocation: function() {
        console.log('Tentando obter localização atual...');
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                // Sucesso
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    console.log(`Localização obtida: ${lat}, ${lon}`);
                    
                    // Centralizar mapa na localização atual
                    this.map.setView([lat, lon], 15);
                    
                    // Adicionar marcador de localização atual
                    this.setCurrentLocation(lat, lon);
                    
                    // Buscar postos próximos à localização atual
                    this.loadNearbyStations(lat, lon);
                },
                // Erro
                (error) => {
                    console.error('Erro ao obter localização:', error);
                    
                    // Usar localização padrão (São Paulo)
                    this.loadNearbyStations(-23.5505, -46.6333);
                },
                // Opções
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        } else {
            console.warn('Geolocalização não suportada pelo navegador');
            
            // Usar localização padrão (São Paulo)
            this.loadNearbyStations(-23.5505, -46.6333);
        }
    },
    
    // Definir localização atual no mapa
    setCurrentLocation: function(lat, lon) {
        // Remover marcador anterior se existir
        if (this.currentLocationMarker) {
            this.map.removeLayer(this.currentLocationMarker);
        }
        
        // Criar ícone personalizado para localização atual
        const locationIcon = L.icon({
            iconUrl: '/img/marker-location.png',
            shadowUrl: '/img/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        
        // Adicionar marcador de localização atual
        this.currentLocationMarker = L.marker([lat, lon], {
            icon: locationIcon,
            zIndexOffset: 1000 // Sempre acima dos outros marcadores
        }).addTo(this.map);
        
        // Adicionar popup ao marcador
        this.currentLocationMarker.bindPopup('<strong>Sua localização atual</strong>').openPopup();
    },
    
    // Carregar postos próximos a uma localização
    loadNearbyStations: function(lat, lon, radius = 5, fuel = 'gasolina', brand = 'todas', orderBy = 'distancia') {
        console.log(`Carregando postos próximos a ${lat}, ${lon}...`);
        
        // Atualizar interface para indicar carregamento
        const stationsList = document.getElementById('stations-list');
        if (stationsList) {
            stationsList.innerHTML = '<div class="loading-spinner"></div><p>Carregando postos...</p>';
        }
        
        // Buscar postos via API
        api.getStationsNearby(lat, lon, radius, fuel, brand, orderBy)
            .then(stations => {
                console.log(`${stations.length} postos encontrados`);
                
                // Adicionar postos ao mapa
                this.addStations(stations);
                
                // Atualizar lista de postos
                this.updateStationsList(stations);
            })
            .catch(error => {
                console.error('Erro ao carregar postos:', error);
                
                // Tentar usar dados simulados em caso de erro
                console.log('Tentando usar dados simulados...');
                const simulatedStations = dadosSimulados.gerarPostosSimulados(lat, lon, 30);
                
                // Adicionar postos simulados ao mapa
                this.addStations(simulatedStations, true);
                
                // Atualizar lista de postos
                this.updateStationsList(simulatedStations, true);
            });
    },
    
    // Adicionar postos ao mapa
    addStations: function(stations, isSimulated = false) {
        console.log(`Adicionando ${stations.length} postos ao mapa (${isSimulated ? 'simulados' : 'reais'})`);
        
        // Limpar marcadores existentes
        this.markersGroup.clearLayers();
        
        // Criar ícone personalizado para postos
        const stationIcon = L.icon({
            iconUrl: '/img/marker-gas.png',
            shadowUrl: '/img/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        
        // Adicionar marcadores para cada posto
        stations.forEach(station => {
            // Verificar se o posto tem coordenadas válidas
            if (!station.latitude || !station.longitude) {
                console.warn(`Posto ${station.id} sem coordenadas válidas`);
                return;
            }
            
            // Criar marcador
            const marker = L.marker([station.latitude, station.longitude], {
                icon: stationIcon,
                title: station.nome
            });
            
            // Criar conteúdo do popup
            const popupContent = `
                <div class="station-popup">
                    <h3>${station.nome}</h3>
                    <p>${station.endereco}, ${station.bairro}</p>
                    <p>${station.cidade} - ${station.estado}</p>
                    <p><strong>Bandeira:</strong> ${station.bandeira}</p>
                    <div class="prices">
                        <p><strong>Gasolina:</strong> R$ ${station.preco_gasolina}</p>
                        <p><strong>Álcool:</strong> R$ ${station.preco_alcool}</p>
                        <p><strong>Diesel:</strong> R$ ${station.preco_diesel}</p>
                        ${station.preco_gnv !== 'N/A' ? `<p><strong>GNV:</strong> R$ ${station.preco_gnv}</p>` : ''}
                    </div>
                    <p class="distance">${station.distancia} km</p>
                    ${isSimulated ? '<p class="simulated-data">Dados simulados</p>' : ''}
                </div>
            `;
            
            // Adicionar popup ao marcador
            marker.bindPopup(popupContent);
            
            // Adicionar marcador ao grupo
            this.markersGroup.addLayer(marker);
        });
        
        // Ajustar zoom para mostrar todos os marcadores se houver mais de um
        if (stations.length > 1) {
            const group = L.featureGroup(this.markersGroup.getLayers());
            this.map.fitBounds(group.getBounds().pad(0.1));
        }
    },
    
    // Atualizar lista de postos na interface
    updateStationsList: function(stations, isSimulated = false) {
        console.log(`Atualizando lista com ${stations.length} postos (${isSimulated ? 'simulados' : 'reais'})`);
        
        const stationsList = document.getElementById('stations-list');
        if (!stationsList) {
            console.warn('Elemento stations-list não encontrado');
            return;
        }
        
        // Limpar lista
        stationsList.innerHTML = '';
        
        // Adicionar aviso se dados forem simulados
        if (isSimulated) {
            const simulatedWarning = document.createElement('div');
            simulatedWarning.className = 'simulated-warning';
            simulatedWarning.innerHTML = '<i class="fas fa-info-circle"></i> Exibindo dados simulados.';
            stationsList.appendChild(simulatedWarning);
        }
        
        // Adicionar cada posto à lista
        stations.forEach(station => {
            const stationElement = document.createElement('div');
            stationElement.className = 'station-item';
            stationElement.innerHTML = `
                <h3>${station.nome}</h3>
                <p>${station.endereco}, ${station.bairro}</p>
                <p>${station.cidade} - ${station.estado}</p>
                <p class="brand">${station.bandeira}</p>
                <p class="price">Gasolina: R$ ${station.preco_gasolina}</p>
                <p class="distance">${station.distancia} km</p>
            `;
            
            // Adicionar evento de clique para centralizar no mapa
            stationElement.addEventListener('click', () => {
                // Centralizar mapa no posto
                this.map.setView([station.latitude, station.longitude], 17);
                
                // Buscar marcador correspondente e abrir popup
                this.markersGroup.getLayers().forEach(layer => {
                    const latlng = layer.getLatLng();
                    if (latlng.lat === parseFloat(station.latitude) && latlng.lng === parseFloat(station.longitude)) {
                        layer.openPopup();
                    }
                });
            });
            
            stationsList.appendChild(stationElement);
        });
        
        // Se não houver postos, mostrar mensagem
        if (stations.length === 0) {
            stationsList.innerHTML = '<p>Nenhum posto encontrado nesta região.</p>';
        }
    },
    
    // Buscar postos por texto (endereço, cidade, etc)
    searchStations: function(query, fuel = 'gasolina', brand = 'todas', orderBy = 'distancia') {
        console.log(`Buscando postos com query "${query}"...`);
        
        // Atualizar interface para indicar carregamento
        const stationsList = document.getElementById('stations-list');
        if (stationsList) {
            stationsList.innerHTML = '<div class="loading-spinner"></div><p>Buscando postos...</p>';
        }
        
        // Buscar postos via API
        api.searchStations(query, fuel, brand, orderBy)
            .then(stations => {
                console.log(`${stations.length} postos encontrados para "${query}"`);
                
                // Adicionar postos ao mapa
                this.addStations(stations);
                
                // Atualizar lista de postos
                this.updateStationsList(stations);
            })
            .catch(error => {
                console.error('Erro ao buscar postos:', error);
                
                // Tentar usar dados simulados em caso de erro
                console.log('Tentando usar dados simulados...');
                const simulatedStations = dadosSimulados.gerarPostosSimulados(-23.5505, -46.6333, 30);
                
                // Adicionar postos simulados ao mapa
                this.addStations(simulatedStations, true);
                
                // Atualizar lista de postos
                this.updateStationsList(simulatedStations, true);
            });
    }
};
