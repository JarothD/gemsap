import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import CrearCertificado from './components/pages/CrearCertificado';

class App extends Component {
  render() {
    return (
      <div className="App">
        <CrearCertificado />
      </div>
    );
  }
}

export default App;
