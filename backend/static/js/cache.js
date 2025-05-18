/**
 * Cache.js - Implementação de cache geoespacial avançado
 */

const cacheManager = {
    // Armazenamento de cache
    cache: {},
    
    // Tempos de vida para diferentes tipos de dados (em segundos)
    ttl: {
        precos: 24 * 3600,       // 24 horas para preços
        info_basica: 7 * 24 * 3600,  // 7 dias para informações básicas
        coordenadas: 30 * 24 * 3600  // 30 dias para coordenadas
    },
    
    // Tamanho máximo do cache (em número de regiões)
    maxCacheSize: 100,
    
    // Inicializar cache
    init: function() {
        console.log('Inicializando sistema de cache geoespacial...');
        
        // Tentar carregar cache do armazenamento local
        this.loadFromLocalStorage();
        
        // Configurar limpeza periódica
        setInterval(() => {
            this.cleanExpiredCache();
        }, 60 * 60 * 1000); // Limpar a cada hora
        
        console.log('Sistema de cache inicializado');
    },
    
    // Gerar chave de região com base nas coordenadas
    getRegionKey: function(lat, lon, radius) {
        // Discretizar coordenadas para criar chaves de região
        // Precisão de ~1km para economizar espaço de cache
        const latKey = Math.round(lat * 100) / 100;
        const lonKey = Math.round(lon * 100) / 100;
        return `${latKey}:${lonKey}:${radius}`;
    },
    
    // Obter dados do cache
    getCachedData: function(lat, lon, radius, dataType = 'all') {
        const key = this.getRegionKey(lat, lon, radius);
        
        if (this.cache[key]) {
            if (dataType === 'all') {
                // Verificar se algum tipo de dado expirou
                const now = Date.now();
                let allValid = true;
                
                for (const type in this.cache[key]) {
                    const [data, timestamp] = this.cache[key][type];
                    if (now - timestamp > this.ttl[type] * 1000) {
                        allValid = false;
                        break;
                    }
                }
                
                if (allValid) {
                    console.log(`Cache hit para região ${key} (todos os dados)`);
                    
                    // Extrair apenas os dados, sem os timestamps
                    const result = {};
                    for (const type in this.cache[key]) {
                        result[type] = this.cache[key][type][0];
                    }
                    
                    return result;
                }
            } else if (this.cache[key][dataType]) {
                const [data, timestamp] = this.cache[key][dataType];
                const now = Date.now();
                
                if (now - timestamp <= this.ttl[dataType] * 1000) {
                    console.log(`Cache hit para região ${key}, tipo ${dataType}`);
                    return data;
                }
            }
        }
        
        console.log(`Cache miss para região ${key}, tipo ${dataType}`);
        return null;
    },
    
    // Armazenar dados no cache
    setCachedData: function(lat, lon, radius, dataType, data) {
        const key = this.getRegionKey(lat, lon, radius);
        
        // Inicializar região se não existir
        if (!this.cache[key]) {
            this.cache[key] = {};
        }
        
        // Armazenar dados com timestamp
        this.cache[key][dataType] = [data, Date.now()];
        console.log(`Dados armazenados em cache para região ${key}, tipo ${dataType}`);
        
        // Verificar tamanho do cache e limpar se necessário
        this.checkCacheSize();
        
        // Salvar no armazenamento local
        this.saveToLocalStorage();
    },
    
    // Verificar e limitar tamanho do cache
    checkCacheSize: function() {
        const regions = Object.keys(this.cache);
        
        if (regions.length > this.maxCacheSize) {
            console.log(`Cache excedeu tamanho máximo (${regions.length}/${this.maxCacheSize}), limpando...`);
            
            // Ordenar regiões por timestamp mais recente (mais antigo primeiro)
            const sortedRegions = regions.sort((a, b) => {
                const aNewest = Math.max(...Object.values(this.cache[a]).map(item => item[1]));
                const bNewest = Math.max(...Object.values(this.cache[b]).map(item => item[1]));
                return aNewest - bNewest;
            });
            
            // Remover regiões mais antigas
            const regionsToRemove = sortedRegions.slice(0, sortedRegions.length - this.maxCacheSize);
            regionsToRemove.forEach(region => {
                delete this.cache[region];
            });
            
            console.log(`Removidas ${regionsToRemove.length} regiões antigas do cache`);
        }
    },
    
    // Limpar entradas expiradas do cache
    cleanExpiredCache: function() {
        console.log('Limpando entradas expiradas do cache...');
        const now = Date.now();
        let removedCount = 0;
        
        for (const key in this.cache) {
            for (const dataType in this.cache[key]) {
                const [data, timestamp] = this.cache[key][dataType];
                
                if (now - timestamp > this.ttl[dataType] * 1000) {
                    delete this.cache[key][dataType];
                    removedCount++;
                }
            }
            
            // Remover região se estiver vazia
            if (Object.keys(this.cache[key]).length === 0) {
                delete this.cache[key];
            }
        }
        
        console.log(`Limpeza concluída, ${removedCount} entradas removidas`);
        
        // Atualizar armazenamento local
        this.saveToLocalStorage();
    },
    
    // Salvar cache no armazenamento local
    saveToLocalStorage: function() {
        try {
            // Criar versão simplificada do cache para armazenamento
            const simplifiedCache = {};
            
            for (const key in this.cache) {
                simplifiedCache[key] = {};
                
                for (const dataType in this.cache[key]) {
                    simplifiedCache[key][dataType] = this.cache[key][dataType];
                }
            }
            
            localStorage.setItem('postosCombustiveisCache', JSON.stringify(simplifiedCache));
            console.log('Cache salvo no armazenamento local');
        } catch (error) {
            console.error('Erro ao salvar cache no armazenamento local:', error);
        }
    },
    
    // Carregar cache do armazenamento local
    loadFromLocalStorage: function() {
        try {
            const savedCache = localStorage.getItem('postosCombustiveisCache');
            
            if (savedCache) {
                this.cache = JSON.parse(savedCache);
                console.log('Cache carregado do armazenamento local');
            }
        } catch (error) {
            console.error('Erro ao carregar cache do armazenamento local:', error);
        }
    },
    
    // Pré-carregar regiões vizinhas
    preloadNeighboringRegions: function(lat, lon, radius) {
        console.log(`Pré-carregando regiões vizinhas de ${lat}, ${lon}...`);
        
        // Definir deslocamentos para regiões vizinhas (em graus)
        const offsets = [
            [0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02]
        ];
        
        // Verificar cada região vizinha
        offsets.forEach(([latOffset, lonOffset]) => {
            const neighborLat = lat + latOffset;
            const neighborLon = lon + lonOffset;
            const key = this.getRegionKey(neighborLat, neighborLon, radius);
            
            // Se a região não estiver em cache, programar carregamento
            if (!this.cache[key]) {
                console.log(`Programando pré-carregamento para região vizinha ${key}`);
                
                // Usar setTimeout para não bloquear a interface
                setTimeout(() => {
                    // Aqui seria chamada a API para carregar dados da região
                    // Por enquanto, apenas registramos a intenção
                    console.log(`Executando pré-carregamento para região ${key}`);
                }, 2000);
            }
        });
    },
    
    // Calcular estatísticas de uso do cache
    getStats: function() {
        const regions = Object.keys(this.cache).length;
        let entries = 0;
        let oldestTimestamp = Date.now();
        let newestTimestamp = 0;
        let sizeEstimate = 0;
        
        for (const key in this.cache) {
            for (const dataType in this.cache[key]) {
                entries++;
                const [data, timestamp] = this.cache[key][dataType];
                
                oldestTimestamp = Math.min(oldestTimestamp, timestamp);
                newestTimestamp = Math.max(newestTimestamp, timestamp);
                
                // Estimativa grosseira de tamanho
                sizeEstimate += JSON.stringify(data).length;
            }
        }
        
        return {
            regions,
            entries,
            oldestEntry: new Date(oldestTimestamp).toISOString(),
            newestEntry: new Date(newestTimestamp).toISOString(),
            sizeEstimateKB: Math.round(sizeEstimate / 1024),
            maxRegions: this.maxCacheSize
        };
    }
};

// Inicializar cache quando o script for carregado
document.addEventListener('DOMContentLoaded', function() {
    cacheManager.init();
});
