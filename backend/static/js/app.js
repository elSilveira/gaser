/**
 * App.js - Responsável pela inicialização e controle da aplicação
 */

document.addEventListener('DOMContentLoaded', function() {
    console.log('Inicializando aplicação...');
    
    // Inicializar mapa
    mapManager.init('map');
    
    // Referências aos elementos da interface
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const locationButton = document.getElementById('location-button');
    const fuelSelect = document.getElementById('fuel-select');
    const brandSelect = document.getElementById('brand-select');
    const radiusInput = document.getElementById('radius-input');
    const orderSelect = document.getElementById('order-select');
    const filterButton = document.getElementById('filter-button');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    // Inicializar controles
    initControls();
    
    // Função para inicializar controles da interface
    function initControls() {
        // Botão de busca
        if (searchButton) {
            searchButton.addEventListener('click', function() {
                const query = searchInput.value.trim();
                if (query) {
                    const fuel = fuelSelect ? fuelSelect.value : 'gasolina';
                    const brand = brandSelect ? brandSelect.value : 'todas';
                    const orderBy = orderSelect ? orderSelect.value : 'distancia';
                    
                    mapManager.searchStations(query, fuel, brand, orderBy);
                }
            });
        }
        
        // Input de busca (Enter)
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const query = searchInput.value.trim();
                    if (query) {
                        const fuel = fuelSelect ? fuelSelect.value : 'gasolina';
                        const brand = brandSelect ? brandSelect.value : 'todas';
                        const orderBy = orderSelect ? orderSelect.value : 'distancia';
                        
                        mapManager.searchStations(query, fuel, brand, orderBy);
                    }
                }
            });
        }
        
        // Botão de localização atual
        if (locationButton) {
            locationButton.addEventListener('click', function() {
                mapManager.getCurrentLocation();
            });
        }
        
        // Botão de aplicar filtros
        if (filterButton) {
            filterButton.addEventListener('click', function() {
                const center = mapManager.map.getCenter();
                const lat = center.lat;
                const lon = center.lng;
                const radius = radiusInput ? parseFloat(radiusInput.value) : 5;
                const fuel = fuelSelect ? fuelSelect.value : 'gasolina';
                const brand = brandSelect ? brandSelect.value : 'todas';
                const orderBy = orderSelect ? orderSelect.value : 'distancia';
                
                mapManager.loadNearbyStations(lat, lon, radius, fuel, brand, orderBy);
            });
        }
        
        // Toggle da barra lateral
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', function() {
                const sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.toggle('collapsed');
                    
                    // Atualizar mapa após toggle para garantir que ele ocupe todo o espaço disponível
                    setTimeout(() => {
                        mapManager.map.invalidateSize();
                    }, 300);
                }
            });
        }
        
        // Carregar lista de bandeiras
        loadBrands();
    }
    
    // Função para carregar lista de bandeiras
    function loadBrands() {
        if (brandSelect) {
            api.getBrands()
                .then(brands => {
                    // Limpar select
                    brandSelect.innerHTML = '';
                    
                    // Adicionar opção "Todas"
                    const allOption = document.createElement('option');
                    allOption.value = 'todas';
                    allOption.textContent = 'Todas';
                    brandSelect.appendChild(allOption);
                    
                    // Adicionar cada bandeira
                    brands.forEach(brand => {
                        if (brand.toLowerCase() !== 'todas') {
                            const option = document.createElement('option');
                            option.value = brand.toLowerCase();
                            option.textContent = brand;
                            brandSelect.appendChild(option);
                        }
                    });
                })
                .catch(error => {
                    console.error('Erro ao carregar bandeiras:', error);
                });
        }
    }
    
    // Verificar status da API
    api.checkStatus()
        .then(status => {
            console.log('Status da API:', status);
            
            // Se a API estiver online, carregar dados iniciais
            if (status.status === 'online') {
                console.log('API online, carregando dados iniciais...');
                
                // Carregar dados apenas quando o usuário clicar em "Aplicar Filtros"
                // Não carregamos automaticamente para evitar movimentação do mapa
                
                // Mostrar mensagem inicial
                const stationsList = document.getElementById('stations-list');
                if (stationsList) {
                    stationsList.innerHTML = '<div class="initial-message"><p>Selecione os filtros desejados e clique em "Aplicar Filtros" para buscar postos próximos.</p><p>Ou use a barra de busca para encontrar postos em uma localidade específica.</p></div>';
                }
            } else {
                console.warn('API offline ou com problemas, usando dados simulados...');
                
                // Mostrar mensagem inicial
                const stationsList = document.getElementById('stations-list');
                if (stationsList) {
                    stationsList.innerHTML = '<div class="initial-message"><p>Selecione os filtros desejados e clique em "Aplicar Filtros" para buscar postos próximos.</p><p>Ou use a barra de busca para encontrar postos em uma localidade específica.</p></div>';
                }
            }
        })
        .catch(error => {
            console.error('Erro ao verificar status da API:', error);
            
            // Mostrar mensagem inicial
            const stationsList = document.getElementById('stations-list');
            if (stationsList) {
                stationsList.innerHTML = '<div class="initial-message"><p>Selecione os filtros desejados e clique em "Aplicar Filtros" para buscar postos próximos.</p><p>Ou use a barra de busca para encontrar postos em uma localidade específica.</p></div>';
            }
        });
});
