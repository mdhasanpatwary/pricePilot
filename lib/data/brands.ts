export const TECH_BRANDS: Record<string, { aliases: string[]; category: string }> = {
  // Major Electronics
  'samsung': { aliases: ['samsung', 'samsung electronics', 'galaxy'], category: 'electronics' },
  'apple': { aliases: ['apple', 'apple inc', 'iphone', 'ipad', 'macbook', 'mac', 'airpods'], category: 'electronics' },
  'sony': { aliases: ['sony', 'bravia', 'playstation'], category: 'electronics' },
  'lg': { aliases: ['lg', 'lg electronics'], category: 'electronics' },

  // Computers & Laptops
  'dell': { aliases: ['dell', 'alienware', 'xps', 'inspiron', 'latitude'], category: 'computers' },
  'hp': { aliases: ['hp', 'hewlett-packard', 'omen', 'pavilion', 'envy', 'probook', 'elitebook'], category: 'computers' },
  'lenovo': { aliases: ['lenovo', 'thinkpad', 'ideapad', 'yoga', 'legion'], category: 'computers' },
  'asus': { aliases: ['asus', 'rog', 'tuf', 'vivobook', 'zenbook', 'prime'], category: 'computers' },
  'acer': { aliases: ['acer', 'predator', 'aspire', 'swift', 'nitro'], category: 'computers' },
  'msi': { aliases: ['msi', 'micro-star'], category: 'computers' },
  'gigabyte': { aliases: ['gigabyte', 'aorus', 'aero'], category: 'computers' },
  'microsoft': { aliases: ['microsoft', 'surface'], category: 'computers' },
  'razer': { aliases: ['razer', 'blade'], category: 'computers' },

  // Components (CPU, GPU, Motherboard)
  'intel': { aliases: ['intel', 'core', 'i3', 'i5', 'i7', 'i9', 'xeon'], category: 'components' },
  'amd': { aliases: ['amd', 'ryzen', 'radeon', 'epyc'], category: 'components' },
  'nvidia': { aliases: ['nvidia', 'geforce', 'rtx', 'gtx'], category: 'components' },
  'corsair': { aliases: ['corsair', 'vengeance', 'dominator'], category: 'components' },
  'kingston': { aliases: ['kingston', 'fury'], category: 'components' },
  'adata': { aliases: ['adata', 'xpg'], category: 'components' },
  'western_digital': { aliases: ['wd', 'western digital'], category: 'components' },
  'seagate': { aliases: ['seagate', 'barracuda'], category: 'components' },
  'team': { aliases: ['team', 't-force'], category: 'components' },
  'g_skill': { aliases: ['g.skill', 'trident'], category: 'components' },
  'sapphire': { aliases: ['sapphire', 'pulse', 'nitro+'], category: 'components' },
  'zotac': { aliases: ['zotac'], category: 'components' },
  'asrock': { aliases: ['asrock'], category: 'components' },
  
  // Peripherals & Accessories
  'logitech': { aliases: ['logitech', 'logi'], category: 'accessories' },
  'a4tech': { aliases: ['a4tech', 'bloody'], category: 'accessories' },
  'fantech': { aliases: ['fantech'], category: 'accessories' },
  'xtreme': { aliases: ['xtreme'], category: 'accessories' },
  'havit': { aliases: ['havit'], category: 'accessories' },
  'gamdias': { aliases: ['gamdias'], category: 'accessories' },
  'valtop': { aliases: ['valtop'], category: 'accessories' },
  'tp-link': { aliases: ['tp-link', 'tplink', 'deco', 'archer'], category: 'networking' },
  'd-link': { aliases: ['d-link', 'dlink'], category: 'networking' },
  'tenda': { aliases: ['tenda'], category: 'networking' },
  'mikrotik': { aliases: ['mikrotik'], category: 'networking' },
  'cisco': { aliases: ['cisco'], category: 'networking' },
  'ubiquiti': { aliases: ['ubiquiti', 'unifi'], category: 'networking' },

  // Printers
  'canon': { aliases: ['canon', 'pixma'], category: 'office' },
  'epson': { aliases: ['epson', 'ecotank'], category: 'office' },
  'brother': { aliases: ['brother'], category: 'office' },
};

export function normalizeBrand(brand: string): string {
  if (!brand) return '';
  const normalized = brand.toLowerCase().trim();
  for (const [canonical, data] of Object.entries(TECH_BRANDS)) {
    if (data.aliases.some(alias => normalized === alias || normalized.includes(` ${alias} `))) {
      return canonical;
    }
  }
  return normalized;
}
