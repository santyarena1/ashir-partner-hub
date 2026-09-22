/**
 * Barra de asistencia comercial.
 *
 * Aparece cuando un vendedor (o un administrador) esta operando el portal
 * en nombre de un reseller: el caso de «me lo pidio por WhatsApp y se lo
 * cargo yo». Es deliberadamente intrusiva y esta siempre visible, porque
 * el riesgo real de esta funcion es olvidarse de que esta activa.
 */
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserCog } from 'lucide-react';
import { useSession } from '@/app/session';
import { useCart } from '@/app/cart';
import { Button } from '@/components/ui/primitives';
import { canActOnBehalf } from '@/lib/rbac';

export function AssistBar() {
  const { assisting, stopAssist } = useSession();
  const cart = useCart();
  const navigate = useNavigate();
  if (!assisting) return null;

  return (
    <div className="sticky top-0 z-70 border-b border-ashir-700 bg-ashir-800 text-white">
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
        <UserCog className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 text-[13px]">
          Estás operando en nombre de{' '}
          <Link
            to={`/bo/clientes/${assisting.customerId}`}
            className="font-semibold underline underline-offset-2 hover:text-white/80"
          >
            {assisting.customerName}
          </Link>
          <span className="hidden text-white/70 sm:inline">
            {' '}
            · el pedido queda a nombre del cliente y la auditoría registra que lo cargaste vos
          </span>
        </p>
        <Button
          size="sm"
          variant="outline"
          icon={<LogOut className="size-3.5" />}
          className="ml-auto border-white/40 bg-transparent text-white hover:bg-white/10"
          onClick={() => {
            // El carrito es del cliente asistido: no se arrastra a la siguiente sesion.
            cart.clear();
            stopAssist();
            navigate(`/bo/clientes/${assisting.customerId}`);
          }}
        >
          Salir de la cuenta
        </Button>
      </div>
    </div>
  );
}

/**
 * Boton para empezar a operar en nombre de un reseller. Se usa desde el
 * backoffice (listado y ficha de cliente).
 */
export function AssistButton({
  customerId,
  size = 'md',
  variant = 'outline',
  label = 'Operar en nombre del cliente',
}: {
  customerId: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'outline' | 'ghost';
  label?: string;
}) {
  const { startAssist, session } = useSession();
  const cart = useCart();
  const navigate = useNavigate();
  if (!canActOnBehalf(session)) return null;

  return (
    <Button
      size={size}
      variant={variant}
      icon={<UserCog className="size-4" />}
      onClick={() => {
        // Se entra con el carrito limpio: mezclar pedidos de dos cuentas
        // es el error mas caro que puede cometer esta pantalla.
        if (session.customerId !== customerId) cart.clear();
        startAssist(customerId);
        navigate('/');
      }}
    >
      {label}
    </Button>
  );
}
