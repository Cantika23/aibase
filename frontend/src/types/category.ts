/**
 * Category type definitions
 */

export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CreateCategoryData {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}
