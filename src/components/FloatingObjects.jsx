import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MathUtils, Vector3 } from 'three'
import './FloatingObjects.css'

const objects = [
  {
    id: 'violet-sphere',
    geometry: 'sphere',
    position: [-5.2, 2.7, 1.2],
    velocity: [0.22, -0.14, 0.13],
    rotation: [-0.2, 0.4, 0],
    spin: [0.16, 0.24, 0.1],
    scale: 0.82,
    phase: 0.3,
    color: '#afbdd2',
    emissive: '#56657d',
    mobile: true,
  },
  {
    id: 'mint-sphere',
    geometry: 'pebble',
    position: [5.1, -2.8, -1.8],
    velocity: [-0.19, -0.18, 0.16],
    rotation: [0.2, -0.35, 0.1],
    spin: [-0.12, 0.2, -0.08],
    scale: [0.68, 0.82, 0.62],
    phase: 1.6,
    color: '#b8cdc4',
    emissive: '#5d716a',
    mobile: true,
  },
  {
    id: 'violet-torus',
    geometry: 'torus',
    position: [4.8, 2.8, -0.3],
    velocity: [-0.24, 0.15, -0.11],
    rotation: [1.05, 0.24, 0.3],
    spin: [0.1, 0.2, 0.32],
    scale: 0.88,
    phase: 2.7,
    color: '#bbb9cf',
    emissive: '#69677d',
    mobile: true,
  },
  {
    id: 'ice-capsule',
    geometry: 'capsule',
    position: [-5, -2.7, -2.6],
    velocity: [0.17, -0.21, 0.18],
    rotation: [-0.3, 0.3, -0.2],
    spin: [0.22, 0.3, 0.14],
    scale: 0.72,
    phase: 4,
    color: '#b9cad2',
    emissive: '#60737a',
    mobile: false,
  },
  {
    id: 'pearl-knot',
    geometry: 'knot',
    position: [3.65, -0.25, 2.35],
    velocity: [0.14, 0.2, -0.2],
    rotation: [-0.4, 0.55, 0.12],
    spin: [0.28, 0.36, 0.18],
    scale: 0.76,
    phase: 5.2,
    color: '#d0c4bf',
    emissive: '#766965',
    mobile: false,
  },
]

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(query.matches)
    updatePreference()
    query.addEventListener('change', updatePreference)
    return () => query.removeEventListener('change', updatePreference)
  }, [])

  return reducedMotion
}

function Geometry({ type }) {
  if (type === 'sphere' || type === 'pebble') {
    return <sphereGeometry args={[1, 56, 56]} />
  }
  if (type === 'torus') return <torusGeometry args={[1, 0.28, 36, 112]} />
  if (type === 'capsule') return <capsuleGeometry args={[0.58, 0.9, 16, 36]} />
  return <torusKnotGeometry args={[0.66, 0.18, 112, 24, 2, 3]} />
}

function FloatingMesh({ object, pointerRef, reducedMotion }) {
  const meshRef = useRef(null)
  const { camera, viewport } = useThree()
  const pointerPoint = useMemo(() => new Vector3(), [])
  const pointerDirection = useMemo(() => new Vector3(), [])
  const state = useRef({
    position: new Vector3(...object.position),
    velocity: new Vector3(...object.velocity),
    rotation: [...object.rotation],
  })

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const elapsed = clock.getElapsedTime()
    const frameDelta = clamp(delta, 0, 0.04)
    const motion = state.current
    const pointer = pointerRef.current

    if (!reducedMotion) {
      const targetVelocityX =
        object.velocity[0] + Math.sin(elapsed * 0.31 + object.phase) * 0.17
      const targetVelocityY =
        object.velocity[1] + Math.cos(elapsed * 0.27 + object.phase) * 0.14
      const targetVelocityZ =
        object.velocity[2] + Math.sin(elapsed * 0.22 + object.phase) * 0.12
      const steering = Math.min(1, frameDelta * 0.75)

      motion.velocity.x += (targetVelocityX - motion.velocity.x) * steering
      motion.velocity.y += (targetVelocityY - motion.velocity.y) * steering
      motion.velocity.z += (targetVelocityZ - motion.velocity.z) * steering

      if (pointer.active && performance.now() - pointer.lastMoveAt < 1800) {
        pointerPoint.set(pointer.x, pointer.y, 0.5).unproject(camera)
        pointerDirection
          .copy(pointerPoint)
          .sub(camera.position)
          .normalize()

        const rayDistance =
          (motion.position.z - camera.position.z) / pointerDirection.z
        pointerPoint
          .copy(camera.position)
          .add(pointerDirection.multiplyScalar(rayDistance))

        const distanceX = motion.position.x - pointerPoint.x
        const distanceY = motion.position.y - pointerPoint.y
        const distance = Math.max(0.01, Math.hypot(distanceX, distanceY))
        const interactionRadius = pointer.down ? 2.9 : 2.2

        if (distance < interactionRadius) {
          const proximity = 1 - distance / interactionRadius
          const force = proximity * proximity * (pointer.down ? 8.5 : 4.8)
          motion.velocity.x += (distanceX / distance) * force * frameDelta
          motion.velocity.y += (distanceY / distance) * force * frameDelta
          motion.velocity.x += pointer.velocityX * proximity * 0.025
          motion.velocity.y += pointer.velocityY * proximity * 0.025
          motion.velocity.z -= force * frameDelta * 0.62
        }
      }

      motion.velocity.multiplyScalar(Math.pow(0.996, frameDelta * 60))
      motion.position.addScaledVector(motion.velocity, frameDelta)

      const xLimit = Math.max(2.05, viewport.width * 0.47)
      const yLimit = Math.max(3.4, viewport.height * 0.46)
      const zNear = 3.1
      const zFar = -4.2

      if (Math.abs(motion.position.x) > xLimit) {
        motion.position.x = clamp(motion.position.x, -xLimit, xLimit)
        motion.velocity.x *= -0.88
      }
      if (Math.abs(motion.position.y) > yLimit) {
        motion.position.y = clamp(motion.position.y, -yLimit, yLimit)
        motion.velocity.y *= -0.88
      }
      if (motion.position.z > zNear || motion.position.z < zFar) {
        motion.position.z = clamp(motion.position.z, zFar, zNear)
        motion.velocity.z *= -0.84
      }

      motion.rotation[0] += object.spin[0] * frameDelta
      motion.rotation[1] += object.spin[1] * frameDelta
      motion.rotation[2] += object.spin[2] * frameDelta
    }

    mesh.position.copy(motion.position)
    mesh.rotation.set(...motion.rotation)
  })

  return (
    <mesh
      ref={meshRef}
      position={object.position}
      rotation={object.rotation}
      scale={object.scale}
    >
      <Geometry type={object.geometry} />
      <meshPhysicalMaterial
        color={object.color}
        emissive={object.emissive}
        emissiveIntensity={0.06}
        metalness={0.04}
        roughness={0.3}
        clearcoat={0.72}
        clearcoatRoughness={0.28}
        reflectivity={0.62}
        ior={1.32}
        transparent
        opacity={0.68}
      />
    </mesh>
  )
}

