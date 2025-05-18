/**
 * Dados simulados para quando a API não retornar resultados
 */

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
