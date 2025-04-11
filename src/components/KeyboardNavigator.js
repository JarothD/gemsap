import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export function KeyboardNavigator() {
    const navigate = useNavigate();
    const location = useLocation();
    const lastNavigationTime = React.useRef(0);
    const THROTTLE_TIME = 30; // milliseconds

    React.useEffect(() => {
        const routes = {
            'F1': '/',
            'F2': '/carguemasivo',
            'F3': '/modulos',
            'F4': '/bebidas',
            'F5': '/bebidasmasivo',
            'F6': '/carnets',
            'F7': '/firma'
        };

        const handleKeyDown = (event) => {
            if (event.key >= 'F1' && event.key <= 'F7') {
                event.preventDefault();
                
                const currentTime = Date.now();
                if (currentTime - lastNavigationTime.current < THROTTLE_TIME) {
                    return; // Ignorar navegaciones muy rápidas
                }

                const route = routes[event.key];
                if (route && location.pathname !== route) {
                    lastNavigationTime.current = currentTime;
                    navigate(route);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [navigate, location]);

    return null;
}