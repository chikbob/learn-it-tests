export function updateMistakeProgress(existingMistakes, existingMastery, results, mode) {
  const mistakes = new Set(existingMistakes)
  const mastery = { ...existingMastery }

  results.forEach(({ id, correct }) => {
    if (!correct) {
      mistakes.add(id)
      mastery[id] = 0
      return
    }

    if (!mistakes.has(id)) return
    if (mode === 'mistakes') {
      mistakes.delete(id)
      delete mastery[id]
      return
    }

    mastery[id] = (mastery[id] || 0) + 1
    if (mastery[id] >= 2) {
      mistakes.delete(id)
      delete mastery[id]
    }
  })

  return { mistakes: [...mistakes], mastery }
}
