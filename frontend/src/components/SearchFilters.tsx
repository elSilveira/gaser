
import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { FuelType, BrandType } from '@/types';
import { Search, SlidersHorizontal, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SearchFiltersProps {
  onSearch: (address: string) => void;
  onApplyFilters: (filters: {
    fuelType: string;
    brand: string;
    radius: number;
    sort: string;
  }) => void;
  onGetUserLocation: () => void;
}

const fuelTypes: FuelType[] = [
  { id: 'gasolina', name: 'Gasolina', icon: 'gas-pump' },
  { id: 'alcool', name: 'Álcool', icon: 'gas-pump' },
  { id: 'diesel', name: 'Diesel', icon: 'gas-pump' },
  { id: 'gnv', name: 'GNV', icon: 'gas-pump' }
];

const brandTypes: BrandType[] = [
  { id: 'todas', name: 'Todas', color: '#666666' },
  { id: 'Petrobras', name: 'Petrobras', color: '#00A335' },
  { id: 'Shell', name: 'Shell', color: '#FFCC00' },
  { id: 'Ipiranga', name: 'Ipiranga', color: '#0066B3' },
  { id: 'Outras', name: 'Outras', color: '#FF6600' }
];

export default function SearchFilters({ onSearch, onApplyFilters, onGetUserLocation }: SearchFiltersProps) {
  const [address, setAddress] = useState('');
  const [fuelType, setFuelType] = useState('gasolina');
  const [brand, setBrand] = useState('todas');
  const [radius, setRadius] = useState(5);
  const [sort, setSort] = useState('distancia');

  const handleApplyFilters = () => {
    onApplyFilters({
      fuelType,
      brand,
      radius,
      sort
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      onSearch(address);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Buscar por endereço ou cidade..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon">
          <Search className="h-4 w-4" />
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          size="icon" 
          onClick={onGetUserLocation} 
          title="Minha localização"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-navigation"><polygon points="12 2 19 21 12 17 5 21 12 2"/></svg>
        </Button>
      </form>
      
      <Card>
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Filtros</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fuel-select">Combustível</Label>
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger id="fuel-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypes.map((fuel) => (
                    <SelectItem key={fuel.id} value={fuel.id}>
                      {fuel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="brand-select">Bandeira</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger id="brand-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {brandTypes.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="radius-slider">Raio de busca</Label>
                <span className="text-sm text-muted-foreground">{radius} km</span>
              </div>
              <Slider
                id="radius-slider"
                min={1}
                max={20}
                step={1}
                value={[radius]}
                onValueChange={(values) => setRadius(values[0])}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="sort-select">Ordenar por</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger id="sort-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="distancia">Distância</SelectItem>
                  <SelectItem value="preco">Menor preço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              className="w-full" 
              onClick={handleApplyFilters}
            >
              <Filter className="mr-2 h-4 w-4" />
              Aplicar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
