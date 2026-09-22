/**
 * Favoritos del reseller. Se guardan en el navegador.
 */
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/app/cart';
import { productById } from '@/mocks/fixtures/catalog';
import { Button, Card } from '@/components/ui/primitives';
import { EmptyState, PageHeader } from '@/components/ui/data';
import { ProductCard } from '@/components/domain/product-card';

export function FavoritesPage() {
  const { favorites } = useFavorites();
  const products = favorites.map((id) => productById(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div>
      <PageHeader
        title="Favoritos"
        subtitle="Los productos que guardaste para tener a mano. Se almacenan en este navegador; en producción viajarían con tu cuenta."
      />

      {products.length === 0 ? (
        <Card>
          <EmptyState
            title="Todavía no guardaste favoritos"
            description="Usá el corazón de cada producto para armar tu lista de reposición habitual."
            icon={<Heart className="size-5" />}
            action={
              <Link to="/catalogo">
                <Button>Ir al catálogo</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
