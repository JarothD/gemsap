import React, { useEffect, useRef } from 'react';
import User from '../../assets/user.svg';
import Module from '../../assets/module.svg';
import Signature from '../../assets/signature.svg';
import UserGroup from '../../assets/usergroup.svg';
import Champagne from '../../assets/champagne-glasses.svg';
import Identification from '../../assets/id-card.svg';
import Martini from '../../assets/martini-glass.svg';
import { ReactSVG } from 'react-svg';
import { Link, useLocation } from 'react-router-dom';

const NavMenu = ({ actualPage }) => {
  const containerRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    // Restore scroll position from sessionStorage
    const savedPosition = sessionStorage.getItem('scrollPosition');
    if (savedPosition) {
      containerRef.current.scrollTo(parseInt(savedPosition, 10), 0);
    }
  }, [location.pathname]);

  const handleLinkClick = (path) => {
    // Save current scroll position to sessionStorage
    sessionStorage.setItem('scrollPosition', containerRef.current.scrollLeft);
  };

  return (
    <div id="buttons-container" ref={containerRef} style={{ overflowX: 'scroll', whiteSpace: 'nowrap' }}>
      {actualPage !== 'CertificarAlimentos' && (
        <Link to="/" onClick={() => handleLinkClick('/')}>
          <ReactSVG id="logo-principal" src={User} alt="User" />
        </Link>
      )}
      {actualPage !== 'AlimentosMasivo' && (
        <Link to="/carguemasivo" onClick={() => handleLinkClick('/carguemasivo')}>
          <ReactSVG id="logo-principal" src={UserGroup} alt="UserGroup" />
        </Link>
      )}
      {actualPage !== 'CertificarModulo' && (
        <Link to="/modulos" onClick={() => handleLinkClick('/modulos')}>
          <ReactSVG id="logo-principal" src={Module} alt="Module" />
        </Link>
      )}
      {actualPage !== 'bebidas' && (
        <Link to="/bebidas" onClick={() => handleLinkClick('/bebidas')}>
          <ReactSVG id="logo-principal" src={Martini} alt="Martini" />
        </Link>
      )}
      {actualPage !== 'BebidasMasivo' && (
        <Link to="/bebidasmasivo" onClick={() => handleLinkClick('/bebidasmasivo')}>
          <ReactSVG id="logo-principal" src={Champagne} alt="Champagne" />
        </Link>
      )}
      {actualPage !== 'Carnets' && (
        <Link to="/carnets" onClick={() => handleLinkClick('/carnets')}>
          <ReactSVG id="logo-principal" src={Identification} alt="Identification" />
        </Link>
      )}
      {actualPage !== 'Firmas' && (
        <Link to="/firma" onClick={() => handleLinkClick('/firma')}>
          <ReactSVG id="logo-principal" src={Signature} alt="Signature" />
        </Link>
      )}
    </div>
  );
};

export default NavMenu;
