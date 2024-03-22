import React, { Component } from 'react';
import './App.css';

import { HashRouter, Route, Routes} from 'react-router-dom';

import CrearCertificado from './components/pages/CrearCertificado';
import CargueMasivo from './components/pages/CargueMasivo';
import CertificarModulo from './components/pages/CertificarModulo';
import PerfilFirma from './components/pages/PerfilFirma';


class App extends Component {
  render() {
    return (
      
          <HashRouter>
        <div className="App">
          <Routes>
            <Route path='/' element={<CrearCertificado />} />
            <Route path='/carguemasivo' element={<CargueMasivo />} />            
            <Route path='/modulos' element={<CertificarModulo />} />
            <Route path='/firma' element={<PerfilFirma />} />
          </Routes>
        </div>
          </HashRouter>          
      
    );
  }
}

export default App;
