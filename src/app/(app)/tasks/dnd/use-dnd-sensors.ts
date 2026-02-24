'use client'

import { useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core'

export function useDndSensors() {
  const pointer = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  })
  const touch = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  return useSensors(pointer, touch)
}
