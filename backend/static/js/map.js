/**
 * Map.js - Responsável pela gestão do mapa e marcadores
 */

class MapManager {
    constructor(mapElementId) {
        // Elemento do mapa
        this.mapElement = document.getElementById(mapElementId);
        
        // Instância do mapa Leaflet
        this.map = null;
        
        // Grupo de marcadores para clustering
        this.markers = null;
        
        // Marcador da localização atual
        this.currentLocationMarker = null;
        
        // Ícones personalizados
        this.icons = {
            default: this.createIcon('marker-gas.png'),
            selected: this.createIcon('marker-gas-selected.png'),
            current: this.createIcon('marker-location.png')
        };
        
        // Posto selecionado atualmente
        this.selectedStation = null;
        
        // Callbacks
        this.onStationSelect = null;
        this.onMapMoveEnd = null;
        
        // Inicializar mapa
        this.initMap();
    }
    
    /**
     * Cria um ícone personalizado para marcadores
     * @param {string} iconFile - Nome do arquivo de ícone
     * @returns {L.Icon} - Ícone Leaflet
     */
    createIcon(iconFile) {
        return L.icon({
            iconUrl: `img/${iconFile}`,
            shadowUrl: 'img/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
    }
    
    /**
     * Inicializa o mapa Leaflet
     */
    initMap() {
        // Criar mapa
        this.map = L.map(this.mapElement, {
            center: [-15.7801, -47.9292], // Centro do Brasil (Brasília)
            zoom: 5,
            minZoom: 4,
            maxZoom: 18,
            zoomControl: false
        });
        
        // Adicionar controles de zoom em posição personalizada
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);
        
        // Adicionar camada de mapa base (OpenStreetMap)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Inicializar grupo de marcadores com clustering
        this.markers = L.markerClusterGroup({
            disableClusteringAtZoom: 14,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 50
        });
        
        this.map.addLayer(this.markers);
        
        // Adicionar eventos
        this.map.on('moveend', () => {
            if (this.onMapMoveEnd) {
                const center = this.map.getCenter();
                const zoom = this.map.getZoom();
                this.onMapMoveEnd(center.lat, center.lng, zoom);
            }
        });
    }
    
    /**
     * Define o callback para seleção de posto
     * @param {Function} callback - Função a ser chamada quando um posto for selecionado
     */
    setOnStationSelect(callback) {
        this.onStationSelect = callback;
    }
    
    /**
     * Define o callback para fim de movimento do mapa
     * @param {Function} callback - Função a ser chamada quando o mapa parar de se mover
     */
    setOnMapMoveEnd(callback) {
        this.onMapMoveEnd = callback;
    }
    
    /**
     * Adiciona marcadores de postos ao mapa
     * @param {Array} stations - Lista de postos
     * @param {boolean} fitBounds - Se deve ajustar o zoom para mostrar todos os marcadores
     */
    addStations(stations, fitBounds = true) {
        // Limpar marcadores existentes
        this.markers.clearLayers();
        
        // Verificar se há postos
        if (!stations || stations.length === 0) {
            console.warn('Nenhum posto para adicionar ao mapa');
            return;
        }
        
        // Adicionar marcadores para cada posto
        stations.forEach(station => {
            // Verificar se tem coordenadas válidas
            if (!station.latitude || !station.longitude) {
                return;
            }
            
            // Criar marcador
            const marker = L.marker([station.latitude, station.longitude], {
                icon: this.icons.default,
                title: station.nome,
                alt: station.nome,
                stationId: station.id
            });
            
            // Adicionar evento de clique
            marker.on('click', () => {
                this.selectStation(station, marker);
            });
            
            // Adicionar ao grupo de marcadores
            this.markers.addLayer(marker);
        });
        
        // Ajustar zoom para mostrar todos os marcadores
        if (fitBounds && this.markers.getLayers().length > 0) {
            this.map.fitBounds(this.markers.getBounds(), {
                padding: [50, 50],
                maxZoom: 15
            });
        }
    }
    
    /**
     * Seleciona um posto e destaca seu marcador
     * @param {Object} station - Posto a ser selecionado
     * @param {L.Marker} marker - Marcador do posto
     */
    selectStation(station, marker = null) {
        // Resetar marcador anterior
        if (this.selectedStation) {
            // Buscar marcador pelo ID do posto
            const layers = this.markers.getLayers();
            const oldMarker = layers.find(layer => layer.options.stationId === this.selectedStation.id);
            
            if (oldMarker) {
                oldMarker.setIcon(this.icons.default);
            }
        }
        
        // Atualizar posto selecionado
        this.selectedStation = station;
        
        // Destacar novo marcador
        if (!marker) {
            // Buscar marcador pelo ID do posto
            const layers = this.markers.getLayers();
            marker = layers.find(layer => layer.options.stationId === station.id);
        }
        
        if (marker) {
            marker.setIcon(this.icons.selected);
            
            // Centralizar mapa no marcador
            this.map.setView(marker.getLatLng(), Math.max(15, this.map.getZoom()));
        }
        
        // Chamar callback
        if (this.onStationSelect) {
            this.onStationSelect(station);
        }
    }
    
    /**
     * Seleciona um posto pelo ID
     * @param {string} stationId - ID do posto
     * @param {Array} stations - Lista de postos (opcional)
     */
    selectStationById(stationId, stations = null) {
        // Buscar posto pelo ID
        let station = null;
        
        if (stations) {
            station = stations.find(s => s.id === stationId);
        }
        
        if (!station) {
            console.warn(`Posto com ID ${stationId} não encontrado`);
            return;
        }
        
        this.selectStation(station);
    }
    
    /**
     * Mostra a localização atual do usuário no mapa
     */
    async showCurrentLocation() {
        try {
            // Verificar se o navegador suporta geolocalização
            if (!navigator.geolocation) {
                throw new Error('Geolocalização não suportada pelo navegador');
            }
            
            // Obter posição atual
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                });
            });
            
            const { latitude, longitude } = position.coords;
            
            // Remover marcador anterior
            if (this.currentLocationMarker) {
                this.map.removeLayer(this.currentLocationMarker);
            }
            
            // Adicionar novo marcador
            this.currentLocationMarker = L.marker([latitude, longitude], {
                icon: this.icons.current,
                title: 'Sua localização',
                zIndexOffset: 1000
            }).addTo(this.map);
            
            // Centralizar mapa
            this.map.setView([latitude, longitude], 15);
            
            return { latitude, longitude };
        } catch (error) {
            console.error('Erro ao obter localização:', error);
            
            // Mostrar mensagem amigável
            let message = 'Não foi possível obter sua localização.';
            
            if (error.code === 1) {
                message = 'Permissão de localização negada. Verifique as configurações do seu navegador.';
            } else if (error.code === 2) {
                message = 'Localização indisponível. Verifique se o GPS está ativado.';
            } else if (error.code === 3) {
                message = 'Tempo esgotado ao obter localização. Tente novamente.';
            }
            
            alert(message);
            throw error;
        }
    }
    
    /**
     * Centraliza o mapa em uma localização
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} zoom - Nível de zoom
     */
    centerMap(lat, lon, zoom = 15) {
        this.map.setView([lat, lon], zoom);
    }
    
    /**
     * Redimensiona o mapa (útil após alterações no layout)
     */
    resize() {
        this.map.invalidateSize();
    }
}

