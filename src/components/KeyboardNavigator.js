import React from 'react';
import { useNavigate } from 'react-router-dom';

export function KeyboardNavigator() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key >= 'F1' && event.key <= 'F7') {
        event.preventDefault();
        
        const routes = {
          'F1': '/',
          'F2': '/carguemasivo',
          'F3': '/modulos',
          'F4': '/bebidas',
          'F5': '/bebidasmasivo',
          'F6': '/carnets',
          'F7': '/firma'
        };

        const route = routes[event.key];
        if (route) {
          navigate(route);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return null;
}