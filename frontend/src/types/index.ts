
export interface FuelStation {
  posto: number;
  nome: string;
  bandeira: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
  preco_gasolina: string;
  preco_alcool: string;
  preco_diesel: string;
  preco_gnv: string;
  distancia?: number;
  data_coleta: string;
  fonte?: string;
}

export interface FuelType {
  id: string;
  name: string;
  icon: string;
}

export interface BrandType {
  id: string;
  name: string;
  color: string;
}

export interface SearchParams {
  lat: number;
  lon: number;
  raio: number;
  combustivel: string;
  bandeira: string | null;
  ordenar: string;
}