function CameraRig({ pointerRef, reducedMotion }) {
  const { camera } = useThree()

  useFrame((_, delta) => {
    const pointer = pointerRef.current
    const interactive = pointer.active && performance.now() - pointer.lastMoveAt < 1800
    const targetX = interactive && !reducedMotion ? pointer.x * 0.42 : 0
    const targetY = interactive && !reducedMotion ? pointer.y * 0.28 : 0

    camera.position.x = MathUtils.damp(camera.position.x, targetX, 3.6, delta)
    camera.position.y = MathUtils.damp(camera.position.y, targetY, 3.6, delta)
    camera.lookAt(0, 0, 0)
  })

  return null
}

function FloatingScene({ pointerRef, reducedMotion }) {
  const viewportWidth = useThree((state) => state.viewport.width)
  const compact = viewportWidth < 6
  const visibleObjects = compact
    ? objects.filter((object) => object.mobile)
    : objects

  return (
    <>
      <ambientLight intensity={1.75} />
      <hemisphereLight args={['#fafcff', '#6c7584', 1.25]} />
      <directionalLight position={[-4, 7, 8]} color="#ffffff" intensity={2.15} />
      <pointLight position={[5, -2, 5]} color="#dceae5" intensity={9} distance={16} />
      <pointLight position={[-5, 1, 3]} color="#dfe4f2" intensity={8} distance={15} />
      <CameraRig pointerRef={pointerRef} reducedMotion={reducedMotion} />
      {visibleObjects.map((object) => (
        <FloatingMesh
          key={object.id}
          object={object}
          pointerRef={pointerRef}
          reducedMotion={reducedMotion}
        />
      ))}
    </>
  )
}

export default function FloatingObjects({ variant = 'dashboard' }) {
  const reducedMotion = useReducedMotion()
  const pointerRef = useRef({
    active: false,
    down: false,
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    previousX: 0,
    previousY: 0,
    lastMoveAt: 0,
  })

  useEffect(() => {
    const pointer = pointerRef.current

    const updatePointer = (event) => {
      const now = performance.now()
      const nextX = (event.clientX / window.innerWidth) * 2 - 1
      const nextY = -(event.clientY / window.innerHeight) * 2 + 1
      const elapsed = Math.max(16, now - pointer.lastMoveAt)

      pointer.previousX = pointer.x
      pointer.previousY = pointer.y
      pointer.x = nextX
      pointer.y = nextY
      pointer.velocityX = ((nextX - pointer.previousX) / elapsed) * 1000
      pointer.velocityY = ((nextY - pointer.previousY) / elapsed) * 1000
      pointer.lastMoveAt = now
      pointer.active = true
    }

    const handlePointerDown = (event) => {
      updatePointer(event)
      pointer.down = true
    }
    const handlePointerUp = () => {
      pointer.down = false
    }
    const handleWindowBlur = () => {
      pointer.active = false
      pointer.down = false
    }

    window.addEventListener('pointermove', updatePointer, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handlePointerUp, { passive: true })
    window.addEventListener('blur', handleWindowBlur)

    return () => {
      window.removeEventListener('pointermove', updatePointer)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('blur', handleWindowBlur)
    }
  }, [])

  return (
    <div
      className={`floating-objects floating-objects--${variant}`}
      aria-hidden="true"
    >
      <Canvas
        camera={{ position: [0, 0, 10], fov: 45, near: 0.1, far: 40 }}
        dpr={[1, 1.5]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        <FloatingScene
          pointerRef={pointerRef}
          reducedMotion={reducedMotion}
        />
      </Canvas>
    </div>
  )
}
