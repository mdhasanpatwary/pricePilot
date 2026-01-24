
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  score: number;
}

export class TechProductValidator {
  static validateProduct(product: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic fields
    if (!product.title || product.title.length < 5) {
      errors.push('Title is too short or missing');
    }

    if (product.price === undefined || product.price === null || product.price < 0) {
      errors.push('Invalid price');
    }

    // Tech specs validation
    const specs = product.specifications || {};
    
    // RAM Validation
    if (specs.ram) {
      if (!this.validateSpecification('ram', specs.ram)) {
        warnings.push(`Invalid RAM format: ${specs.ram}`);
      }
    }

    // Storage Validation
    if (specs.storage) {
      if (!this.validateSpecification('storage', specs.storage)) {
        warnings.push(`Invalid Storage format: ${specs.storage}`);
      }
    }

    // Logic to suggest missing important specs based on category (heuristic)
    const titleLower = product.title.toLowerCase();
    if (titleLower.includes('laptop') || titleLower.includes('desktop') || titleLower.includes('notebook')) {
        if (!specs.ram) warnings.push('Missing RAM specification for computer');
        if (!specs.storage) warnings.push('Missing Storage specification for computer');
        if (!specs.processor) warnings.push('Missing Processor specification for computer');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, 100 - (errors.length * 20) - (warnings.length * 5))
    };
  }

  static validateSpecification(key: string, value: string): boolean {
    const patterns: Record<string, RegExp> = {
      ram: /^\d{1,3}\s*GB$/i, // e.g., "16GB", "8 GB"
      storage: /^\d{1,4}\s*(GB|TB|MB)\s*(SSD|HDD|NVMe)?$/i, // e.g. "512GB SSD", "1TB"
      processor: /(Intel|AMD|Apple|M1|M2|Ryzen|Core i\d)/i,
      screen_size: /^\d{1,2}(\.\d)?\s*inches?$/i,
    };

    const pattern = patterns[key.toLowerCase()];
    // If no pattern defined, assume valid or add stricter rules later
    return pattern ? pattern.test(value) : true; 
  }
}
