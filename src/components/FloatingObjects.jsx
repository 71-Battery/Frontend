import './FloatingObjects.css'

const cubeFaces = ['front', 'back', 'right', 'left', 'top', 'bottom']

export default function FloatingObjects({ variant = 'dashboard' }) {
  return (
    <div className={`floating-objects floating-objects--${variant}`} aria-hidden="true">
      <span className="floating-object floating-sphere floating-sphere--one" />
      <span className="floating-object floating-sphere floating-sphere--two" />
      <span className="floating-object floating-ring" />
      <span className="floating-object floating-crystal" />
      <span className="floating-object floating-cube">
        {cubeFaces.map((face) => (
          <i className={`floating-cube-face floating-cube-face--${face}`} key={face} />
        ))}
      </span>
    </div>
  )
}
