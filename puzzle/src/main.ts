import './style.css'

// Chemin de base dynamique pour Vite
const BASE = import.meta.env.BASE_URL

// Définir la variable CSS pour le fond d'écran
document.documentElement.style.setProperty('--background-image-url', `url(${BASE}src/assets/layton_paper.png)`)

type Position = {
  row: number
  col: number
}

type Piece = {
  id: number
  correct: Position
  current: Position
  element: HTMLButtonElement
}

const COLUMNS = 4
const GRID_ROWS = 3
const BOARD_ROWS = GRID_ROWS + 2
const PLAYABLE_ROW_OFFSET = 1

const INITIAL_PIECE_ORDER: number[] = [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]

const fixedEmptyTargets: Position[] = [
  { row: 0, col: 0 },
  { row: 4, col: 3 },
]

let isVictory = false

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('Container #app introuvable')
}

app.innerHTML = `
  <audio id="background-music" loop>
    <source src="${BASE}src/assets/puzzle.wav" type="audio/wav">
  </audio>
  <audio id="victory-sound">
    <source src="${BASE}src/assets/end.mp4" type="audio/mp4">
  </audio>
  <main class="layout">
    <h1>Puzzle d'anniversaire de Margaux !</h1>
    <p id="status" class="status">Glisse une pièce vers une case vide voisine.</p>
    <div class="puzzle-container">
      <div id="board" class="puzzle-board" aria-label="Plateau du puzzle"></div>
      <div class="side-controls">
        <div id="moves" class="moves-counter">0000</div>
        <button id="hints-btn" class="hints-btn">Indice</button>
        <button id="restart-side-btn" class="restart-btn">Recommencer</button>
      </div>
    </div>
  </main>
  <div id="hints-modal" class="hints-modal">
    <div class="hints-content">
      <button id="close-hints" class="close-hints">&times;</button>
      <h2>Regardez cette petite bouille</h2>
      <img src="${BASE}src/assets/gnoc3.jpeg" class="hint-image" />
    </div>
  </div>
  <div id="gifts-modal" class="gifts-modal">
    <div class="gifts-content">
      <button id="close-gifts" class="close-gifts">&times;</button>
      <h2>Tes cadeaux 🎁</h2>
      <div class="gifts-images">
        <img src="${BASE}src/assets/cad1.webp" alt="Cadeau 1" class="gift-image" />
        <img src="${BASE}src/assets/cad2.webp" alt="Cadeau 2" class="gift-image" />
      </div>
      <p class="gifts-text">Avec Jade on t'offre une place à l'aquaboulevard pour te raffraichir cet été, et le jeu de société Rédac'Chef !</p>
    </div>
  </div>
  <div id="victory-overlay" class="victory-overlay">
    <div class="victory-content">
      <div class="victory-left">
        <img src="${BASE}src/assets/gnoc2.jpeg" alt="Puzzle completed" class="puzzle-image" />
        <div class="moves-display">
          <span class="moves-label">Nombre de coups:</span>
          <span class="moves-value" id="final-moves">0000</span>
        </div>
      </div>
      <div class="victory-right">
        <img src="${BASE}src/assets/lukeloi.gif" alt="Luke" class="victory-gif" />
        <div class="victory-text">Victoire !!</div>
        <button id="restart-btn" class="restart-btn">Recommencer</button>
        <button id="gifts-btn" class="gifts-btn">Tu peux maintenant regarder tes cadeaux Margaux</button>
      </div>
    </div>
  </div>
`

const board = document.querySelector<HTMLDivElement>('#board')
const status = document.querySelector<HTMLParagraphElement>('#status')
const movesDisplay = document.querySelector<HTMLDivElement>('#moves')
const victoryOverlay = document.querySelector<HTMLDivElement>('#victory-overlay')
const restartBtn = document.querySelector<HTMLButtonElement>('#restart-btn')
const restartSideBtn = document.querySelector<HTMLButtonElement>('#restart-side-btn')
const finalMovesDisplay = document.querySelector<HTMLSpanElement>('#final-moves')
const hintsBtn = document.querySelector<HTMLButtonElement>('#hints-btn')
const hintsModal = document.querySelector<HTMLDivElement>('#hints-modal')
const closeHintsBtn = document.querySelector<HTMLButtonElement>('#close-hints')
const giftsBtn = document.querySelector<HTMLButtonElement>('#gifts-btn')
const giftsModal = document.querySelector<HTMLDivElement>('#gifts-modal')
const closeGiftsBtn = document.querySelector<HTMLButtonElement>('#close-gifts')
const backgroundMusic = document.querySelector<HTMLAudioElement>('#background-music')
const victorySound = document.querySelector<HTMLAudioElement>('#victory-sound')

