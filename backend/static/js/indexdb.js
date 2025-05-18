/**
 * IndexDB.js - Sistema de indexação e armazenamento local otimizado
 */

const dbManager = {
    // Nome do banco de dados
    dbName: 'PostosCombustiveisDB',
    
    // Versão do banco de dados
    dbVersion: 1,
    
    // Referência ao banco de dados
    db: null,
    
    // Status de inicialização
    initialized: false,
    
    // Inicializar banco de dados
    init: async function() {
        if (this.initialized) {
            console.log('Banco de dados já inicializado');
            return this.db;
        }
        
        console.log('Inicializando banco de dados IndexedDB...');
        
        return new Promise((resolve, reject) => {
            // Abrir conexão com o banco de dados
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            // Manipulador de erro
            request.onerror = (event) => {
                console.error('Erro ao abrir banco de dados:', event.target.error);
                reject(event.target.error);
            };
            
            // Manipulador de sucesso
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.initialized = true;
                console.log('Banco de dados inicializado com sucesso');
                resolve(this.db);
            };
            
            // Manipulador de atualização (criação/migração)
            request.onupgradeneeded = (event) => {
                console.log('Criando/atualizando estrutura do banco de dados...');
                const db = event.target.result;
                
                // Criar object stores (tabelas)
                
                // Store para postos
                if (!db.objectStoreNames.contains('postos')) {
                    const postosStore = db.createObjectStore('postos', { keyPath: 'id' });
                    
                    // Índices para buscas rápidas
                    postosStore.createIndex('bandeira', 'bandeira', { unique: false });
                    postosStore.createIndex('cidade', 'cidade', { unique: false });
                    postosStore.createIndex('estado', 'estado', { unique: false });
                    postosStore.createIndex('coordenadas', ['latitude', 'longitude'], { unique: false });
                    
                    console.log('Object store "postos" criada com sucesso');
                }
                
                // Store para regiões geográficas
                if (!db.objectStoreNames.contains('regioes')) {
                    const regioesStore = db.createObjectStore('regioes', { keyPath: 'key' });
                    
                    // Índice para data de atualização
                    regioesStore.createIndex('updated', 'updated', { unique: false });
                    
                    console.log('Object store "regioes" criada com sucesso');
                }
                
                // Store para metadados
                if (!db.objectStoreNames.contains('metadados')) {
                    db.createObjectStore('metadados', { keyPath: 'key' });
                    console.log('Object store "metadados" criada com sucesso');
                }
                
                console.log('Estrutura do banco de dados criada/atualizada com sucesso');
            };
        });
    },
    
    // Salvar postos no banco de dados
    saveStations: async function(stations) {
        if (!this.initialized) {
            await this.init();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['postos'], 'readwrite');
            const store = transaction.objectStore('postos');
            
            let count = 0;
            
            // Adicionar cada posto ao banco de dados
            stations.forEach(station => {
                // Garantir que o posto tenha um ID único
                if (!station.id) {
                    station.id = `posto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                
                const request = store.put(station);
                
                request.onsuccess = () => {
                    count++;
                };
                
                request.onerror = (event) => {
                    console.error('Erro ao salvar posto:', event.target.error);
                };
            });
            
            transaction.oncomplete = () => {
                console.log(`${count} postos salvos no banco de dados`);
                resolve(count);
            };
            
            transaction.onerror = (event) => {
                console.error('Erro na transação:', event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // Salvar região geográfica no banco de dados
    saveRegion: async function(key, stations, metadata = {}) {
        if (!this.initialized) {
            await this.init();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['regioes', 'postos'], 'readwrite');
            const regioesStore = transaction.objectStore('regioes');
            const postosStore = transaction.objectStore('postos');
            
            // Salvar informações da região
            const region = {
                key,
                stations: stations.map(s => s.id), // Armazenar apenas IDs dos postos
                metadata,
                updated: Date.now()
            };
            
            regioesStore.put(region);
            
            // Salvar cada posto individualmente
            stations.forEach(station => {
                // Garantir que o posto tenha um ID único
                if (!station.id) {
                    station.id = `posto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                }
                
                postosStore.put(station);
            });
            
            transaction.oncomplete = () => {
                console.log(`Região ${key} salva com ${stations.length} postos`);
                resolve(true);
            };
            
            transaction.onerror = (event) => {
                console.error('Erro ao salvar região:', event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // Buscar postos por região geográfica
    getStationsByRegion: async function(key) {
        if (!this.initialized) {
            await this.init();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['regioes', 'postos'], 'readonly');
            const regioesStore = transaction.objectStore('regioes');
            const postosStore = transaction.objectStore('postos');
            
            // Buscar informações da região
            const regionRequest = regioesStore.get(key);
            
            regionRequest.onsuccess = (event) => {
                const region = event.target.result;
                
                if (!region) {
                    console.log(`Região ${key} não encontrada no banco de dados`);
                    resolve({ stations: [], metadata: {}, updated: null });
                    return;
                }
                
                // Verificar se a região está expirada (mais de 24 horas)
                const now = Date.now();
                const isExpired = (now - region.updated) > 24 * 60 * 60 * 1000;
                
                if (isExpired) {
                    console.log(`Região ${key} está expirada, dados podem estar desatualizados`);
                }
                
                // Buscar cada posto pelo ID
                const stations = [];
                let pendingRequests = region.stations.length;
                
                if (pendingRequests === 0) {
                    resolve({ stations: [], metadata: region.metadata, updated: region.updated });
                    return;
                }
                
                region.stations.forEach(stationId => {
                    const stationRequest = postosStore.get(stationId);
                    
                    stationRequest.onsuccess = (event) => {
                        const station = event.target.result;
                        if (station) {
                            stations.push(station);
                        }
                        
                        pendingRequests--;
                        if (pendingRequests === 0) {
                            console.log(`Recuperados ${stations.length} postos da região ${key}`);
                            resolve({ 
                                stations, 
                                metadata: region.metadata, 
                                updated: region.updated,
                                isExpired
                            });
                        }
                    };
                    
                    stationRequest.onerror = (event) => {
                        console.error(`Erro ao buscar posto ${stationId}:`, event.target.error);
                        pendingRequests--;
                        if (pendingRequests === 0) {
                            resolve({ 
                                stations, 
                                metadata: region.metadata, 
                                updated: region.updated,
                                isExpired
                            });
                        }
                    };
                });
            };
            
            regionRequest.onerror = (event) => {
                console.error(`Erro ao buscar região ${key}:`, event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // Buscar postos próximos a uma coordenada
    getStationsNearby: async function(lat, lon, radius = 5) {
        if (!this.initialized) {
            await this.init();
        }
        
        // Gerar chave de região
        const latKey = Math.round(lat * 100) / 100;
        const lonKey = Math.round(lon * 100) / 100;
        const key = `${latKey}:${lonKey}:${radius}`;
        
        // Buscar postos da região
        const { stations, isExpired } = await this.getStationsByRegion(key);
        
        if (stations.length > 0 && !isExpired) {
            console.log(`Usando ${stations.length} postos em cache para coordenadas ${lat}, ${lon}`);
            return stations;
        }
        
        console.log(`Sem dados em cache válidos para coordenadas ${lat}, ${lon}`);
        return null;
    },
    
    // Buscar postos por texto (cidade, endereço, etc)
    searchStations: async function(query) {
        if (!this.initialized) {
            await this.init();
        }
        
        // Normalizar query para busca
        query = query.toLowerCase().trim();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['postos'], 'readonly');
            const store = transaction.objectStore('postos');
            
            // Usar cursor para percorrer todos os postos
            const request = store.openCursor();
            const results = [];
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    const posto = cursor.value;
                    
                    // Verificar se o posto corresponde à busca
                    if (
                        posto.nome?.toLowerCase().includes(query) ||
                        posto.endereco?.toLowerCase().includes(query) ||
                        posto.bairro?.toLowerCase().includes(query) ||
                        posto.cidade?.toLowerCase().includes(query) ||
                        posto.estado?.toLowerCase().includes(query) ||
                        posto.bandeira?.toLowerCase().includes(query)
                    ) {
                        results.push(posto);
                    }
                    
                    // Continuar para o próximo posto
                    cursor.continue();
                } else {
                    console.log(`Busca por "${query}" retornou ${results.length} postos`);
                    resolve(results);
                }
            };
            
            request.onerror = (event) => {
                console.error('Erro na busca:', event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // Limpar dados antigos
    cleanOldData: async function() {
        if (!this.initialized) {
            await this.init();
        }
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['regioes'], 'readwrite');
            const store = transaction.objectStore('regioes');
            
            // Usar índice de data de atualização
            const index = store.index('updated');
            const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 dias
            
            const range = IDBKeyRange.upperBound(cutoffTime);
            const request = index.openCursor(range);
            
            let count = 0;
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (cursor) {
                    // Remover região antiga
                    cursor.delete();
                    count++;
                    cursor.continue();
                } else {
                    console.log(`Removidas ${count} regiões antigas`);
                    resolve(count);
                }
            };
            
            request.onerror = (event) => {
                console.error('Erro ao limpar dados antigos:', event.target.error);
                reject(event.target.error);
            };
        });
    },
    
    // Obter estatísticas do banco de dados
    getStats: async function() {
        if (!this.initialized) {
            await this.init();
        }
        
        const stats = {
            regioes: 0,
            postos: 0,
            tamanhoEstimado: 0,
            regiaoMaisAntiga: null,
            regiaoMaisRecente: null
        };
        
        // Contar regiões
        const regioesCount = await new Promise((resolve) => {
            const transaction = this.db.transaction(['regioes'], 'readonly');
            const store = transaction.objectStore('regioes');
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                resolve(countRequest.result);
            };
            
            countRequest.onerror = () => {
                resolve(0);
            };
        });
        
        stats.regioes = regioesCount;
        
        // Contar postos
        const postosCount = await new Promise((resolve) => {
            const transaction = this.db.transaction(['postos'], 'readonly');
            const store = transaction.objectStore('postos');
            const countRequest = store.count();
            
            countRequest.onsuccess = () => {
                resolve(countRequest.result);
            };
            
            countRequest.onerror = () => {
                resolve(0);
            };
        });
        
        stats.postos = postosCount;
        
        // Estimar tamanho (baseado em média de 1KB por posto)
        stats.tamanhoEstimado = Math.round(postosCount * 1.2); // KB
        
        // Encontrar região mais antiga e mais recente
        if (regioesCount > 0) {
            const transaction = this.db.transaction(['regioes'], 'readonly');
            const store = transaction.objectStore('regioes');
            const index = store.index('updated');
            
            // Região mais antiga
            await new Promise((resolve) => {
                const request = index.openCursor();
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        stats.regiaoMaisAntiga = new Date(cursor.value.updated).toISOString();
                        resolve();
                    } else {
                        resolve();
                    }
                };
                
                request.onerror = () => {
                    resolve();
                };
            });
            
            // Região mais recente
            await new Promise((resolve) => {
                const request = index.openCursor(null, 'prev');
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        stats.regiaoMaisRecente = new Date(cursor.value.updated).toISOString();
                        resolve();
                    } else {
                        resolve();
                    }
                };
                
                request.onerror = () => {
                    resolve();
                };
            });
        }
        
        return stats;
    }
};

// Inicializar banco de dados quando o script for carregado
document.addEventListener('DOMContentLoaded', function() {
    // Inicializar de forma assíncrona para não bloquear a interface
    setTimeout(() => {
        dbManager.init().then(() => {
            // Limpar dados antigos após inicialização
            dbManager.cleanOldData();
        });
    }, 1000);
});
