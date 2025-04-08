import React from 'react';
import { KeyboardNavigator } from './KeyboardNavigator';

export function RouteWrapper({ children }) {
  return (
    <>
      <KeyboardNavigator />
      {children}
    </>
  );
}