if (!board || !status || !movesDisplay || !victoryOverlay || !restartBtn || !restartSideBtn || !finalMovesDisplay || 
    !hintsBtn || !hintsModal || !closeHintsBtn || !giftsBtn || !giftsModal || !closeGiftsBtn || !backgroundMusic || !victorySound) {
  throw new Error('Éléments UI du puzzle introuvables')
}

// Démarrer la musique de fond en boucle
if (backgroundMusic) {
  backgroundMusic.volume = 0.3 // Volume à 30%
  backgroundMusic.play().catch(() => {
    // Si l'autoplay échoue (restrictions du navigateur), on joue au premier clic
    document.addEventListener('click', () => {
      if (!isVictory) {
        backgroundMusic.play()
      }
    }, { once: true })
  })
  
  // Empêcher la musique de se relancer après la victoire
  backgroundMusic.addEventListener('play', () => {
    if (isVictory) {
      backgroundMusic.pause()
    }
  })
}

board.style.setProperty('--columns', String(COLUMNS))
board.style.setProperty('--rows', String(BOARD_ROWS))

const playableCells: Position[] = []
for (let row = 0; row < GRID_ROWS; row += 1) {
  for (let col = 0; col < COLUMNS; col += 1) {
    playableCells.push({ row: row + PLAYABLE_ROW_OFFSET, col })
  }
}

const allCells: Position[] = [
  fixedEmptyTargets[0],
  ...playableCells,
  fixedEmptyTargets[1],
]

const getCellKey = (position: Position) => `${position.row}-${position.col}`

const cellIndexByKey = new Map<string, number>(
  allCells.map((cell, index) => [getCellKey(cell), index]),
)


const adjacencyMatrix: number[][] = allCells.map((cellA) =>
  allCells.map((cellB) => {
    const distance = Math.abs(cellA.row - cellB.row) + Math.abs(cellA.col - cellB.col)
    return distance === 1 ? 1 : 0
  }),
)

const isSamePosition = (first: Position, second: Position) => {
  return first.row === second.row && first.col === second.col
}

const pieceTargetCells = playableCells

const slotElements = new Map<string, HTMLDivElement>()
const pieces: Piece[] = []
let emptyCells: Position[] = fixedEmptyTargets.map((cell) => ({ ...cell }))
let puzzleSolved = false
let moveCount = 0

for (const cell of allCells) {
  const slot = document.createElement('div')
  slot.className = 'slot'
  slot.dataset.row = String(cell.row)
  slot.dataset.col = String(cell.col)
  board.appendChild(slot)
  slotElements.set(`${cell.row}-${cell.col}`, slot)
}

for (let index = 0; index < pieceTargetCells.length; index += 1) {
  const correct = pieceTargetCells[index]
  const element = document.createElement('button')
  element.type = 'button'
  element.className = 'piece'
  element.setAttribute('aria-label', `Pièce ${index + 1}`)
  element.style.position = 'absolute'
  element.style.left = '0px'
  element.style.top = '0px'
  
  // Ajouter l'image découpée comme background
  element.style.backgroundImage = 'url(/src/assets/gnoc2.jpeg)'
  element.style.backgroundSize = `${COLUMNS * 126}% ${GRID_ROWS * 133}%`
  
  // Calculer la position du découpage basée sur la position "correcte" de la tuile
  const decoupeRow = correct.row - PLAYABLE_ROW_OFFSET
  const decoupeCol = correct.col
  
  // Pour backgroundSize 400% x 300%, utiliser les pourcentages positifs
  const bgPosX = (decoupeCol / COLUMNS) * 100
  const bgPosY = (decoupeRow / GRID_ROWS) * 100
  element.style.backgroundPosition = `${bgPosX}% ${bgPosY}%`
  element.style.backgroundRepeat = 'no-repeat'
  element.style.backgroundAttachment = 'local'
  
  board.appendChild(element)

  pieces.push({
    id: index + 1,
    correct: { ...correct },
    current: { ...correct },
    element,
  })
}

