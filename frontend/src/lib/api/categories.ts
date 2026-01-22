/**
 * Categories API client
 */

import type {
  Category,
  CreateCategoryData,
  UpdateCategoryData,
} from "../../types/category";

const API_BASE_URL = "/api";

/**
 * Get all categories for a project
 */
export async function getCategories(projectId: string): Promise<Category[]> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/categories`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get categories");
  }

  const data = await response.json();
  return data.data.categories;
}

/**
 * Get a specific category
 */
export async function getCategory(
  projectId: string,
  categoryId: string
): Promise<Category> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/categories/${categoryId}`,
    {
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get category");
  }

  const data = await response.json();
  return data.data.category;
}

/**
 * Create a new category
 */
export async function createCategory(
  projectId: string,
  categoryData: CreateCategoryData
): Promise<Category> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/categories`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(categoryData),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create category");
  }

  const data = await response.json();
  return data.data.category;
}

/**
 * Update a category
 */
export async function updateCategory(
  projectId: string,
  categoryId: string,
  updates: UpdateCategoryData
): Promise<Category> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/categories/${categoryId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update category");
  }

  const data = await response.json();
  return data.data.category;
}

/**
 * Delete a category
 */
export async function deleteCategory(
  projectId: string,
  categoryId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/projects/${projectId}/categories/${categoryId}`,
    {
      method: "DELETE",
      credentials: "include",
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete category");
  }
}
