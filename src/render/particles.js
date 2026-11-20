import { PARTICLE_MAX } from '../constants.js'

/**
 * Pooled spark particles. Sparks are short white dashes that scatter from a
 * pluck, drift down and fade in ~0.6 s. The pool never grows beyond the cap.
 */
export function createParticles(max = PARTICLE_MAX) {
  const pool = Array.from({ length: max }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    length: 6,
  }))
  let cursor = 0

  function spawn(x, y, intensity) {
    let particle = null
    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[(cursor + i) % pool.length]
      if (!candidate.active) {
        particle = candidate
        cursor = (cursor + i + 1) % pool.length
        break
      }
    }
    if (!particle) {
      particle = pool[cursor]
      cursor = (cursor + 1) % pool.length
    }

    const angle = Math.random() * Math.PI * 2
    const speed = (60 + Math.random() * 180) * (0.55 + intensity * 0.8)
    const life = 0.42 + Math.random() * 0.22

    particle.active = true
    particle.x = x
    particle.y = y
    particle.vx = Math.cos(angle) * speed
    particle.vy = Math.sin(angle) * speed - 60
    particle.life = life
    particle.maxLife = life
    particle.length = 5 + Math.random() * 9
  }

  function emit(x, y, count, intensity = 0.7) {
    const total = Math.max(0, Math.min(Math.round(count), max))
    for (let i = 0; i < total; i += 1) spawn(x, y, intensity)
  }

  function update(dt) {
    if (dt <= 0) return
    for (const particle of pool) {
      if (!particle.active) continue
      particle.x += particle.vx * dt
      particle.y += particle.vy * dt
      particle.vy += 260 * dt
      particle.life -= dt
      if (particle.life <= 0) particle.active = false
    }
  }

  function draw(ctx) {
    ctx.save()
    ctx.lineWidth = 1.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#ffffff'
    for (const particle of pool) {
      if (!particle.active) continue
      const alpha = Math.max(0, particle.life / particle.maxLife)
      const tail = 0.018
      ctx.globalAlpha = alpha * 0.9
      ctx.beginPath()
      ctx.moveTo(particle.x, particle.y)
      ctx.lineTo(
        particle.x - particle.vx * tail,
        particle.y - particle.vy * tail,
      )
      ctx.stroke()
    }
    ctx.restore()
  }

  function clear() {
    for (const particle of pool) particle.active = false
  }

  function activeCount() {
    return pool.reduce((count, particle) => count + (particle.active ? 1 : 0), 0)
  }

  return { emit, update, draw, clear, activeCount }
}
