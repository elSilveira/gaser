
import { FuelStation } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { GasPump, MapPin, Calendar } from "lucide-react";

interface StationCardProps {
  station: FuelStation;
  selectedFuel: string;
  onClick: () => void;
  isSelected?: boolean;
}

export default function StationCard({ station, selectedFuel, onClick, isSelected = false }: StationCardProps) {
  // Get price for the selected fuel type
  const getPriceForFuel = () => {
    const fuelType = `preco_${selectedFuel}`;
    const price = station[fuelType as keyof FuelStation] as string;
    return price !== 'N/A' ? price : 'N/D';
  };

  // Format date to dd/mm/yyyy
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/D';
    
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${
      (date.getMonth() + 1).toString().padStart(2, '0')}/${
      date.getFullYear()}`;
  };

  // Define brand color
  const getBrandColor = () => {
    switch (station.bandeira) {
      case 'Petrobras': return 'bg-petrobras';
      case 'Shell': return 'bg-shell';
      case 'Ipiranga': return 'bg-ipiranga';
      default: return 'bg-secondary';
    }
  };

  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary shadow-md' : ''
      }`} 
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center space-x-2 mb-2">
          <div className={`w-3 h-3 rounded-full ${getBrandColor()}`} />
          <h3 className="font-bold truncate">{station.nome}</h3>
        </div>
        
        <div className="text-sm text-muted-foreground mb-2 truncate">
          {station.endereco}, {station.bairro}
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          <div className="bg-primary/10 text-primary rounded-md px-2 py-1 text-sm flex items-center">
            <GasPump className="w-4 h-4 mr-1" />
            <span className="font-semibold">{getPriceForFuel() !== 'N/D' ? `R$ ${getPriceForFuel()}` : 'N/D'}</span>
          </div>
          
          {station.distancia !== undefined && (
            <div className="bg-muted rounded-md px-2 py-1 text-sm flex items-center">
              <MapPin className="w-4 h-4 mr-1" />
              <span>{station.distancia.toFixed(1)} km</span>
            </div>
          )}
          
          <div className="bg-muted rounded-md px-2 py-1 text-sm flex items-center">
            <Calendar className="w-4 h-4 mr-1" />
            <span>{formatDate(station.data_coleta)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
