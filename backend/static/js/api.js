/**
 * API.js - Responsável pela comunicação com o backend
 */

const api = {
    // URL base da API
    baseUrl: '/api',
    
    // Obter postos próximos a uma localização
    getStationsNearby: async function(lat, lon, radius = 5, fuel = 'gasolina', brand = 'todas', orderBy = 'distancia') {
        try {
            console.log(`Buscando postos próximos a ${lat},${lon} com raio de ${radius}km`);
            const response = await fetch(`${this.baseUrl}/postos/proximos?lat=${lat}&lon=${lon}&raio=${radius}&combustivel=${fuel}&bandeira=${brand}&ordenar=${orderBy}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Encontrados ${data.postos.length} postos`);
            return data.postos;
        } catch (error) {
            console.error('Erro ao buscar postos próximos:', error);
            
            // Fallback para dados simulados em caso de erro
            console.log('Usando dados simulados como fallback');
            if (typeof dadosSimulados !== 'undefined') {
                return dadosSimulados.gerarPostosSimulados(lat, lon, 30);
            }
            
            throw error;
        }
    },
    
    // Buscar postos por texto (endereço, cidade, etc)
    searchStations: async function(query, fuel = 'gasolina', brand = 'todas', orderBy = 'distancia') {
        try {
            console.log(`Buscando postos com query "${query}"`);
            const response = await fetch(`${this.baseUrl}/postos/busca?q=${encodeURIComponent(query)}&combustivel=${fuel}&bandeira=${brand}&ordenar=${orderBy}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Encontrados ${data.postos.length} postos para "${query}"`);
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
            const response = await fetch(`${this.baseUrl}/postos/${stationId}`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Detalhes do posto ${stationId} obtidos com sucesso`);
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
            const response = await fetch(`${this.baseUrl}/bandeiras`);
            
            if (!response.ok) {
                throw new Error(`Erro na API: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`Obtidas ${data.bandeiras.length} bandeiras`);
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
    }
};
