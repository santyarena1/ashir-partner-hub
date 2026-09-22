/**
 * Rutas de la aplicación.
 *
 * Dos experiencias separadas: `/` es el portal del reseller y `/bo` el
 * backoffice. `/docs` es el Centro de Desarrolladores, accesible desde ambos.
 */
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ClientLayout } from '@/app/layouts/ClientLayout';
import { BackofficeLayout } from '@/app/layouts/BackofficeLayout';
import { NotFound } from '@/pages/NotFound';

/* --- portal de cliente --- */
import { ClientDashboard } from '@/pages/client/Dashboard';
import { Catalog } from '@/pages/client/Catalog';
import { ProductDetail } from '@/pages/client/ProductDetail';
import { BrandsPage } from '@/pages/client/Brands';
import { PromotionsPage } from '@/pages/client/Promotions';
import { QuickOrder } from '@/pages/client/QuickOrder';
import { CartPage } from '@/pages/client/Cart';
import { OrdersPage } from '@/pages/client/Orders';
import { OrderDetailPage } from '@/pages/client/OrderDetail';
import { BenefitsPage } from '@/pages/client/Benefits';
import { FavoritesPage } from '@/pages/client/Favorites';
import { SpecialPricePage } from '@/pages/client/SpecialPrice';
import { SpecialPriceDetailPage } from '@/pages/client/SpecialPriceDetail';
import { RmaPortal } from '@/pages/client/RmaPortal';
import { RmaLookup } from '@/pages/client/RmaLookup';
import { RmaNew } from '@/pages/client/RmaNew';
import { RmaCasePage } from '@/pages/client/RmaCase';
import { AccountPage } from '@/pages/client/Account';
import { ClientRetailPrice } from '@/pages/client/RetailPrice';

/* --- backoffice --- */
import { BoDashboard } from '@/pages/bo/Dashboard';
import { BoOrders } from '@/pages/bo/Orders';
import { BoOrderDetail } from '@/pages/bo/OrderDetail';
import { BoCustomers } from '@/pages/bo/Customers';
import { BoCustomerDetail } from '@/pages/bo/CustomerDetail';
import { BoProducts } from '@/pages/bo/Products';
import { BoBrands } from '@/pages/bo/Brands';
import { BoPriceLists } from '@/pages/bo/PriceLists';
import { BoPriceListDetail } from '@/pages/bo/PriceListDetail';
import { BoConditions } from '@/pages/bo/Conditions';
import { BoConditionDetail } from '@/pages/bo/ConditionDetail';
import { BoSpecialRequests } from '@/pages/bo/SpecialRequests';
import { BoSpecialRequestDetail } from '@/pages/bo/SpecialRequestDetail';
import { BoPartner } from '@/pages/bo/Partner';
import { PmCockpit } from '@/pages/bo/pm/Cockpit';
import { PmSimulator } from '@/pages/bo/pm/Simulator';
import { PmStock } from '@/pages/bo/pm/Stock';
import { PmPricing } from '@/pages/bo/pm/Pricing';
import { PmObjectives } from '@/pages/bo/pm/Objectives';
import { PmRetailPrice } from '@/pages/bo/pm/RetailPrice';
import { RmaCenter } from '@/pages/bo/rma/Center';
import { RmaCaseBackoffice } from '@/pages/bo/rma/CaseDetail';
import { RmaReception } from '@/pages/bo/rma/Reception';
import { RmaAnalyticsPage } from '@/pages/bo/rma/Analytics';
import { RmaLotsPage } from '@/pages/bo/rma/Lots';
import { RmaLotDetail } from '@/pages/bo/rma/LotDetail';
import { RmaPolicies } from '@/pages/bo/rma/Policies';
import { BoImports } from '@/pages/bo/Imports';
import { BoIntegrations } from '@/pages/bo/Integrations';
import { BoIntegrationDetail } from '@/pages/bo/IntegrationDetail';
import { BoNodo } from '@/pages/bo/Nodo';
import { BoWebhooks } from '@/pages/bo/Webhooks';
import { BoReports } from '@/pages/bo/Reports';
import { BoAudit } from '@/pages/bo/Audit';
import { BoSettings } from '@/pages/bo/Settings';
import { BoDemoScript } from '@/pages/bo/DemoScript';

