
import { ServiceCategory } from './types';

export const SERVICE_DATA: Record<string, ServiceCategory> = {
  painting: {
    id: 'painting',
    name: "Home Painting",
    unit: "sqft",
    items: [
      { id: "royale_putty", name: "Royale Luxury Emulsion (W/ Putty & Primer)", rate: 31.80, desc: "Experience ultimate luxury with a mirror-smooth, soft-sheen finish. Includes 2 coats of Birla Putty and 1 coat of Primer for flawless leveling. Enriched with Teflon™ for high washability, stain resistance, and 99% anti-bacterial protection." },
      { id: "royale_paint", name: "Royale Luxury Emulsion (Paint Only)", rate: 20.00, desc: "A premium, soft-sheen topcoat for pre-prepared walls. This Teflon™-fortified paint offers unmatched durability, superior washability, and an anti-bacterial shield. Perfect for adding an elegant, long-lasting glow to your luxury interiors." },
      { id: "apcolite_putty", name: "Apcolite Premium Emulsion (W/ Putty & Primer)", rate: 27.00, desc: "A sophisticated Rich Matte finish with comprehensive preparation. Includes 2 coats of Putty and 1 coat of Primer to ensure a smooth, durable base. Features Stain Guard technology and anti-fungal protection for vibrant, easy-to-clean walls." },
      { id: "apcolite_paint", name: "Apcolite Premium Emulsion (Paint Only)", rate: 15.20, desc: "Our heavy-duty, Rich Matte topcoat for professionally prepped walls. This high-performance emulsion provides excellent coverage, a persistent anti-fungal shield, and advanced Stain Guard for long-lasting, elegant beauty." },
      { id: "tractor_putty", name: "Tractor Emulsion (W/ Putty & Primer)", rate: 24.60, desc: "The smart upgrade to a clean, Smooth Matte finish. Includes 2 coats of Putty and 1 coat of Primer for a level surface at an affordable price. Offers 1.5x more coverage than distemper with enhanced durability and lead-free safety." },
      { id: "tractor_paint", name: "Tractor Emulsion (Paint Only)", rate: 12.80, desc: "An economical, Smooth Matte topcoat that beautifies on a budget. Perfect for a fresh look, it provides superior coverage over distemper and maintains color vibrancy with anti-fade technology for years of reliable performance." }
    ]
  },
  woodwork: {
    id: 'woodwork',
    name: "Wood Work & Fabrication",
    unit: "sqft",
    items: [
      { id: "kitchen_mod", name: "Premium Modular Kitchen", rate: 1400.00, type: "kitchen", desc: "Elevate your culinary space with a high-performance modular kitchen. We use water & termite-proof HDHMR boards and luxury laminates from Century/Marino. Featuring Hettich/Godrej soft-close fittings and skilled precision, we deliver a sophisticated, durable kitchen on time." },
      { id: "wardrobe", name: "Custom Wardrobe & Almirah", rate: 1400.00, desc: "Bespoke storage solutions built for longevity. Our wardrobes use heavy-duty HDHMR carcasses and premium Virgo/Century laminates bonded with Fevicol Heatex. Equipped with high-end hardware and integrated light provisions, we ensure a smooth, elegant, and perfectly finished product." },
      { id: "tv_unit", name: "Modern TV Unit & Panel", rate: 1100.00, desc: "Transform your living area with a sleek, designer TV unit. Crafted from durable HDHMR with high-gloss or matte Marino/Virgo laminates, our units feature concealed wiring and strip-light provisions. Experience a professional, modern finish that makes your TV wall a luxury focal point." },
      { id: "wood_floor", name: "Premium Wooden Flooring", rate: 120.00, desc: "Add timeless warmth to your home with our high-grade wooden flooring. We use commonly preferred, durable hardwoods featuring authentic grains and a refined finish. Our professional installation ensures a smooth, resilient, and elegant surface that enhances your property’s value." },
      { id: "door_panel", name: "Decorative Door Panelling", rate: 350.00, unit: "rft", desc: "Upgrade your entryways with sophisticated door frame paneling. We use termite-proof HDHMR boards and premium Century/Marino laminates for a near-factory finish. Meticulous strip cuttings for lighting add a modern touch, ensuring a professional and durable luxury appearance." }
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
