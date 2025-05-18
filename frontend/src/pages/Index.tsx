
import { useState, useEffect } from "react";
import API from "@/services/api";
import { FuelStation, SearchParams } from "@/types";
import { useToast } from "@/components/ui/use-toast";
import Header from "@/components/Header";
import MapContainer from "@/components/MapContainer";
import SearchFilters from "@/components/SearchFilters";
import StationCard from "@/components/StationCard";
import StationDetail from "@/components/StationDetail";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Index() {
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    fuelType: 'gasolina',
    brand: 'todas',
    radius: 5,
    sort: 'distancia'
  });
  
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  
  // Get user's location on initial load
  useEffect(() => {
    getUserLocation();
  }, []);
  
  // Effect to load stations when user location or filters change
  useEffect(() => {
    if (userLocation) {
      loadNearbyStations();
    }
  }, [userLocation, filters]);

  const getUserLocation = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setUserLocation({ lat: latitude, lng: longitude });
          },
          (error) => {
            console.error('Error getting location:', error);
            toast({
              title: "Erro de localização",
              description: "Não foi possível obter sua localização. Utilizando localização padrão.",
              variant: "destructive"
            });
            
            // Use default location (São Paulo)
            setUserLocation({ lat: -23.5505, lng: -46.6333 });
          }
        );
      } else {
        setError('Geolocalização não suportada pelo navegador');
        // Use default location (São Paulo)
        setUserLocation({ lat: -23.5505, lng: -46.6333 });
      }
    } catch (error) {
      setError('Erro ao obter localização');
      console.error(error);
    }
  };

  const loadNearbyStations = async () => {
    if (!userLocation) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const params: SearchParams = {
        lat: userLocation.lat,
        lon: userLocation.lng,
        raio: filters.radius,
        combustivel: filters.fuelType,
        bandeira: filters.brand !== 'todas' ? filters.brand : null,
        ordenar: filters.sort
      };
      
      const data = await API.buscarPostosProximos(params);
      setStations(data);
    } catch (error) {
      console.error('Error loading stations:', error);
      setError('Erro ao carregar postos de combustível');
      toast({
        title: "Erro",
        description: "Não foi possível carregar os postos de combustível.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (address: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Geocode the address using Nominatim (OpenStreetMap)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          address
        )}&countrycodes=br`
      );
      
      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lon) });
        
        toast({
          title: "Localização encontrada",
          description: `Mostrando resultados para: ${address}`
        });
      } else {
        toast({
          title: "Endereço não encontrado",
          description: "Tente um endereço mais específico.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error searching address:', error);
      toast({
        title: "Erro na busca",
        description: "Não foi possível buscar o endereço informado.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = (newFilters: {
    fuelType: string;
    brand: string;
    radius: number;
    sort: string;
  }) => {
    setFilters(newFilters);
  };

  const handleStationSelect = (station: FuelStation) => {
    setSelectedStation(station);
    
    if (isMobile) {
      setShowMobileDetail(true);
    }
  };

  const renderStationList = () => {
    if (isLoading) {
      return (
        <div className="space-y-4 mt-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="text-center py-8">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <h3 className="font-bold text-lg">Erro ao carregar dados</h3>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={loadNearbyStations} className="mt-4">
            Tentar novamente
          </Button>
        </div>
      );
    }
    
    if (stations.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="text-muted-foreground text-4xl mb-4">🔍</div>
          <h3 className="font-bold text-lg">Nenhum posto encontrado</h3>
          <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
        </div>
      );
    }
    
    return (
      <div>
        <h2 className="font-bold text-lg mt-4 mb-2">Postos Próximos</h2>
        <div className="bg-yellow-50 border border-yellow-100 text-yellow-800 p-3 rounded-md mb-4 text-sm">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>Exibindo dados simulados para demonstração. Em um ambiente de produção, seriam exibidos dados reais da API.</p>
          </div>
        </div>
        <div className="space-y-3">
          {stations.map(station => (
            <StationCard
              key={station.posto}
              station={station}
              selectedFuel={filters.fuelType}
              onClick={() => handleStationSelect(station)}
              isSelected={selectedStation?.posto === station.posto}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for desktop */}
        {!isMobile && (
          <div className="w-80 p-4 bg-background border-r overflow-y-auto">
            <SearchFilters
              onSearch={handleSearch}
              onApplyFilters={handleApplyFilters}
              onGetUserLocation={getUserLocation}
            />
            
            {renderStationList()}
          </div>
        )}
        
        {/* Main content */}
        <div className="flex-1 relative">
          <MapContainer
            stations={stations}
            userLocation={userLocation}
            onStationSelect={handleStationSelect}
            selectedStation={selectedStation}
          />
          
          {/* Fixed filter button for mobile */}
          {isMobile && (
            <div className="absolute top-4 right-4 z-10">
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="icon" variant="secondary" className="shadow-lg">
                    <SlidersHorizontal className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="overflow-y-auto">
                  <SearchFilters
                    onSearch={handleSearch}
                    onApplyFilters={handleApplyFilters}
                    onGetUserLocation={getUserLocation}
                  />
                  
                  {renderStationList()}
                </SheetContent>
              </Sheet>
            </div>
          )}
          
          {/* Station detail panel on desktop */}
          {!isMobile && selectedStation && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 w-[600px] max-w-[calc(100%-2rem)] z-10">
              <StationDetail
                station={selectedStation}
                onClose={() => setSelectedStation(null)}
                isSimulated={true}
              />
            </div>
          )}
          
          {/* Station detail sheet on mobile */}
          {isMobile && selectedStation && (
            <Sheet open={showMobileDetail} onOpenChange={setShowMobileDetail}>
              <SheetContent side="bottom" className="h-[85%] overflow-y-auto p-0">
                <div className="p-4">
                  <StationDetail
                    station={selectedStation}
                    onClose={() => setShowMobileDetail(false)}
                    isSimulated={true}
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
}
