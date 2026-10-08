import React from 'react';
import { Layers, Home, Trees, Car, BedDouble, Sofa, CookingPot, Bath, Briefcase, Baby, Warehouse, Sun, SquareSquare } from 'lucide-react';

/** Значки, которые можно выбрать для собственной зоны. */
export const ZONE_ICONS: Record<string, React.ElementType> = {
  layers: Layers,
  home: Home,
  garden: Trees,
  garage: Car,
  bedroom: BedDouble,
  living: Sofa,
  kitchen: CookingPot,
  bath: Bath,
  office: Briefcase,
  kids: Baby,
  basement: Warehouse,
  balcony: Sun,
};

export const ZoneIcon: React.FC<{ icon?: string; kind: 'room' | 'zone'; className?: string }> = ({ icon, kind, className }) => {
  const Icon = (icon && ZONE_ICONS[icon]) || (kind === 'zone' ? Layers : SquareSquare);
  return <Icon className={className} />;
};
