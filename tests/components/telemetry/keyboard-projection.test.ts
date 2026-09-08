import * as THREE from "three"

import { projectKeyAnchor } from "@/components/telemetry/keyboard-projection";

function makeCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
  camera.position.set(0, 0, 2);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  return camera;
}

const SIZE = { width: 800, height: 800 };

describe("projectKeyAnchor", () => {
  it("returns null for a missing node", () => {
    expect(projectKeyAnchor(null, makeCamera(), SIZE)).toBeNull();
    expect(projectKeyAnchor(undefined, makeCamera(), SIZE)).toBeNull();
  });

  it("returns null for a node with an empty bounding box", () => {
    const group = new THREE.Group();
    group.updateMatrixWorld(true);
    expect(projectKeyAnchor(group, makeCamera(), SIZE)).toBeNull();
  });

  it("projects a centred cube into the screen centre with a positive height", () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial(),
    );
    mesh.updateMatrixWorld(true);

    const anchor = projectKeyAnchor(mesh, makeCamera(), SIZE);
    expect(anchor).not.toBeNull();
    expect(anchor!.centerX).toBeCloseTo(400, 0);
    // The cube's top edge is above the screen centre.
    expect(anchor!.keyTop).toBeLessThan(400);
    expect(anchor!.keyHeight).toBeGreaterThan(0);
    expect(anchor!.keyTop + anchor!.keyHeight).toBeGreaterThan(400 - 1);
  });

  it("returns null when every corner is behind the camera", () => {
    const camera = makeCamera();
    // Camera at z=2 looks toward -Z (at the origin), so objects at positive Z
    // sit behind it; a cube there projects onto the wrong side of the screen,
    // so all corners are skipped and the anchor is null.
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial(),
    );
    mesh.position.set(0, 0, 3);
    mesh.updateMatrixWorld(true);

    expect(projectKeyAnchor(mesh, camera, SIZE)).toBeNull();
  });
});
