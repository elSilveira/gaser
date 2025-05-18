
import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer as LeafletMapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { FuelStation } from '@/types';
import { useToast } from '@/components/ui/use-toast';
import MarkerClusterGroup from 'react-leaflet-cluster';

// Custom component to recenter map when user location changes
import MapController from '@/components/MapController';

// Need these imports for Leaflet to work properly
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

interface MapContainerProps {
  stations: FuelStation[];
  userLocation: { lat: number; lng: number } | null;
  onStationSelect: (station: FuelStation) => void;
  selectedStation: FuelStation | null;
}

export default function MapContainer({ 
  stations, 
  userLocation, 
  onStationSelect,
  selectedStation
}: MapContainerProps) {
  const { toast } = useToast();
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);

  // Create custom icons for different brands
  const createStationIcon = (station: FuelStation) => {
    let color = '#ff6600'; // Default color
    
    if (station.bandeira === 'Petrobras') color = '#00A335';
    if (station.bandeira === 'Shell') color = '#FFCC00';
    if (station.bandeira === 'Ipiranga') color = '#0066B3';
    
    return L.divIcon({
      className: 'posto-marker',
      html: `<div style="background-color: ${color}"><i class="fas fa-gas-pump"></i></div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  };

  const userIcon = L.divIcon({
    className: 'user-marker',
    html: '<i class="fas fa-user-circle"></i>',
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });

  useEffect(() => {
    // When stations change, fly to selected station if it exists
    if (selectedStation && clusterGroupRef.current) {
      const latLng = L.latLng(selectedStation.latitude, selectedStation.longitude);
      clusterGroupRef.current._map.flyTo(latLng, 15);
    }
  }, [selectedStation]);

  return (
    <div className="relative h-full w-full">
      <LeafletMapContainer 
        style={{ height: '100%', width: '100%' }}
        className="z-0 rounded-md"
        center={userLocation ? [userLocation.lat, userLocation.lng] : [-23.5505, -46.6333]}
        zoom={13}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {userLocation && (
          <MapController center={userLocation} />
        )}
        
        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={userIcon}
          >
            <Popup>Sua localização</Popup>
          </Marker>
        )}
        
        <MarkerClusterGroup
          chunkedLoading
        >
          {stations.map((station) => (
            <Marker
              key={station.posto}
              position={[station.latitude, station.longitude]}
              icon={createStationIcon(station)}
              eventHandlers={{
                click: () => {
                  onStationSelect(station);
                }
              }}
            >
              <Popup>
                <div className="font-medium">{station.nome}</div>
                <div className="text-sm">{station.bandeira}</div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </LeafletMapContainer>
    </div>
  );
}
