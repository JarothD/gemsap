import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './App.css';
import ErrorBoundary from './components/ErrorBoundary';
import { KeyboardNavigator } from './components/KeyboardNavigator';

import { RouteWrapper } from './components/RouteWrapper';
import CrearCertificado from './components/pages/CrearCertificado';
import CargueMasivo from './components/pages/CargueMasivo';
import CertificarModulo from './components/pages/CertificarModulo';
import PerfilFirma from './components/pages/PerfilFirma';
import CrearCertificadoBebidas from './components/pages/CrearCertificadoBebidas';
import CargueMasivoBebidas from './components/pages/CargueMasivoBebidas';
import Carnets from './components/pages/Carnets';

const router = createHashRouter([
  {
    path: '/',
    element: (
      <RouteWrapper>
        <CrearCertificado />
      </RouteWrapper>
    ),
  },
  {
    path: '/carguemasivo',
    element: (
      <RouteWrapper>
        <CargueMasivo />
      </RouteWrapper>
    ),
  },
  {
    path: '/modulos',
    element: (
      <RouteWrapper>
        <CertificarModulo />
      </RouteWrapper>
    ),
  },
  {
    path: '/bebidas',
    element: (
      <RouteWrapper>
        <CrearCertificadoBebidas />
      </RouteWrapper>
    ),
  },
  {
    path: '/bebidasmasivo',
    element: (
      <RouteWrapper>
        <CargueMasivoBebidas />
      </RouteWrapper>
    ),
  },
  {
    path: '/carnets',
    element: (
      <RouteWrapper>
        <Carnets />
      </RouteWrapper>
    ),
  },
  {
    path: '/firma',
    element: (
      <RouteWrapper>
        <PerfilFirma />
      </RouteWrapper>
    ),
  }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  },
  errorElement: <ErrorBoundary />
});

function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

export default App;
