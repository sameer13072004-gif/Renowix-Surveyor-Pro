import { ServiceCategory } from './types';

export const SERVICE_DATA: Record<string, ServiceCategory> = {
  painting: {
    id: 'painting',
    name: "Home Painting",
    unit: "sqft",
    items: [
      { id: "royale_putty", name: "Royale Luxury Emulsion (W/ Putty & Primer)", rate: 31.80, desc: "Ultimate luxury with a flawless, soft-sheen finish. Includes Birla Putty leveling and Primer." },
      { id: "royale_paint", name: "Royale Luxury Emulsion (Paint Only)", rate: 20.00, desc: "Premium, washable, soft-sheen coat applied over existing surfaces." },
      { id: "apcolite_putty", name: "Apcolite Premium Emulsion (W/ Putty & Primer)", rate: 27.00, desc: "Rich, high-performance matte finish. Includes comprehensive surface preparation." },
      { id: "apcolite_paint", name: "Apcolite Premium Emulsion (Paint Only)", rate: 15.20, desc: "High-quality durable matte emulsion for prepared walls." },
      { id: "tractor_putty", name: "Tractor Emulsion (W/ Putty & Primer)", rate: 24.60, desc: "Bright, clean, smooth finish on a budget." },
      { id: "tractor_paint", name: "Tractor Emulsion (Paint Only)", rate: 12.80, desc: "Fresh, economical topcoat providing great coverage." }
    ]
  },
  woodwork: {
    id: 'woodwork',
    name: "Wood Work & Fabrication",
    unit: "sqft",
    items: [
      { id: "kitchen_mod", name: "Premium Modular Kitchen", rate: 1400.00, type: "kitchen", desc: "Custom-designed modular kitchens using Century HDHMR and soft-close hardware." },
      { id: "wardrobe", name: "Custom Wardrobe & Almirah", rate: 1400.00, desc: "Heavy-duty bespoke storage units constructed using Century HDHMR core." },
      { id: "tv_unit", name: "Modern TV Unit & Panel", rate: 1100.00, desc: "Sleek, custom-designed entertainment units." },
      { id: "wood_floor", name: "Premium Wooden Flooring", rate: 120.00, desc: "Supply of scratch-resistant, high-grade wooden flooring." },
      { id: "door_panel", name: "Decorative Door Panelling", rate: 350.00, unit: "rft", desc: "Custom-fabricated panelling around door frames." }
    ]
  },
  custom: {
    id: 'custom',
    name: "Custom Service",
    unit: "unit",
    items: [
      { id: "custom_item", name: "Custom Service Item", rate: 0, type: "custom", desc: "Custom defined service." }
    ]
  }
};

export const DEFAULT_TERMS = `1. Validity: 15 days from date of issue.
2. Payment: 50% Advance, 40% WIP, 10% Completion.
3. Water & Electricity to be provided by client.
4. GST Extra if applicable.
5. All measurements are approximate until final verification.`;