import React, { Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

export const RouteWrapper = ({ children }) => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div>Cargando...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
};