// Dados simulados para quando a API não retornar resultados
const dadosSimulados = {
    gerarPostosSimulados: function(lat, lon, quantidade = 20) {
        const postos = [];
        
        // Bandeiras comuns
        const bandeiras = ['Petrobras', 'Shell', 'Ipiranga', 'Raízen', 'Ale', 'Bandeira Branca'];
        
        // Nomes de ruas
        const ruas = ['Avenida Paulista', 'Rua Augusta', 'Avenida Brasil', 'Rua da Consolação', 
                      'Avenida Rebouças', 'Rua Oscar Freire', 'Avenida Faria Lima', 'Rua Haddock Lobo'];
        
        // Bairros
        const bairros = ['Centro', 'Jardins', 'Pinheiros', 'Vila Mariana', 'Moema', 
                         'Itaim Bibi', 'Brooklin', 'Morumbi', 'Tatuapé'];
        
        // Gerar postos
        for (let i = 0; i < quantidade; i++) {
            // Gerar coordenadas aleatórias próximas
            const latOffset = (Math.random() - 0.5) * 0.05;
            const lonOffset = (Math.random() - 0.5) * 0.05;
            
            const posto = {
                id: `simulado_${i}`,
                nome: `Posto ${bandeiras[Math.floor(Math.random() * bandeiras.length)]} ${i + 1}`,
                bandeira: bandeiras[Math.floor(Math.random() * bandeiras.length)],
                endereco: `${ruas[Math.floor(Math.random() * ruas.length)]}, ${Math.floor(Math.random() * 2000)}`,
                bairro: bairros[Math.floor(Math.random() * bairros.length)],
                cidade: 'São Paulo',
                estado: 'SP',
                latitude: lat + latOffset,
                longitude: lon + lonOffset,
                preco_gasolina: (5 + Math.random() * 1.5).toFixed(2),
                preco_alcool: (3.5 + Math.random() * 1).toFixed(2),
                preco_diesel: (4.5 + Math.random() * 1).toFixed(2),
                preco_gnv: Math.random() > 0.7 ? (3 + Math.random() * 1).toFixed(2) : 'N/A',
                data_coleta: new Date().toISOString().split('T')[0],
                distancia: (Math.random() * 5).toFixed(2)
            };
            
            postos.push(posto);
        }
        
        // Ordenar por distância
        postos.sort((a, b) => parseFloat(a.distancia) - parseFloat(b.distancia));
        
        return postos;
    }
};
