import React, {useContext} from 'react';
import {ANALYSES, COPIES, Variant} from './data';

export const VariantContext = React.createContext<Variant>('original');
export const useVariant = () => useContext(VariantContext);
export const useCopy = () => COPIES[useContext(VariantContext)];
export const useAnalysis = () => ANALYSES[useContext(VariantContext)];
