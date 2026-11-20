// Dimensions are in metres. The grid fades with the pixel footprint so distant
// brickwork and curtain walls resolve into colour instead of shimmering.
export const facadeFinish = `
float facadeJoint(float cell, float width) {
  float pixel = max(fwidth(cell), .0001);
  float distance = abs(fract(cell + .5) - .5);
  return (1.0 - smoothstep(width - pixel * .45, width + pixel * .45, distance))
    * (1.0 - smoothstep(.25, .75, pixel));
}
float facadeHash(vec2 cell) {
  return fract(sin(dot(mod(cell, 157.0), vec2(27.31, 39.49))) * 4375.3);
}
vec3 facadeWall(vec3 base, vec2 uv) {
  float brick = smoothstep(1.50, 1.95, base.r / max(base.g, .014));
  vec2 cell = uv / mix(vec2(1.24, .62), vec2(.25, .076), brick);
  float row = floor(cell.y);
  cell.x += .5 * mod(row, 2.0) * brick;
  // The running-bond offset jumps between rows; use continuous coordinates
  // for the distance fade, so horizontal mortar remains visible at the seam.
  float pixel = max(fwidth(uv.x) / mix(1.24, .25, brick), fwidth(cell.y));
  float atHand = 1.0 - smoothstep(.22, .72, pixel);
  float tone = facadeHash(vec2(floor(cell.x), row));
  vec3 face = base * (1.0 + (tone - .5) * (.065 + .20 * brick) * atHand);
  float joint = max(facadeJoint(cell.x, mix(.0035, .017, brick)), facadeJoint(cell.y, mix(.006, .06, brick)));
  return mix(face, mix(base * .58, base * .67 + vec3(.09,.073,.06), brick), joint);
}
vec3 facadeGlass(vec3 tint, vec3 worldPos, vec3 wallNormal) {
  vec3 incoming = normalize(worldPos - cameraPosition);
  vec3 reflected = reflect(incoming, normalize(wallNormal));
  // The broad sky gradient follows the real viewing angle. Broken blue-green
  // reflections at eye height keep the lobby and upper floors distinct.
  float horizon = .10 + .07 * sin(reflected.x * 27.4 + reflected.z * 12.6)
    + .028 * sin(reflected.z * 83.0 - reflected.x * 39.3);
  float sky = smoothstep(horizon - .075, horizon + .095, reflected.y);
  float grazing = 1.0 - abs(dot(incoming, normalize(wallNormal)));
  vec3 environment = mix(vec3(.028,.051,.046), vec3(.35,.52,.64), sky);
  return mix(tint, environment, .29 + grazing * grazing * .30);
}`;

// The landmark meshes already define their individual windows and frames.
// Only apply the surface finish to their wall and glass batches.
export function finishLandmarkMaterials(roots) {
  const authored = /^(?:captured-architecture|east-buildings|capture-west|frontage|[ENW]\d+(?:-\d+)?)-(wall|stone|glass)$/;
  for (const root of roots) root.traverse(mesh => {
    const family = authored.exec(mesh.name)?.[1];
    if (!family || !mesh.isMesh) return;
    const material = mesh.material, glass = family === 'glass';
    material.customProgramCacheKey = () => 'campus-finish-' + family;
    material.onBeforeCompile = shader => {
      const varyings = 'varying vec3 vFacadePosition; varying vec3 vFacadeNormal; varying vec2 vFacadeUv;';
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + varyings)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          mat4 facadeModel = modelMatrix;
          #ifdef USE_INSTANCING
            facadeModel *= instanceMatrix;
          #endif
          vFacadeNormal = normalize(mat3(facadeModel) * normal);
          vFacadePosition = (facadeModel * vec4(transformed, 1.0)).xyz;
          vFacadeUv = vec2(dot(vFacadePosition.xz, vec2(vFacadeNormal.z, -vFacadeNormal.x)), vFacadePosition.y);`);
      const finish = glass ? 'facadeGlass(diffuseColor.rgb, vFacadePosition, vFacadeNormal)' : 'facadeWall(diffuseColor.rgb, vFacadeUv)';
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + varyings + facadeFinish)
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, '+finish+', 1.0 - smoothstep(.28,.70,abs(vFacadeNormal.y)));');
    };
  });
}
