
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

interface MapControllerProps {
  center: { lat: number; lng: number } | null;
}

export default function MapController({ center }: MapControllerProps) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      map.flyTo([center.lat, center.lng], 14);
    }
  }, [center, map]);
  
  return null;
}
