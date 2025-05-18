/**
 * API.js - Responsável pela comunicação com o backend
 */

class API {
    constructor(baseUrl = '') {
        // URL base da API
        this.baseUrl = baseUrl || window.location.origin;
        
        // Cache para resultados de API
        this.cache = {
            estados: null,
            cidades: {},
            bandeiras: null,
            postosPorRegiao: {}
        };
        
        // Timeout para requisições
        this.timeout = 10000; // 10 segundos
    }
    
    /**
     * Realiza uma requisição GET para a API
     * @param {string} endpoint - Endpoint da API
     * @param {Object} params - Parâmetros da requisição
     * @returns {Promise} - Promise com o resultado da requisição
     */
    async get(endpoint, params = {}) {
        try {
            // Construir URL com parâmetros
            const url = new URL(`${this.baseUrl}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });
            
            // Configurar timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            // Realizar requisição
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });
            
            // Limpar timeout
            clearTimeout(timeoutId);
            
            // Verificar status
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
            }
            
            // Retornar dados
            return await response.json();
        } catch (error) {
            console.error(`Erro ao acessar ${endpoint}:`, error);
            
            // Verificar se é erro de timeout
            if (error.name === 'AbortError') {
                throw new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.');
            }
            
            throw error;
        }
    }
    
    /**
     * Realiza uma requisição POST para a API
     * @param {string} endpoint - Endpoint da API
     * @param {Object} data - Dados a serem enviados
     * @returns {Promise} - Promise com o resultado da requisição
     */
    async post(endpoint, data = {}) {
        try {
            // Configurar timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            // Realizar requisição
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            
            // Limpar timeout
            clearTimeout(timeoutId);
            
            // Verificar status
            if (!response.ok) {
                throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
            }
            
            // Retornar dados
            return await response.json();
        } catch (error) {
            console.error(`Erro ao acessar ${endpoint}:`, error);
            
            // Verificar se é erro de timeout
            if (error.name === 'AbortError') {
                throw new Error('Tempo limite excedido. Verifique sua conexão e tente novamente.');
            }
            
            throw error;
        }
    }
    
    /**
     * Obtém o status da API
     * @returns {Promise} - Promise com o status da API
     */
    async getStatus() {
        return this.get('/api/status');
    }
    
    /**
     * Obtém postos próximos a uma localização
     * @param {number} lat - Latitude
     * @param {number} lon - Longitude
     * @param {number} raio - Raio de busca em km
     * @param {number} limite - Limite de resultados
     * @returns {Promise} - Promise com os postos próximos
     */
    async getPostosProximos(lat, lon, raio = 5, limite = 50) {
        // Verificar se já temos no cache
        const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}_${raio}_${limite}`;
        if (this.cache.postosPorRegiao[cacheKey]) {
            return this.cache.postosPorRegiao[cacheKey];
        }
        
        // Buscar da API
        const resultado = await this.get('/api/postos/proximos', {
            lat,
            lon,
            raio,
            limite
        });
        
        // Armazenar no cache
        this.cache.postosPorRegiao[cacheKey] = resultado;
        
        return resultado;
    }
    
    /**
     * Obtém postos por filtros
     * @param {Object} filtros - Filtros a serem aplicados
     * @param {number} limite - Limite de resultados
     * @returns {Promise} - Promise com os postos filtrados
     */
    async getPostosPorFiltros(filtros, limite = 100) {
        return this.get('/api/postos/filtros', {
            ...filtros,
            limite
        });
    }
    
    /**
     * Busca postos por texto
     * @param {string} texto - Texto a ser buscado
     * @param {number} limite - Limite de resultados
     * @returns {Promise} - Promise com os postos encontrados
     */
    async buscarPostos(texto, limite = 50) {
        return this.get('/api/postos/busca', {
            q: texto,
            limite
        });
    }
    
    /**
     * Obtém postos em lote para múltiplos pontos
     * @param {Array} pontos - Lista de pontos (lat, lon)
     * @param {number} raio - Raio de busca em km
     * @param {number} limite - Limite de resultados por ponto
     * @returns {Promise} - Promise com os postos por ponto
     */
    async getPostosEmLote(pontos, raio = 5, limite = 20) {
        return this.post('/api/postos/lote', {
            pontos,
            raio,
            limite
        });
    }
    
    /**
     * Obtém lista de estados
     * @returns {Promise} - Promise com a lista de estados
     */
    async getEstados() {
        // Verificar se já temos no cache
        if (this.cache.estados) {
            return this.cache.estados;
        }
        
        // Buscar da API
        const resultado = await this.get('/api/estados');
        
        // Armazenar no cache
        this.cache.estados = resultado;
        
        return resultado;
    }
    
    /**
     * Obtém lista de cidades por estado
     * @param {string} estado - Sigla do estado
     * @returns {Promise} - Promise com a lista de cidades
     */
    async getCidadesPorEstado(estado) {
        // Verificar se já temos no cache
        if (this.cache.cidades[estado]) {
            return this.cache.cidades[estado];
        }
        
        // Buscar da API
        const resultado = await this.get(`/api/cidades/${estado}`);
        
        // Armazenar no cache
        this.cache.cidades[estado] = resultado;
        
        return resultado;
    }
    
    /**
     * Obtém lista de bandeiras
     * @returns {Promise} - Promise com a lista de bandeiras
     */
    async getBandeiras() {
        // Verificar se já temos no cache
        if (this.cache.bandeiras) {
            return this.cache.bandeiras;
        }
        
        // Buscar da API
        const resultado = await this.get('/api/bandeiras');
        
        // Armazenar no cache
        this.cache.bandeiras = resultado;
        
        return resultado;
    }
    
    /**
     * Obtém metadados da API
     * @returns {Promise} - Promise com os metadados
     */
    async getMetadados() {
        return this.get('/api/metadados');
    }
    
    /**
     * Limpa o cache da API
     */
    limparCache() {
        this.cache = {
            estados: null,
            cidades: {},
            bandeiras: null,
            postosPorRegiao: {}
        };
    }
}

// Exportar instância única
const api = new API();
