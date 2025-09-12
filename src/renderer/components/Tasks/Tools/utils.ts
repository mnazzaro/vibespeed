/**
 * Helper function to convert absolute paths to relative paths based on the working directory
 * @param fullPath - The full absolute path
 * @param workingDirectory - The working directory to make the path relative to
 * @returns The relative path if within working directory, otherwise the full path
 */
export const getRelativePath = (fullPath: string, workingDirectory?: string): string => {
  if (!workingDirectory) return fullPath;

  // Normalize paths for comparison
  const normalizedWorkingDir = workingDirectory.replace(/\\/g, '/').replace(/\/$/, '');
  const normalizedFullPath = fullPath.replace(/\\/g, '/');

  // Check if the path starts with the working directory
  if (normalizedFullPath.startsWith(normalizedWorkingDir)) {
    // Return relative path, removing the leading slash if present
    const relativePath = normalizedFullPath.slice(normalizedWorkingDir.length);
    return relativePath.startsWith('/') ? relativePath.slice(1) : relativePath || '.';
  }

  // If not within working directory, return the full path
  return fullPath;
};
