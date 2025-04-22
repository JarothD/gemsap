import React, { useEffect, useRef, useState, useLayoutEffect } from 'react';
import { ReactSVG } from 'react-svg';
import { Link, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';

import User from '../../assets/user.svg';
import Module from '../../assets/module.svg';
import Signature from '../../assets/signature.svg';
import UserGroup from '../../assets/usergroup.svg';
import Champagne from '../../assets/champagne-glasses.svg';
import Identification from '../../assets/id-card.svg';
import Martini from '../../assets/martini-glass.svg';

const NavMenu = ({ actualPage = '' }) => {
  const containerRef = useRef(null);
  const location = useLocation();
  const [isVertical, setIsVertical] = useState(false);
  const [isInitialRender, setIsInitialRender] = useState(true);

  // Detectar cambios en el tamaño de la ventana para determinar si estamos en modo vertical
  useEffect(() => {
    const checkLayout = () => {
      const vertical = window.innerHeight <= 500 && window.innerHeight >= 200;
      setIsVertical(vertical);
    };

    // Comprobar inicialmente
    checkLayout();

    // Añadir listener para redimensionar
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  // Posicionar inmediatamente sin animación durante la carga inicial
  useLayoutEffect(() => {
    if (!containerRef.current || !actualPage) return;
    
    const container = containerRef.current;
    const activeButton = container.querySelector(`[data-page="${actualPage}"]`);
    
    if (!activeButton) return;
    
    try {
      const containerRect = container.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      
      if (isVertical) {
        // Posicionamiento vertical inicial (sin animación)
        const offsetY = buttonRect.top - containerRect.top - (containerRect.height / 2) + (buttonRect.height / 2);
        container.scrollTop = container.scrollTop + offsetY;
      } else {
        // Posicionamiento horizontal inicial (sin animación)
        const offsetX = buttonRect.left - containerRect.left - (containerRect.width / 2) + (buttonRect.width / 2);
        container.scrollLeft = container.scrollLeft + offsetX;
      }
    } catch (error) {
      console.error('Error al posicionar inicialmente:', error);
    }
    
    // Después de la primera renderización, permitir animaciones
    setIsInitialRender(false);
  }, [isVertical, actualPage]);

  // Efecto para manejar la posición del scroll en cambios de página/modo
  useEffect(() => {
    if (!containerRef.current || isInitialRender) return;

    // Guardar referencia para evitar problemas de cierre
    const container = containerRef.current;

    if (isVertical) {
      // Lógica para modo vertical
      const activeButton = container.querySelector(`[data-page="${actualPage}"]`);
      if (activeButton) {
        setTimeout(() => {
          try {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = activeButton.getBoundingClientRect();
            
            // Calcular posición para centrar verticalmente
            const offsetY = buttonRect.top - containerRect.top - (containerRect.height / 2) + (buttonRect.height / 2);
            
            container.scrollTo({
              top: container.scrollTop + offsetY,
              behavior: 'smooth'
            });
          } catch (error) {
            console.error('Error al calcular posición vertical:', error);
          }
        }, 50);
      }
    } else {
      // Lógica para modo horizontal
      const activeButton = container.querySelector(`[data-page="${actualPage}"]`);
      
      if (actualPage && activeButton) {
        // Si hay una página activa, desplazarse al botón correspondiente
        setTimeout(() => {
          try {
            const containerRect = container.getBoundingClientRect();
            const buttonRect = activeButton.getBoundingClientRect();
            
            // Calcular posición para centrar horizontalmente
            const offsetX = buttonRect.left - containerRect.left - (containerRect.width / 2) + (buttonRect.width / 2);
            
            container.scrollTo({
              left: container.scrollLeft + offsetX,
              behavior: 'smooth'
            });
          } catch (error) {
            console.error('Error al calcular posición horizontal:', error);
          }
        }, 50);
      } else {
        // Si no hay página activa o cambió la ruta, restaurar posición guardada
        const savedPosition = sessionStorage.getItem('scrollPosition');
        if (savedPosition) {
          container.scrollLeft = parseInt(savedPosition, 10);
        }
      }
    }
  }, [actualPage, location.pathname, isVertical, isInitialRender]);

  // Guardar la posición del scroll al hacer clic en un enlace
  const handleLinkClick = () => {
    if (containerRef.current && !isVertical) {
      const scrollLeft = containerRef.current.scrollLeft;
      sessionStorage.setItem('scrollPosition', scrollLeft);
    }
  };

  // Estilos para el botón seleccionado
  const selectedStyle = {
    filter: 'invert(100%) saturate(1492%) hue-rotate(187deg) brightness(100%) contrast(100%)', // Cambia a color blanco   
    transition: 'all 0.3s ease'
  };

  return (
    <div id="buttons-container" ref={containerRef} tabIndex="-1">
      <Link to="/" onClick={handleLinkClick} tabIndex="-1" data-page="CertificarAlimentos">
        <ReactSVG 
          id="logo-principal" 
          src={User} 
          alt="User" 
          tabIndex="-1"
          style={actualPage === 'CertificarAlimentos' ? selectedStyle : {}}
        />
      </Link>
      <Link to="/carguemasivo" onClick={handleLinkClick} tabIndex="-1" data-page="AlimentosMasivo">
        <ReactSVG 
          id="logo-principal" 
          src={UserGroup} 
          alt="UserGroup" 
          tabIndex="-1"
          style={actualPage === 'AlimentosMasivo' ? selectedStyle : {}}
        />
      </Link>
      <Link to="/modulos" onClick={handleLinkClick} tabIndex="-1" data-page="CertificarModulo">
        <ReactSVG 
          id="logo-principal" 
          src={Module} 
          alt="Module" 
          tabIndex="-1"
          style={actualPage === 'CertificarModulo' ? selectedStyle : {}}
        />
      </Link>
      <Link to="/bebidas" onClick={handleLinkClick} tabIndex="-1" data-page="bebidas">
        <ReactSVG 
          id="logo-principal" 
          src={Martini} 
          alt="Martini" 
          tabIndex="-1"
          style={actualPage === 'bebidas' ? selectedStyle : {}}
        />
      </Link>
      <Link to="/bebidasmasivo" onClick={handleLinkClick} tabIndex="-1" data-page="BebidasMasivo">
        <ReactSVG 
          id="logo-principal" 
          src={Champagne} 
          alt="Champagne" 
          tabIndex="-1"
          style={actualPage === 'BebidasMasivo' ? selectedStyle : {}}
        />
      </Link>
      <Link to="/carnets" onClick={handleLinkClick} tabIndex="-1" data-page="Carnets">
        <ReactSVG 
          id="logo-principal" 
          src={Identification} 
          alt="Identification" 
          tabIndex="-1"
          style={actualPage === 'Carnets' ? selectedStyle : {}}
        />
      </Link>
      <Link to="/firma" onClick={handleLinkClick} tabIndex="-1" data-page="Firmas">
        <ReactSVG 
          id="logo-principal" 
          src={Signature} 
          alt="Signature" 
          tabIndex="-1"
          style={actualPage === 'Firmas' ? selectedStyle : {}}
        />
      </Link>
    </div>
  );
};

// Mantener solo PropTypes para validación
NavMenu.propTypes = {
  actualPage: PropTypes.string
};

export default NavMenu;
