type InsightsAnimatedGradientProps = {
  id: string
  variant?: 'icon' | 'fill'
}

export function InsightsAnimatedGradient({
  id,
  variant = 'icon',
}: InsightsAnimatedGradientProps) {
  const isFill = variant === 'fill'
  const rotateCenter = isFill ? '0.5 0.5' : '12 12'

  return (
    <linearGradient
      id={id}
      gradientUnits={isFill ? 'objectBoundingBox' : 'userSpaceOnUse'}
      x1="0"
      y1="0"
      x2={isFill ? '1' : '24'}
      y2={isFill ? '1' : '24'}
    >
      <stop offset="0%" stopColor="#ddd6fe">
        <animate
          attributeName="stop-color"
          values="#ddd6fe;#38bdf8;#a78bfa;#ddd6fe"
          dur="6s"
          repeatCount="indefinite"
        />
      </stop>
      <stop offset="33%" stopColor="#a78bfa">
        <animate
          attributeName="stop-color"
          values="#a78bfa;#2dd4bf;#818cf8;#a78bfa"
          dur="6s"
          repeatCount="indefinite"
        />
      </stop>
      <stop offset="66%" stopColor="#38bdf8">
        <animate
          attributeName="stop-color"
          values="#38bdf8;#c084fc;#2dd4bf;#38bdf8"
          dur="6s"
          repeatCount="indefinite"
        />
      </stop>
      <stop offset="100%" stopColor="#2dd4bf">
        <animate
          attributeName="stop-color"
          values="#2dd4bf;#ddd6fe;#818cf8;#2dd4bf"
          dur="6s"
          repeatCount="indefinite"
        />
      </stop>
      <animateTransform
        attributeName="gradientTransform"
        type="rotate"
        from={`0 ${rotateCenter}`}
        to={`360 ${rotateCenter}`}
        dur="6s"
        repeatCount="indefinite"
      />
    </linearGradient>
  )
}
