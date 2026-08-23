/**
 * Minimal structural type for the ancestor walk. THREE.Object3D satisfies it
 * (it has `name` and a `parent` of the same kind), so this helper stays
 * framework-free and unit-testable.
 */
export type SceneNode = { name: string; parent: SceneNode | null }

/**
 * Walk up from a hit object to the top-level child directly under `root` and
 * return that child's name — e.g. the "MacBook" / "Desk" / … nodes of the
 * combined homepage.glb scene. Returns null when `object` is `root` itself or
 * is not (transitively) a child of `root`.
 */
export function resolveTopLevelNode(object: SceneNode, root: SceneNode): string | null {
  let current: SceneNode | null = object
  while (current && current.parent !== root) {
    current = current.parent
  }
  if (!current || current === root) return null
  return current.name
}
