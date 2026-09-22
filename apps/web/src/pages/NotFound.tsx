import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, Card } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/data';
import { AshirLogo } from '@/components/domain/logo';

export function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-4">
      <AshirLogo className="mb-6 h-8" tone="dark" />
      <Card className="w-full max-w-lg">
        <EmptyState
          title="No encontramos esta pantalla"
          description="La dirección no corresponde a ninguna sección del portal. Puede ser un enlace viejo o un error de tipeo."
          icon={<Compass className="size-5" />}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/">
                <Button>Ir al portal de cliente</Button>
              </Link>
              <Link to="/bo">
                <Button variant="outline">Ir al backoffice</Button>
              </Link>
            </div>
          }
        />
      </Card>
    </div>
  );
}
