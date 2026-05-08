/**
 * Sudoku 领域对象。
 *
 * 这个文件只处理“一个 9x9 数独局面”本身：
 * - 保存当前盘面
 * - 判断某格能填哪些候选数
 * - 判断冲突/失败/完成
 * - 支持克隆与 JSON 序列化
 *
 * 注意：这里不处理 UI，也不处理 undo/redo。undo/redo 属于 Game 的职责。
 */

/** 数独盘面边长。 */
const SIZE = 9

/** 每个小宫的边长。 */
const BOX_SIZE = 3

/** 空格统一用 0 表示。 */
const EMPTY = 0

/**
 * 使用 JSON 做深拷贝。
 * 当前项目中的数据都是普通数组/对象，所以这种写法足够直观。
 *
 * @param {any} value 要复制的数据
 * @returns {any} 深拷贝后的数据
 */
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 判断坐标是否在 9x9 数独范围内。
 *
 * @param {number} row 行号，0 到 8
 * @param {number} col 列号，0 到 8
 * @returns {boolean} 坐标是否合法
 */
function isInsideBoard(row, col) {
  return Number.isInteger(row) && Number.isInteger(col)
    && row >= 0 && row < SIZE
    && col >= 0 && col < SIZE
}

/**
 * 判断一个值是否是允许写入格子的数字。
 * 0 表示清空格子，1-9 表示填写数字。
 *
 * @param {number} value 要检查的值
 * @returns {boolean} 是否合法
 */
function isAllowedCellValue(value) {
  return Number.isInteger(value) && value >= 0 && value <= 9
}

/**
 * 检查传入的 grid 是否是 9x9 数字数组。
 *
 * @param {number[][]} grid 待检查的盘面
 */
function validateGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE) {
    throw new Error('Sudoku grid must be a 9x9 array.')
  }

  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== SIZE) {
      throw new Error('Sudoku grid must be a 9x9 array.')
    }

    for (const value of row) {
      if (!isAllowedCellValue(value)) {
        throw new Error('Sudoku cells must be integers from 0 to 9.')
      }
    }
  }
}

/**
 * 根据初始盘面生成 fixed 标记。
 * fixed[row][col] 为 true 表示这格是题目给出的固定数字，玩家不能修改。
 *
 * @param {number[][]} grid 初始盘面
 * @returns {boolean[][]} 固定格标记
 */
function createFixedMaskFromGrid(grid) {
  return grid.map((row) => row.map((value) => value !== EMPTY))
}

/**
 * 检查 fixed 是否是 9x9 布尔数组。
 *
 * @param {boolean[][]} fixed 固定格标记
 */
function validateFixedMask(fixed) {
  if (!Array.isArray(fixed) || fixed.length !== SIZE) {
    throw new Error('Fixed mask must be a 9x9 array.')
  }

  for (const row of fixed) {
    if (!Array.isArray(row) || row.length !== SIZE) {
      throw new Error('Fixed mask must be a 9x9 array.')
    }

    for (const value of row) {
      if (typeof value !== 'boolean') {
        throw new Error('Fixed mask cells must be boolean values.')
      }
    }
  }
}

/**
 * 把冲突坐标加入 Set。
 * Set 中使用 "row,col" 字符串，是为了去重。
 *
 * @param {Set<string>} conflictKeys 冲突坐标集合
 * @param {number} row 行号
 * @param {number} col 列号
 */
function addConflict(conflictKeys, row, col) {
  conflictKeys.add(`${row},${col}`)
}

/**
 * 创建一个 Sudoku 对象。
 *
 * @param {number[][]} grid 9x9 数独盘面，0 表示空格
 * @param {{fixed?: boolean[][]}} [options] 可选配置
 * @returns {Object} Sudoku 对象
 */
