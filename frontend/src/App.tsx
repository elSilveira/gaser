
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Import Leaflet CSS globally
import "leaflet/dist/leaflet.css";

// Add FontAwesome for map markers
const fontAwesomeLink = document.createElement('link');
fontAwesomeLink.rel = 'stylesheet';
fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
document.head.appendChild(fontAwesomeLink);

// Add MarkerCluster CSS
const addMarkerClusterCSS = () => {
  const markerClusterLink = document.createElement('link');
  markerClusterLink.rel = 'stylesheet';
  markerClusterLink.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css';
  document.head.appendChild(markerClusterLink);

  const markerClusterDefaultLink = document.createElement('link');
  markerClusterDefaultLink.rel = 'stylesheet';
  markerClusterDefaultLink.href = 'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css';
  document.head.appendChild(markerClusterDefaultLink);
};

// Add CSS after component mounts
if (typeof window !== 'undefined') {
  addMarkerClusterCSS();
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
