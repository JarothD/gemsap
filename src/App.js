import React, { Component } from 'react';
import { HashRouter, Route, Routes} from 'react-router-dom';
import './App.css';

import CrearCertificado from './components/pages/CrearCertificado';
import CargueMasivo from './components/pages/CargueMasivo';
import CertificarModulo from './components/pages/CertificarModulo';
import PerfilFirma from './components/pages/PerfilFirma';
import CrearCertificadoBebidas from './components/pages/CrearCertificadoBebidas';
import CargueMasivoBebidas from './components/pages/CargueMasivoBebidas';
import Carnets from './components/pages/Carnets';


class App extends Component {
  render() {
    return (
      
          <HashRouter>
        <div className="App">
          <Routes>
            <Route path='/' element={<CrearCertificado />} />
            <Route path='/carguemasivo' element={<CargueMasivo />} />            
            <Route path='/modulos' element={<CertificarModulo />} />
            <Route path='/bebidas' element={<CrearCertificadoBebidas />} />
            <Route path='/bebidasmasivo' element={<CargueMasivoBebidas />} />
            <Route path='/carnets' element={<Carnets />} />
            <Route path='/firma' element={<PerfilFirma />} />
          </Routes>
        </div>
          </HashRouter>          
      
    );
  }
}

export default App;