export function createSudoku(grid, options = {}) {
  validateGrid(grid)

  /** @type {number[][]} 当前盘面；内部永远保存自己的深拷贝。 */
  let currentGrid = deepCopy(grid)

  /** @type {boolean[][]} 固定格标记。 */
  let fixedMask = options.fixed
    ? deepCopy(options.fixed)
    : createFixedMaskFromGrid(currentGrid)

  validateFixedMask(fixedMask)

  /**
   * 返回当前盘面的深拷贝。
   * 外部拿到这个数组后，即使修改它，也不会污染 Sudoku 内部状态。
   *
   * @returns {number[][]} 当前盘面
   */
  function getGrid() {
    return deepCopy(currentGrid)
  }

  /**
   * 返回固定格标记的深拷贝。
   *
   * @returns {boolean[][]} 固定格标记
   */
  function getFixedMask() {
    return deepCopy(fixedMask)
  }

  /**
   * 判断某格是否是题目给出的固定格。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {boolean} 是否固定
   */
  function isFixedCell(row, col) {
    if (!isInsideBoard(row, col)) return false
    return fixedMask[row][col]
  }

  /**
   * 判断在指定位置填 value 是否会和同行/同列/同宫冲突。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @param {number} value 要尝试的数字，1 到 9
   * @returns {boolean} 是否可以填入
   */
  function canPlaceValue(row, col, value) {
    if (!isInsideBoard(row, col) || value < 1 || value > 9) {
      return false
    }

    for (let index = 0; index < SIZE; index++) {
      if (index !== col && currentGrid[row][index] === value) return false
      if (index !== row && currentGrid[index][col] === value) return false
    }

    const startRow = Math.floor(row / BOX_SIZE) * BOX_SIZE
    const startCol = Math.floor(col / BOX_SIZE) * BOX_SIZE

    for (let r = startRow; r < startRow + BOX_SIZE; r++) {
      for (let c = startCol; c < startCol + BOX_SIZE; c++) {
        const sameCell = r === row && c === col
        if (!sameCell && currentGrid[r][c] === value) return false
      }
    }

    return true
  }

  /**
   * 返回某个空格当前可以填写的候选数。
   * 固定格或已经填了数字的格子没有候选数。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {number[]} 可以填写的候选数字列表
   */
  function getCandidates(row, col) {
    if (!isInsideBoard(row, col)) return []
    if (fixedMask[row][col] || currentGrid[row][col] !== EMPTY) return []

    const candidates = []

    for (let value = 1; value <= 9; value++) {
      if (canPlaceValue(row, col, value)) {
        candidates.push(value)
      }
    }

    return candidates
  }

  /**
   * 返回所有空格的候选数。
   * key 使用 "row,col"，便于保存和调试。
   *
   * @returns {Record<string, number[]>} 全盘候选数
   */
  function getAllCandidates() {
    const result = {}

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (currentGrid[row][col] === EMPTY && !fixedMask[row][col]) {
          result[`${row},${col}`] = getCandidates(row, col)
        }
      }
    }

    return result
  }

  /**
   * 执行一次填数操作。
   *
   * move 支持两种坐标写法：
   * - 领域层写法：{ row, col, value }
   * - UI 层写法：{ x, y, value }
   *
   * @param {{row?: number, col?: number, x?: number, y?: number, value: number}} move 操作数据
   * @returns {boolean} 是否成功修改
   */
  function guess(move) {
    if (!move || typeof move !== 'object') return false

    const row = Number.isInteger(move.row) ? move.row : move.y
    const col = Number.isInteger(move.col) ? move.col : move.x
    const value = move.value

    if (!isInsideBoard(row, col)) return false
    if (!isAllowedCellValue(value)) return false
    if (fixedMask[row][col]) return false

    currentGrid[row][col] = value
    return true
  }

  /**
   * 生成一个独立的 Sudoku 副本。
   *
   * @returns {Object} 新的 Sudoku 对象
   */
  function clone() {
    return createSudoku(currentGrid, { fixed: fixedMask })
  }

  /**
   * 判断一个格子是否处在冲突中。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {boolean} 是否冲突
   */
  function isConflictingCell(row, col) {
    if (!isInsideBoard(row, col)) return false

    const value = currentGrid[row][col]
    if (value === EMPTY) return false

    return !canPlaceValue(row, col, value)
  }

  /**
   * 找出当前所有冲突格。
   *
   * @returns {{row: number, col: number}[]} 冲突格坐标列表
   */
  function getConflictCells() {
    const conflictKeys = new Set()

    for (let row = 0; row < SIZE; row++) {
      const seen = new Map()
      for (let col = 0; col < SIZE; col++) {
        const value = currentGrid[row][col]
        if (value === EMPTY) continue

        if (seen.has(value)) {
          addConflict(conflictKeys, row, col)
          addConflict(conflictKeys, row, seen.get(value))
        } else {
          seen.set(value, col)
        }
      }
    }

    for (let col = 0; col < SIZE; col++) {
      const seen = new Map()
      for (let row = 0; row < SIZE; row++) {
        const value = currentGrid[row][col]
        if (value === EMPTY) continue

        if (seen.has(value)) {
          addConflict(conflictKeys, row, col)
          addConflict(conflictKeys, seen.get(value), col)
        } else {
          seen.set(value, row)
        }
      }
    }

    for (let boxRow = 0; boxRow < SIZE; boxRow += BOX_SIZE) {
      for (let boxCol = 0; boxCol < SIZE; boxCol += BOX_SIZE) {
        const seen = new Map()

        for (let row = boxRow; row < boxRow + BOX_SIZE; row++) {
          for (let col = boxCol; col < boxCol + BOX_SIZE; col++) {
            const value = currentGrid[row][col]
            if (value === EMPTY) continue

            if (seen.has(value)) {
              const first = seen.get(value)
              addConflict(conflictKeys, row, col)
              addConflict(conflictKeys, first.row, first.col)
            } else {
              seen.set(value, { row, col })
            }
          }
        }
      }
    }

    return Array.from(conflictKeys).map((key) => {
      const [row, col] = key.split(',').map(Number)
      return { row, col }
    })
  }

  /**
   * 判断当前盘面是否没有冲突。
   *
   * @returns {boolean} 是否有效
   */
  function isValidBoard() {
    return getConflictCells().length === 0
  }

  /**
   * 判断当前盘面是否已经失败。
   * 在本作业中，“失败”就是已经出现同行/同列/同宫冲突。
   *
   * @returns {boolean} 是否失败
   */
  function isFailed() {
    return !isValidBoard()
  }

  /**
   * 判断数独是否填满且没有冲突。
   *
   * @returns {boolean} 是否完成
   */
  function isComplete() {
    if (!isValidBoard()) return false

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (currentGrid[row][col] === EMPTY) return false
      }
    }

    return true
  }

  /**
   * 给出一个“下一步提示”。
   * 优先返回唯一候选数的格子；如果没有唯一候选数，则返回候选数最少的空格，方便玩家继续推理。
   *
   * @returns {{type: string, row: number|null, col: number|null, value: number|null, candidates: number[], reason: string}}
   * 提示对象
   */
  function findNextHint() {
    if (!isValidBoard()) {
      return {
        type: 'conflict',
        row: null,
        col: null,
        value: null,
        candidates: [],
        reason: '当前盘面已经出现冲突，请先撤销或修改冲突数字。',
      }
    }

    /** @type {{row: number, col: number, candidates: number[]} | null} */
    let best = null

    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        if (currentGrid[row][col] !== EMPTY) continue

        const candidates = getCandidates(row, col)

        if (candidates.length === 1) {
          return {
            type: 'single',
            row,
            col,
            value: candidates[0],
            candidates,
            reason: '这个格子只有一个候选数，可以直接填写。',
          }
        }

        if (candidates.length > 0 && (!best || candidates.length < best.candidates.length)) {
          best = { row, col, candidates }
        }
      }
    }

    if (best) {
      return {
        type: 'candidate',
        row: best.row,
        col: best.col,
        value: null,
        candidates: best.candidates,
        reason: '当前没有唯一候选数，先从候选数最少的格子开始探索。',
      }
    }

    return {
      type: isComplete() ? 'complete' : 'blocked',
      row: null,
      col: null,
      value: null,
      candidates: [],
      reason: isComplete() ? '数独已经完成。' : '当前没有可用候选数。',
    }
  }

  /**
   * 生成当前盘面的唯一字符串。
   * 用于 Game 判断“是否又走到了一个已经失败的探索局面”。
   *
   * @returns {string} 盘面 key
   */
  function getBoardKey() {
    return currentGrid.flat().join('')
  }

  /**
   * 把当前 Sudoku 对象转成普通 JSON 数据。
   *
   * @returns {{grid: number[][], fixed: boolean[][]}} 可序列化数据
   */
  function toJSON() {
    return {
      grid: getGrid(),
      fixed: getFixedMask(),
    }
  }

  /**
   * 把当前棋盘转成方便阅读的字符串。
   *
   * @returns {string} 棋盘字符串
   */
  function toString() {
    const lines = []

    for (let row = 0; row < SIZE; row++) {
      const rowValues = currentGrid[row].map((cellValue) => (
        cellValue === EMPTY ? '.' : String(cellValue)
      ))

      lines.push(
        `${rowValues.slice(0, 3).join(' ')} | ${rowValues.slice(3, 6).join(' ')} | ${rowValues.slice(6, 9).join(' ')}`
      )

      if (row === 2 || row === 5) {
        lines.push('------+-------+------')
      }
    }

    return lines.join('\n')
  }

  return {
    getGrid,
    getFixedMask,
    isFixedCell,
    getCandidates,
    getAllCandidates,
    findNextHint,
    guess,
    clone,
    toJSON,
    toString,
    isConflictingCell,
    getConflictCells,
    isValidBoard,
    isFailed,
    isComplete,
    getBoardKey,
  }
}

/**
 * 根据 JSON 数据恢复一个 Sudoku 对象。
 *
 * @param {{grid: number[][], fixed?: boolean[][]}} json 保存下来的 Sudoku 数据
 * @returns {Object} Sudoku 对象
 */
export function createSudokuFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid sudoku JSON.')
  }

  return createSudoku(json.grid, { fixed: json.fixed })
}
