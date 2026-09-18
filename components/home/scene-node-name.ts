import { PropertyBinding } from "three"

/**
 * three r185's GLTFLoader sanitizes every node name on load via
 * PropertyBinding.sanitizeNodeName (spaces → underscores, [].:/ stripped), so an
 * authoring name like "Water Flask" would load as "Water_Flask" and never match
 * the config. The GLB is authored with CamelCase names ("WaterBottle") that pass
 * through unchanged, but mapping every node through the same sanitizer keeps
 * hotspots resolving against the live scene graph if a future export uses
 * spaces or dots.
 *
 * This lives apart from scene-config so that module stays three-free: the
 * fallback page (which is in the route's eager graph, see ADR 0001) shares the
 * greeting text with the 3D scene, and a sanitizer is an implementation detail
 * of matching a loaded graph — not something a module that declares the scene
 * should need three for.
 */
export function runtimeNodeName(name: string): string {
  return PropertyBinding.sanitizeNodeName(name)
}
