"use client"

import { OrbitControls, useProgress } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"

import { SceneModels } from "./scene-models"

function LoadingBar() {
  // useProgress is a zustand store backed by three's DefaultLoadingManager,
  // so it works outside <Canvas> (verified in drei source).
  const { active, progress } = useProgress()
  if (!active) return null
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-primary transition-[width] duration-150 ease-out"
      style={{ width: `${progress}%` }}
    />
  )
}

export function HomeCanvas() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 1.6, 3.4], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[4, 8, 5]} intensity={1.4} />
        <directionalLight position={[-5, 3, -6]} intensity={0.5} />
        <SceneModels />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={1.5}
          maxDistance={8}
        />
      </Canvas>
      <LoadingBar />
    </div>
  )
}