const getCellSize = () => {
  // Calcule la taille d'une cellule basée sur la largeur réelle du board divisée par 4 colonnes
  const boardWidth = board.getBoundingClientRect().width
  const size = boardWidth / COLUMNS
  
  if (isNaN(size) || size <= 0) {
    console.warn('❌ Invalid cell size, using default 80px')
    return 80
  }
  
  return size
}

const getCoordinates = (position: Position) => {
  const size = getCellSize()
  return {
    x: position.col * size,
    y: position.row * size,
  }
}

const getAdjacentEmpties = (position: Position) => {
  const fromIndex = cellIndexByKey.get(getCellKey(position))
  if (fromIndex === undefined) {
    return []
  }

  return emptyCells.filter((emptyCell) => {
    const toIndex = cellIndexByKey.get(getCellKey(emptyCell))
    if (toIndex === undefined) {
      return false
    }
    return adjacencyMatrix[fromIndex][toIndex] === 1
  })
}

const renderEmptySlots = () => {
  for (const [key, slot] of slotElements.entries()) {
    const [row, col] = key.split('-').map(Number)
    const isEmpty = emptyCells.some(
      (cell) => cell.row === row && cell.col === col,
    )
    slot.classList.toggle('is-empty', isEmpty)
  }
}

const positionPiece = (piece: Piece, animated = true) => {
  const point = getCoordinates(piece.current)
  if (animated) {
    piece.element.classList.remove('dragging')
  }
  piece.element.style.left = `${point.x}px`
  piece.element.style.top = `${point.y}px`
  
  // Debug log
  if (!animated) {
    console.log(`  → Pièce ${piece.id} positioned at (${point.x}px, ${point.y}px)`)
  }
}

const isSolved = () => {
  const piecesPlaced = pieces.every((piece) =>
    isSamePosition(piece.current, piece.correct),
  )
  const emptyTargetsPlaced = fixedEmptyTargets.every((target) =>
    emptyCells.some((cell) => isSamePosition(cell, target)),
  )
  return piecesPlaced && emptyTargetsPlaced
}

const updateStatus = () => {
  if (puzzleSolved) {
    status.textContent = '🎉 Bravo ! Le puzzle est terminé.'
    board.classList.add('solved')
    // Afficher le nombre de coups dans l'overlay de victoire
    const displayText = String(moveCount).padStart(4, '0')
    finalMovesDisplay.textContent = displayText
    // Arrêter la musique de fond et jouer le son de victoire
    isVictory = true
    backgroundMusic.pause()
    backgroundMusic.currentTime = 0
    victorySound.currentTime = 0
    victorySound.play()
    // Afficher l'overlay de victoire après 1 seconde
    setTimeout(() => {
      victoryOverlay.classList.add('show')
    }, 1000)
    return
  }

  status.textContent =
    'Glisse une pièce vers une case vide voisine'
  board.classList.remove('solved')
  victoryOverlay.classList.remove('show')
}

const updateMoveCount = () => {
  const displayText = String(moveCount).padStart(4, '0')
  movesDisplay.textContent = displayText
}

const initializePuzzle = () => {
  if (INITIAL_PIECE_ORDER.length !== pieces.length) {
    throw new Error('INITIAL_PIECE_ORDER doit contenir exactement 12 valeurs.')
  }

  const unique = new Set(INITIAL_PIECE_ORDER)
  if (unique.size !== pieces.length || [...unique].some((id) => id < 1 || id > pieces.length)) {
    throw new Error('INITIAL_PIECE_ORDER doit contenir chaque id de 1 à 12 une seule fois.')
  }

  // Réinitialiser le flag de victoire et relancer la musique
  isVictory = false
  backgroundMusic.currentTime = 0
  backgroundMusic.play()
  
  moveCount = 0
  updateMoveCount()
  console.log('📍 Initializing puzzle with cell size:', getCellSize())

  // Place chaque pièce selon l'ordre défini dans INITIAL_PIECE_ORDER
  for (let i = 0; i < INITIAL_PIECE_ORDER.length; i++) {
    const pieceId = INITIAL_PIECE_ORDER[i]
    const piece = pieces.find(p => p.id === pieceId)
    if (piece) {
      piece.current = { ...pieceTargetCells[i] }
      positionPiece(piece, false)
      console.log(`🔷 Pièce ${pieceId} at position [${piece.current.row}, ${piece.current.col}]`)
    }
  }

  // Détermine les cases vides: celles qui ne sont occupées par aucune pièce
  const occupiedCells = new Set(pieces.map(p => getCellKey(p.current)))
  emptyCells = allCells.filter(cell => !occupiedCells.has(getCellKey(cell)))

  console.log('🟩 Empty cells:', emptyCells.length)

  renderEmptySlots()
  puzzleSolved = isSolved()
  updateStatus()
}

