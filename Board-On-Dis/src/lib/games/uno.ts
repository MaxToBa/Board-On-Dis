export type Color = 'red' | 'yellow' | 'green' | 'blue' | 'wild'
export type CardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4'

export interface Card {
  id: string
  color: Color
  type: CardType
  value: number | null
}

export function createDeck(): Card[] {
  const colors: Color[] = ['red', 'yellow', 'green', 'blue']
  const deck: Card[] = []
  let id = 0

  for (const color of colors) {
    // 0: one card
    deck.push({ id: `${id++}`, color, type: 'number', value: 0 })
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: `${id++}`, color, type: 'number', value: v })
      deck.push({ id: `${id++}`, color, type: 'number', value: v })
    }
    for (let i = 0; i < 2; i++) {
      deck.push({ id: `${id++}`, color, type: 'skip', value: null })
      deck.push({ id: `${id++}`, color, type: 'reverse', value: null })
      deck.push({ id: `${id++}`, color, type: 'draw2', value: null })
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ id: `${id++}`, color: 'wild', type: 'wild', value: null })
    deck.push({ id: `${id++}`, color: 'wild', type: 'wild4', value: null })
  }
  return shuffle(deck)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function canPlay(card: Card, topCard: Card, activeColor: Color): boolean {
  if (card.type === 'wild' || card.type === 'wild4') return true
  if (card.color === activeColor) return true
  if (topCard.type === card.type) return true
  if (card.value !== null && card.value === topCard.value) return true
  return false
}

export function getPlayableCards(hand: Card[], topCard: Card, activeColor: Color): Card[] {
  return hand.filter((c) => canPlay(c, topCard, activeColor))
}

const COLOR_LABELS: Record<Color, string> = {
  red: '🔴', yellow: '🟡', green: '🟢', blue: '🔵', wild: '🃏'
}
const TYPE_LABELS: Record<CardType, string> = {
  number: '', skip: '⊘', reverse: '↺', draw2: '+2', wild: '★', wild4: '+4'
}

export function cardLabel(card: Card): string {
  const type = TYPE_LABELS[card.type]
  const num = card.value !== null ? String(card.value) : ''
  return `${COLOR_LABELS[card.color]} ${num || type}`
}
