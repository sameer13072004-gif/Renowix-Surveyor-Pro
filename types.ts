
export type UnitType = 'sqft' | 'rft' | 'unit';

export interface Wall {
  id: string;
  width: number;
}

export interface CeilingSection {
  id: string;
  l: number;
  b: number;
}

export interface Deduction {
  id: string;
  type: string;
  area: number;
  qty: number;
}

export interface MeasurementItem {
  id: string;
  name: string; // Room Name
  netArea: number; // Final quantity calculated
  rate: number; // Editable rate
  cost: number; // netArea * rate
  
  // Specific Details
  height?: number;
  walls?: Wall[];
  ceilings?: CeilingSection[];
  deductions?: Deduction[];
  
  // Woodwork / Custom dimensions
  l?: number;
  b?: number;
  q?: number;
  
  remarks?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  items: ServiceTypeDef[];
  unit?: UnitType;
}

export interface ServiceTypeDef {
  id: string;
  name: string;
  rate: number;
  desc: string;
  type?: 'kitchen' | 'custom' | 'standard';
  unit?: UnitType;
}

// The structure for a selected service instance in the project
export interface ActiveService {
  instanceId: string;
  categoryId: string;
  typeId: string;
  name: string;
  desc: string;
  unit: UnitType;
  items: MeasurementItem[];
  isKitchen?: boolean;
  isCustom?: boolean;
  rate?: number;
}

export interface ClientDetails {
  name: string;
  address: string;
}

export interface Project {
  id: string;
  date: string;
  client: ClientDetails;
  services: ActiveService[];
  terms: string;
}

export interface User {
  email: string;
  name: string;
  role: 'admin' | 'surveyor';
  expiryDate: string; // ISO Date string
}

export type PageView = 
  |