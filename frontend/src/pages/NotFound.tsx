
import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { GasPump } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-4">
        <div className="mb-6">
          <GasPump className="h-20 w-20 text-primary mx-auto" />
        </div>
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-6">
          Oops! Esta página não foi encontrada
        </p>
        <Button asChild>
          <Link to="/">Voltar para o Mapa</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
