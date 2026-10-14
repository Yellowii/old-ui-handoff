// NeoX GetSpecularFromMaterial: dielectric F0 = 0.08 * authored specular.
// Current Three uses the dielectric and metal-blended values separately in
// diffuse energy conservation, direct GGX and indirect multiscattering.
// Preserve signed source values; clamping here changes authored ice materials.
// Some source programs have metalness=0 and specular=0: NeoX Schlick
// uses saturate(50*F0.g), so their grazing reflectance must also be zero.
// Keep this explicit until each caller's source lighting contract is verified.
// F_Schlick receives the metal-blended F0, not the dielectric scalar. Dark
// metals and signed authored specular can therefore have fractional/zero F90.
export const sourceGrazing = 'clamp(50.*material.specularColorBlended.g,0.,1.)';
export const sourceSpecular = (expression, grazing = null) => `#include <lights_physical_fragment>
material.specularColor=vec3(.08*(${expression}));
material.specularColorBlended=mix(material.specularColor,diffuseColor.rgb,metalnessFactor);${grazing === null ? '' : `\nmaterial.specularF90=${grazing};`}`;
