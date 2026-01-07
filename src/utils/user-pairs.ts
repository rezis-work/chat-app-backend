/**
 * Utility functions for normalizing user pairs
 * Ensures consistent storage of relationships between two users
 */

/**
 * Normalize two user IDs into a consistent pair order
 * Always stores userAId as the lexicographically smaller ID
 * This prevents duplicate relationships regardless of which user initiated
 *
 * @param userId1 - First user ID
 * @param userId2 - Second user ID
 * @returns Normalized pair with userAId (smaller) and userBId (larger)
 */
export function normalizeUserPair(
  userId1: string,
  userId2: string
): { userAId: string; userBId: string } {
  if (userId1 === userId2) {
    throw new Error('Cannot create relationship with same user');
  }

  // Sort lexicographically to ensure consistent ordering
  const [userAId, userBId] =
    userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

  return { userAId, userBId };
}

/**
 * Get the other user's ID from a normalized pair
 * Useful when you have a normalized pair and need to find the other user
 *
 * @param userAId - First user ID (smaller)
 * @param userBId - Second user ID (larger)
 * @param currentUserId - The current user's ID
 * @returns The other user's ID
 */
export function getOtherUserId(
  userAId: string,
  userBId: string,
  currentUserId: string
): string {
  if (currentUserId === userAId) {
    return userBId;
  }
  if (currentUserId === userBId) {
    return userAId;
  }
  throw new Error('Current user is not part of this pair');
}

