/**
 * API.js - Responsável pela comunicação com o backend, com suporte a cache
 */

const api = {
    // URL base da API
    baseUrl: '/api',
    
    // Obter postos próximos a uma localização
    getStationsNearby: async function(lat, lon, radius = 5, fuel = 'gasolina', brand = 'todas', orderBy = 'distancia') {
        try {
            console.log(`Buscando postos próximos a ${lat},${lon} com raio de ${radius}km`);
            
            // Verificar cache primeiro
            const cachedData = cacheManager.getCachedData(lat, lon, radius, 'postos_proximos');
            if (cachedData) {
                console.log('Usando dados em cache para postos próximos');
                
                // Pré-carregar regiões vizinhas em segundo plano
                setTimeout(() => {
                    cacheManager.preloadNeighboringRegions(lat, lon, radius);
                }, 100);
                
                return cachedData;
            }
            
            // Se não estiver em cache, buscar da API
            const response = await fetch(`${this.baseUrl}/postos/proximos?lat=${lat}&lon=${lon}&raio=${radius}&combustivel=${fuel}&bandeira=${brand}&ordenar=${orderBy}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Encontrados ${data.postos.length} postos`);
            
            // Armazenar em cache
            cacheManager.setCachedData(lat, lon, radius, 'postos_proximos', data.postos);
            
            // Pré-carregar regiões vizinhas em segundo plano
            setTimeout(() => {
                cacheManager.preloadNeighboringRegions(lat, lon, radius);
            }, 100);
            
            return data.postos;
        } catch (error) {
            console.error('Erro ao buscar postos próximos:', error);
            
            // Fallback para dados simulados em caso de erro
            console.log('Usando dados simulados como fallback');
            if (typeof dadosSimulados !== 'undefined') {
                const postos = dadosSimulados.gerarPostosSimulados(lat, lon, 30);
                
                // Armazenar dados simulados em cache temporário (TTL menor)
                cacheManager.setCachedData(lat, lon, radius, 'postos_simulados', postos);
                
                return postos;
            }
            
            throw error;
        }
    },
    
    // Buscar postos por texto (endereço, cidade, etc)
    searchStations: async function(query, fuel = 'gasolina', brand = 'todas', orderBy = 'distancia') {
        try {
            console.log(`Buscando postos com query "${query}"`);
            
            // Verificar cache primeiro (usando hash da query como parte da chave)
            const queryHash = this.hashString(query);
            const cachedData = cacheManager.getCachedData(queryHash, 0, 0, 'busca_texto');
            
            if (cachedData) {
                console.log('Usando dados em cache para busca por texto');
                return cachedData;
            }
            
            // Se não estiver em cache, buscar da API
            const response = await fetch(`${this.baseUrl}/postos/busca?q=${encodeURIComponent(query)}&combustivel=${fuel}&bandeira=${brand}&ordenar=${orderBy}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Encontrados ${data.postos.length} postos para "${query}"`);
            
            // Armazenar em cache
            cacheManager.setCachedData(queryHash, 0, 0, 'busca_texto', data.postos);
            
            return data.postos;
        } catch (error) {
            console.error('Erro ao buscar postos por texto:', error);
            
            // Fallback para dados simulados em caso de erro
            console.log('Usando dados simulados como fallback');
            if (typeof dadosSimulados !== 'undefined') {
                // Usar coordenadas de São Paulo como fallback
                return dadosSimulados.gerarPostosSimulados(-23.5505, -46.6333, 30);
            }
            
            throw error;
        }
    },
    
    // Obter detalhes de um posto específico
    getStationDetails: async function(stationId) {
        try {
            console.log(`Buscando detalhes do posto ${stationId}`);
            
            // Verificar cache primeiro
            const cachedData = cacheManager.getCachedData(stationId, 0, 0, 'detalhes_posto');
            
            if (cachedData) {
                console.log('Usando dados em cache para detalhes do posto');
                return cachedData;
            }
            
            // Se não estiver em cache, buscar da API
            const response = await fetch(`${this.baseUrl}/postos/${stationId}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Detalhes do posto ${stationId} obtidos com sucesso`);
            
            // Armazenar em cache
            cacheManager.setCachedData(stationId, 0, 0, 'detalhes_posto', data.posto);
            
            return data.posto;
        } catch (error) {
            console.error(`Erro ao buscar detalhes do posto ${stationId}:`, error);
            throw error;
        }
    },
    
    // Obter lista de bandeiras disponíveis
    getBrands: async function() {
        try {
            console.log('Buscando lista de bandeiras');
            
            // Verificar cache primeiro (usando chave fixa)
            const cachedData = cacheManager.getCachedData('bandeiras', 0, 0, 'lista_bandeiras');
            
            if (cachedData) {
                console.log('Usando dados em cache para lista de bandeiras');
                return cachedData;
            }
            
            // Se não estiver em cache, buscar da API
            const response = await fetch(`${this.baseUrl}/bandeiras`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Obtidas ${data.bandeiras.length} bandeiras`);
            
            // Armazenar em cache (dados estáticos, TTL longo)
            cacheManager.setCachedData('bandeiras', 0, 0, 'lista_bandeiras', data.bandeiras);
            
            return data.bandeiras;
        } catch (error) {
            console.error('Erro ao buscar bandeiras:', error);
            
            // Fallback para lista padrão de bandeiras
            console.log('Usando lista padrão de bandeiras como fallback');
            return ['Todas', 'Petrobras', 'Shell', 'Ipiranga', 'Raízen', 'Ale', 'Bandeira Branca'];
        }
    },
    
    // Verificar status da API
    checkStatus: async function() {
        try {
            console.log('Verificando status da API');
            
            // Não usar cache para status da API
            const response = await fetch(`${this.baseUrl}/status`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Status da API:', data);
            return data;
        } catch (error) {
            console.error('Erro ao verificar status da API:', error);
            return { status: 'error', message: error.message };
        }
    },
    
    // Obter estatísticas de uso do cache
    getCacheStats: function() {
        return cacheManager.getStats();
    },
    
    // Função auxiliar para criar hash de string
    hashString: function(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Converter para inteiro de 32 bits
        }
        return hash;
    }
};