/* --- documentación API --- */
import { DocsPage } from '@/pages/docs/Docs';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ClientLayout />,
    children: [
      { index: true, element: <ClientDashboard /> },
      { path: 'catalogo', element: <Catalog /> },
      { path: 'catalogo/:sku', element: <ProductDetail /> },
      { path: 'marcas', element: <BrandsPage /> },
      { path: 'promociones', element: <PromotionsPage /> },
      { path: 'quick-order', element: <QuickOrder /> },
      { path: 'carrito', element: <CartPage /> },
      { path: 'pedidos', element: <OrdersPage /> },
      { path: 'pedidos/:id', element: <OrderDetailPage /> },
      { path: 'beneficios', element: <BenefitsPage /> },
      { path: 'cuenta', element: <AccountPage /> },
      { path: 'pvp', element: <ClientRetailPrice /> },
      { path: 'favoritos', element: <FavoritesPage /> },
      { path: 'precio-especial', element: <SpecialPricePage /> },
      { path: 'precio-especial/:id', element: <SpecialPriceDetailPage /> },
      { path: 'rma', element: <RmaPortal /> },
      { path: 'rma/consulta', element: <RmaLookup /> },
      { path: 'rma/nuevo', element: <RmaNew /> },
      { path: 'rma/:id', element: <RmaCasePage /> },
    ],
  },
  {
    path: '/bo',
    element: <BackofficeLayout />,
    children: [
      { index: true, element: <BoDashboard /> },
      { path: 'pedidos', element: <BoOrders /> },
      { path: 'pedidos/:id', element: <BoOrderDetail /> },
      { path: 'clientes', element: <BoCustomers /> },
      { path: 'clientes/:id', element: <BoCustomerDetail /> },
      { path: 'productos', element: <BoProducts /> },
      { path: 'marcas', element: <BoBrands /> },
      { path: 'precios', element: <BoPriceLists /> },
      { path: 'precios/:id', element: <BoPriceListDetail /> },
      { path: 'condiciones', element: <BoConditions /> },
      { path: 'condiciones/:id', element: <BoConditionDetail /> },
      { path: 'promociones', element: <Navigate to="/bo/condiciones?kind=PROMOTION" replace /> },
      { path: 'solicitudes', element: <BoSpecialRequests /> },
      { path: 'solicitudes/:id', element: <BoSpecialRequestDetail /> },
      { path: 'partner', element: <BoPartner /> },
      { path: 'pm', element: <PmCockpit /> },
      { path: 'pm/simulador', element: <PmSimulator /> },
      { path: 'pm/stock', element: <PmStock /> },
      { path: 'pm/pricing', element: <PmPricing /> },
      { path: 'pm/objetivos', element: <PmObjectives /> },
      { path: 'pm/pvp', element: <PmRetailPrice /> },
      { path: 'rma', element: <RmaCenter /> },
      { path: 'rma/recepcion', element: <RmaReception /> },
      { path: 'rma/analytics', element: <RmaAnalyticsPage /> },
      { path: 'rma/lotes', element: <RmaLotsPage /> },
      { path: 'rma/lotes/:code', element: <RmaLotDetail /> },
      { path: 'rma/politicas', element: <RmaPolicies /> },
      { path: 'rma/:id', element: <RmaCaseBackoffice /> },
      { path: 'importaciones', element: <BoImports /> },
      { path: 'integraciones', element: <BoIntegrations /> },
      { path: 'integraciones/nodo', element: <BoNodo /> },
      { path: 'integraciones/:id', element: <BoIntegrationDetail /> },
      { path: 'webhooks', element: <BoWebhooks /> },
      { path: 'reportes', element: <BoReports /> },
      { path: 'auditoria', element: <BoAudit /> },
      { path: 'configuracion', element: <BoSettings /> },
      { path: 'demo', element: <BoDemoScript /> },
    ],
  },
  { path: '/docs', element: <DocsPage /> },
  { path: '/docs/:section', element: <DocsPage /> },
  { path: '*', element: <NotFound /> },
]);
