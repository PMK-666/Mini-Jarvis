/**
 * Read-only product content used for display (names, descriptions, check-in times).
 * In production this comes from the Trip Template Service's content tables, not from a supplier.
 */
import { ACTIVITIES, PROPERTIES, TRANSFERS } from "./providers/mock/inventory";

export const property = (id?: string) => (id ? PROPERTIES.find((p) => p.id === id) : undefined);
export const transferProduct = (id: string) => TRANSFERS.find((t) => t.id === id);
export const activityProduct = (id: string) => ACTIVITIES.find((a) => a.id === id);
export { PROPERTIES };
