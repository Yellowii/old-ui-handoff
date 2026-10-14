// Role resolution for character models. Character pages must never hide a
// missing runtime/preview asset by silently substituting the opposite role.
export const exactModelForRole = (variant, role) => role === 'preview' ? variant?.preview || null : variant?.runtime || null;
export const roleAvailability = variant => ({
  preview: Boolean(exactModelForRole(variant, 'preview')),
  runtime: Boolean(exactModelForRole(variant, 'runtime')),
});
