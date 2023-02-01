import React, { Component } from 'react';
import './App.css';

import { HashRouter, Route, Routes} from 'react-router-dom';

import CrearCertificado from './components/pages/CrearCertificado';
import CargueMasivo from './components/pages/CargueMasivo';

class App extends Component {
  render() {
    return (
      
          <HashRouter>
        <div className="App">
          <Routes>
            <Route path='/' element={<CrearCertificado />} />
            <Route path='/carguemasivo' element={<CargueMasivo />} />            
          </Routes>
        </div>
          </HashRouter>          
      
    );
  }
}

export default App;
