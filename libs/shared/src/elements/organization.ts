/**
 * Represents the definition of a product catalog item for an organization.
 * This is not a specific instance of an item, but rather the template for it.
 * (e.g., "16-inch MacBook Pro", not the one with serial number XYZ).
 */
export interface Product {
  id: string;
  name: string;
  /**
   * Whether this product has a Unique Product Identifier (UPI), like a serial number.
   * This determines if we track it as a 'UNIQUE_ITEM' or a 'BULK_ITEM_HOLDING'.
   */
  hasUpi: boolean;
}

export interface Department {
  id: string;
  name: string;
  subDepartments?: Department[];
}

/**
 * Represents the metadata for an Organization.
 * This is the root entity for all other data related to an organization.
 */
export interface Organization {
  id: string;
  name: string;
  imageUrl: string | null;
  departments: Department[];
}
