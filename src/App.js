import React from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './App.css';

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
    element: <CrearCertificado />,
  },
  {
    path: '/carguemasivo',
    element: <CargueMasivo />,
  },
  {
    path: '/modulos',
    element: <CertificarModulo />,
  },
  {
    path: '/bebidas',
    element: <CrearCertificadoBebidas />,
  },
  {
    path: '/bebidasmasivo',
    element: <CargueMasivoBebidas />,
  },
  {
    path: '/carnets',
    element: <Carnets />,
  },
  {
    path: '/firma',
    element: <PerfilFirma />,
  }
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true
  }
});

function App() {
  return <RouterProvider router={router} />;
}

export default App;