type ActiveDrag = {
  pointerId: number
  piece: Piece
  startX: number
  startY: number
  startLeft: number
  startTop: number
}

let activeDrag: ActiveDrag | null = null

const finishDrag = (pointerId: number, clientX: number, clientY: number) => {
  if (!activeDrag || activeDrag.pointerId !== pointerId) {
    return
  }

  const { piece } = activeDrag
  const currentPosition = { ...piece.current }
  const adjacentEmpties = getAdjacentEmpties(currentPosition)
  let targetCell: Position | null = null

  if (adjacentEmpties.length > 0) {
    const boardRect = board.getBoundingClientRect()
    const size = getCellSize()
    let bestDistance = Number.POSITIVE_INFINITY

    for (const candidate of adjacentEmpties) {
      const centerX = boardRect.left + candidate.col * size + size / 2
      const centerY = boardRect.top + candidate.row * size + size / 2
      const distance = Math.hypot(clientX - centerX, clientY - centerY)

      if (distance < bestDistance) {
        bestDistance = distance
        targetCell = candidate
      }
    }

    if (bestDistance > size * 0.8) {
      targetCell = null
    }
  }

  if (targetCell) {
    piece.current = { ...targetCell }
    emptyCells = emptyCells.map((emptyCell) =>
      isSamePosition(emptyCell, targetCell) ? currentPosition : emptyCell,
    )
    renderEmptySlots()
    moveCount++
    updateMoveCount()
  }

  positionPiece(piece)
  piece.element.releasePointerCapture(pointerId)
  activeDrag = null

  puzzleSolved = isSolved()
  updateStatus()
}

for (const piece of pieces) {
  piece.element.addEventListener('pointerdown', (event) => {
    if (puzzleSolved) {
      return
    }

    const movableTargets = getAdjacentEmpties(piece.current)
    if (movableTargets.length === 0) {
      return
    }

    const currentPoint = getCoordinates(piece.current)
    activeDrag = {
      pointerId: event.pointerId,
      piece,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: currentPoint.x,
      startTop: currentPoint.y,
    }

    piece.element.classList.add('dragging')
    piece.element.style.left = `${currentPoint.x}px`
    piece.element.style.top = `${currentPoint.y}px`
    piece.element.setPointerCapture(event.pointerId)
  })

  piece.element.addEventListener('pointermove', (event) => {
    if (!activeDrag || activeDrag.pointerId !== event.pointerId) {
      return
    }

    const offsetX = event.clientX - activeDrag.startX
    const offsetY = event.clientY - activeDrag.startY
    piece.element.style.left = `${activeDrag.startLeft + offsetX}px`
    piece.element.style.top = `${activeDrag.startTop + offsetY}px`
  })

  piece.element.addEventListener('pointerup', (event) => {
    finishDrag(event.pointerId, event.clientX, event.clientY)
  })

  piece.element.addEventListener('pointercancel', (event) => {
    finishDrag(event.pointerId, event.clientX, event.clientY)
  })
}

window.addEventListener('resize', () => {
  pieces.forEach((piece) => positionPiece(piece, false))
})

// Event listener pour le bouton recommencer
restartBtn.addEventListener('click', () => {
  location.reload()
})

restartSideBtn.addEventListener('click', () => {
  location.reload()
})

// Event listeners pour le modal hints
hintsBtn.addEventListener('click', () => {
  hintsModal.classList.add('show')
})

closeHintsBtn.addEventListener('click', () => {
  hintsModal.classList.remove('show')
})

// Fermer le modal en cliquant en dehors du contenu
hintsModal.addEventListener('click', (event) => {
  if (event.target === hintsModal) {
    hintsModal.classList.remove('show')
  }
})

// Event listeners pour le modal cadeaux
giftsBtn.addEventListener('click', () => {
  giftsModal.classList.add('show')
})

closeGiftsBtn.addEventListener('click', () => {
  giftsModal.classList.remove('show')
})

// Fermer le modal en cliquant en dehors du contenu
giftsModal.addEventListener('click', (event) => {
  if (event.target === giftsModal) {
    giftsModal.classList.remove('show')
  }
})

initializePuzzle()
