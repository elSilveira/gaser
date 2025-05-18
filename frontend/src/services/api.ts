
import { FuelStation, SearchParams } from "@/types";

// Mock data for demonstration
const mockStations: FuelStation[] = [
  {
    posto: 1,
    nome: "Posto Shell Centro",
    bandeira: "Shell",
    endereco: "Av. Brasil, 1500",
    bairro: "Centro",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5505,
    longitude: -46.6333,
    preco_gasolina: "5.49",
    preco_alcool: "3.99",
    preco_diesel: "4.89",
    preco_gnv: "4.29",
    distancia: 1.2,
    data_coleta: "2025-05-15",
    fonte: "Simulado"
  },
  {
    posto: 2,
    nome: "Auto Posto Ipiranga",
    bandeira: "Ipiranga",
    endereco: "Rua da Consolação, 2200",
    bairro: "Consolação",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5555,
    longitude: -46.6633,
    preco_gasolina: "5.39",
    preco_alcool: "3.89",
    preco_diesel: "4.79",
    preco_gnv: "N/A",
    distancia: 2.5,
    data_coleta: "2025-05-16",
    fonte: "Simulado"
  },
  {
    posto: 3,
    nome: "Petrobras BR Paulista",
    bandeira: "Petrobras",
    endereco: "Av. Paulista, 1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5654,
    longitude: -46.6424,
    preco_gasolina: "5.29",
    preco_alcool: "3.79",
    preco_diesel: "4.69",
    preco_gnv: "4.19",
    distancia: 1.8,
    data_coleta: "2025-05-17",
    fonte: "Simulado"
  },
  {
    posto: 4,
    nome: "Posto Branco Independente",
    bandeira: "Outras",
    endereco: "Rua Augusta, 500",
    bairro: "Consolação",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5494,
    longitude: -46.6567,
    preco_gasolina: "5.19",
    preco_alcool: "3.69",
    preco_diesel: "4.59",
    preco_gnv: "N/A",
    distancia: 0.9,
    data_coleta: "2025-05-14",
    fonte: "Simulado"
  },
  {
    posto: 5,
    nome: "Shell Express",
    bandeira: "Shell",
    endereco: "Av. Rebouças, 1234",
    bairro: "Pinheiros",
    cidade: "São Paulo",
    estado: "SP",
    latitude: -23.5742,
    longitude: -46.6758,
    preco_gasolina: "5.59",
    preco_alcool: "4.09",
    preco_diesel: "4.99",
    preco_gnv: "N/A",
    distancia: 3.1,
    data_coleta: "2025-05-16",
    fonte: "Simulado"
  }
];

export class API {
  private baseUrl: string = '/api';

  async buscarPostosProximos(params: SearchParams): Promise<FuelStation[]> {
    try {
      // In a real app, this would be an actual API call
      console.log('Searching for fuel stations with params:', params);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter and sort mock data based on search params
      let result = [...mockStations];
      
      // Apply brand filter if specified
      if (params.bandeira && params.bandeira !== 'todas') {
        result = result.filter(station => station.bandeira === params.bandeira);
      }
      
      // Sort by price or distance
      if (params.ordenar === 'preco') {
        const fuelType = `preco_${params.combustivel}`;
        result.sort((a, b) => {
          const priceA = a[fuelType as keyof FuelStation] as string;
          const priceB = b[fuelType as keyof FuelStation] as string;
          
          // Handle N/A values
          if (priceA === 'N/A') return 1;
          if (priceB === 'N/A') return -1;
          
          return parseFloat(priceA) - parseFloat(priceB);
        });
      } else {
        // Sort by distance
        result.sort((a, b) => (a.distancia || 999) - (b.distancia || 999));
      }
      
      return result;
    } catch (error) {
      console.error('Error in API:', error);
      throw error;
    }
  }

  async buscarPostoPorId(id: number): Promise<FuelStation | null> {
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const station = mockStations.find(s => s.posto === id);
      return station || null;
    } catch (error) {
      console.error('Error in API:', error);
      throw error;
    }
  }
}

export default new API();
