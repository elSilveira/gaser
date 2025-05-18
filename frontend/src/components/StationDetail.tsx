
import { FuelStation } from '@/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Navigation } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface StationDetailProps {
  station: FuelStation;
  onClose: () => void;
  isSimulated?: boolean;
}

export default function StationDetail({ station, onClose, isSimulated = true }: StationDetailProps) {
  const getPriceDisplay = (price: string) => {
    if (!price || price === 'N/A') return 'Não disponível';
    return `R$ ${price}`;
  };
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/D';
    
    const date = new Date(dateStr);
    return `${date.getDate().toString().padStart(2, '0')}/${
      (date.getMonth() + 1).toString().padStart(2, '0')}/${
      date.getFullYear()}`;
  };
  
  const navigateToStation = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`,
      '_blank'
    );
  };

  return (
    <Card className="shadow-lg p-5">
      {isSimulated && (
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded-md mb-4 text-sm flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Exibindo dados simulados para demonstração.
        </div>
      )}
      
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold">{station.nome}</h2>
          <p className="text-muted-foreground">{station.endereco}, {station.bairro}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="mt-4 space-y-3">
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">Gasolina</span>
          <span className={`font-bold ${station.preco_gasolina && station.preco_gasolina !== 'N/A' ? 'text-primary' : ''}`}>
            {getPriceDisplay(station.preco_gasolina)}
          </span>
        </div>
        
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">Álcool</span>
          <span className={`font-bold ${station.preco_alcool && station.preco_alcool !== 'N/A' ? 'text-primary' : ''}`}>
            {getPriceDisplay(station.preco_alcool)}
          </span>
        </div>
        
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">Diesel</span>
          <span className={`font-bold ${station.preco_diesel && station.preco_diesel !== 'N/A' ? 'text-primary' : ''}`}>
            {getPriceDisplay(station.preco_diesel)}
          </span>
        </div>
        
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">GNV</span>
          <span className={`font-bold ${station.preco_gnv && station.preco_gnv !== 'N/A' ? 'text-primary' : ''}`}>
            {getPriceDisplay(station.preco_gnv)}
          </span>
        </div>
        
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">Bandeira</span>
          <span className="font-bold">{station.bandeira || 'Bandeira Branca'}</span>
        </div>
        
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">Distância</span>
          <span className="font-bold">{station.distancia ? `${station.distancia.toFixed(2)} km` : 'N/D'}</span>
        </div>
        
        <div className="flex justify-between py-2 border-b">
          <span className="font-medium">Última Atualização</span>
          <span className="font-bold">{formatDate(station.data_coleta)}</span>
        </div>
      </div>
      
      <div className="flex justify-between mt-5 gap-3">
        <Button className="flex-1" variant="default" onClick={navigateToStation}>
          <Navigation className="mr-2 h-4 w-4" />
          Como Chegar
        </Button>
        <Button className="flex-1" variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>
    </Card>
  );
}
