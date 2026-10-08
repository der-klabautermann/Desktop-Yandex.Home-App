import React from 'react';
import {
  Layers, Home, Trees, Car, BedDouble, Sofa, CookingPot, Bath, Briefcase, Baby, Warehouse, Sun, SquareSquare,
  UtensilsCrossed, DoorOpen, WashingMachine, Wrench, Dumbbell, Flame, Tv, Gamepad2, BookOpen, Shirt,
} from 'lucide-react';

/** Значки для комнат и зон. Ключи хранятся в zones.json, поэтому их не переименовываем. */
export const ZONE_ICONS: Record<string, React.ElementType> = {
  room: SquareSquare,
  layers: Layers,
  home: Home,
  living: Sofa,
  kitchen: CookingPot,
  dining: UtensilsCrossed,
  bedroom: BedDouble,
  kids: Baby,
  bath: Bath,
  office: Briefcase,
  hall: DoorOpen,
  wardrobe: Shirt,
  library: BookOpen,
  media: Tv,
  games: Gamepad2,
  gym: Dumbbell,
  sauna: Flame,
  laundry: WashingMachine,
  workshop: Wrench,
  basement: Warehouse,
  garage: Car,
  garden: Trees,
  balcony: Sun,
};

export const ZoneIcon: React.FC<{ icon?: string; kind: 'room' | 'zone'; className?: string }> = ({ icon, kind, className }) => {
  const Icon = (icon && ZONE_ICONS[icon]) || (kind === 'zone' ? Layers : SquareSquare);
  return <Icon className={className} />;
};
