
import { Fuel } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-primary text-white p-4 shadow-md">
      <div className="container mx-auto flex items-center">
        <div className="flex items-center gap-2">
          <Fuel className="h-6 w-6 text-secondary" />
          <h1 className="text-xl font-bold">Mapa de Postos de Combustíveis</h1>
        </div>
      </div>
    </header>
  );
}
