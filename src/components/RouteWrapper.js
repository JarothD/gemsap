import React from 'react';
import { KeyboardNavigator } from './KeyboardNavigator';

export const RouteWrapper = ({ children }) => {
  return (
    <>
      <KeyboardNavigator />
      {children}
    </>
  );
};