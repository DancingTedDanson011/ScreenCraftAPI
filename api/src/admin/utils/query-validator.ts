/**
 * Query Validator - Validates dynamic query parameters
 * M-03: Prevents SQL/NoSQL injection via dynamic orderBy fields
 */

/**
 * Valid sort fields for each entity type
 * Only fields in this allowlist can be used for sorting
 */
export const VALID_SORT_FIELDS = {
  auditLog: ['createdAt', 'action', 'targetType', 'ipAddress'] as const,
  account: ['createdAt', 'email', 'tier', 'usedCredits', 'monthlyCredits', 'updatedAt'] as const,
  user: ['createdAt', 'email', 'name', 'lastLoginAt'] as const,
  apiKey: ['createdAt', 'lastUsedAt', 'name', 'isActive'] as const,
  job: ['createdAt', 'status', 'completedAt', 'priority'] as const,
  screenshot: ['createdAt', 'status', 'url'] as const,
  pdf: ['createdAt', 'status', 'url', 'type'] as const,
} as const;

export type EntityType = keyof typeof VALID_SORT_FIELDS;
export type SortField<T extends EntityType> = (typeof VALID_SORT_FIELDS)[T][number];

/**
 * Valid sort orders
 */
export const VALID_SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof VALID_SORT_ORDERS)[number];

/**
 * Validates and returns a safe sort field
 * Returns the default field if the provided field is not in the allowlist
 *
 * @param entity - The entity type being sorted
 * @param field - The sort field to validate
 * @param defaultField - Default field to use if validation fails
 * @returns The validated sort field (from allowlist) or the default
 */
export function validateSortField<T extends EntityType>(
  entity: T,
  field: string | undefined,
  defaultField: SortField<T>
): SortField<T> {
  if (!field) {
    return defaultField;
  }

  const validFields = VALID_SORT_FIELDS[entity] as readonly string[];

  if (validFields.includes(field)) {
    return field as SortField<T>;
  }

  // Log the attempt for security monitoring
  console.warn(`[SECURITY] Invalid sort field '${field}' attempted for entity '${entity}'. Using default: '${defaultField}'`);

  return defaultField;
}

/**
 * Validates and returns a safe sort order
 * Returns 'desc' as default if the provided order is not valid
 *
 * @param order - The sort order to validate
 * @param defaultOrder - Default order to use if validation fails (default: 'desc')
 * @returns The validated sort order
 */
export function validateSortOrder(
  order: string | undefined,
  defaultOrder: SortOrder = 'desc'
): SortOrder {
  if (!order) {
    return defaultOrder;
  }

  const normalizedOrder = order.toLowerCase();

  if (VALID_SORT_ORDERS.includes(normalizedOrder as SortOrder)) {
    return normalizedOrder as SortOrder;
  }

  console.warn(`[SECURITY] Invalid sort order '${order}' attempted. Using default: '${defaultOrder}'`);

  return defaultOrder;
}

/**
 * Creates a validated orderBy object for Prisma queries
 * This is the main function to use for building safe orderBy clauses
 *
 * @param entity - The entity type being sorted
 * @param sortBy - The field to sort by (will be validated)
 * @param sortOrder - The sort order (will be validated)
 * @param defaultField - Default field to use if validation fails
 * @returns A safe Prisma orderBy object
 */
export function createSafeOrderBy<T extends EntityType>(
  entity: T,
  sortBy: string | undefined,
  sortOrder: string | undefined,
  defaultField: SortField<T>
): Record<string, 'asc' | 'desc'> {
  const validatedField = validateSortField(entity, sortBy, defaultField);
  const validatedOrder = validateSortOrder(sortOrder);

  return { [validatedField]: validatedOrder };
}

/**
 * Validates pagination parameters
 * Ensures page and limit are positive integers within reasonable bounds
 */
export function validatePagination(
  page: number | undefined,
  limit: number | undefined,
  maxLimit: number = 100
): { page: number; limit: number; skip: number } {
  const validPage = Math.max(1, Math.floor(Number(page) || 1));
  const validLimit = Math.min(maxLimit, Math.max(1, Math.floor(Number(limit) || 20)));
  const skip = (validPage - 1) * validLimit;

  return { page: validPage, limit: validLimit, skip };
}
