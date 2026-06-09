import { WmsEvent } from '../types';

export type ValidationStatus = 'valid' | 'invalid' | 'warning';

/**
 * Compute business Validation Status for an event.
 * - returns 'invalid' if any business rule or any validation_rule with status 'ERROR'
 * - returns 'warning' if no errors and at least one validation_rule with status 'WARNING'
 * - returns 'valid' if no errors and no warnings
 *
 * NOTE: This function DOES NOT read or use the backend workflow `event.status`.
 */
export function getValidationStatus(event: WmsEvent): ValidationStatus {
  const errors: string[] = [];
  const quantity = event.modified_quantity ?? event.original_quantity;

  if (quantity <= 0) {
    errors.push('Quantity must be greater than 0');
  }

  if (!event.item_code || event.item_code.trim() === '') {
    errors.push('Product empty');
  }

  if (!event.pulse || (typeof event as any).pulse === 'string' && (event as any).pulse.trim() === '') {
    // Some older event shapes might not include `pulse`; keep check tolerant.
    errors.push('Event Type (pulse) empty');
  }

  if (!event.bin_location || event.bin_location.trim() === '') {
    errors.push('Bin Location empty');
  }

  if (!event.sap_date || event.sap_date.trim() === '') {
    errors.push('Date invalid');
  }

  if (errors.length > 0) {
    // Early invalid when business-required fields are missing/incorrect
    return 'invalid';
  }

  if (event.validation_rules.some(rule => rule.status === 'ERROR')) {
    return 'invalid';
  }

  if (event.validation_rules.some(rule => rule.status === 'WARNING')) {
    return 'warning';
  }

  return 'valid';
}
