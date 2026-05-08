/**
 * 复制一个 9x9 二维数组。
 * 这里用于复制数独棋盘和 fixed 标记。
 *
 * @param {number[][] | boolean[][]} matrix 原二维数组
 * @returns {number[][] | boolean[][]} 复制后的新二维数组
 */
function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice())
}

/**
 * 判断一个值是否为指定范围内的整数。
 *
 * @param {any} value 要判断的值
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {boolean} 是否满足条件
 */
function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max
}

/**
 * 检查传入的棋盘是否为合法的 9x9 数独棋盘。
 * 棋盘中的每个格子都必须是 0 到 9 的整数。
 * 其中 0 表示空格。
 *
 * @param {number[][]} grid 数独棋盘
 */
function validateGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 9) {
    throw new Error('Sudoku grid must be a 9x9 array.')
  }

  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== 9) {
      throw new Error('Sudoku grid must be a 9x9 array.')
    }

    for (const cell of row) {
      if (!isIntegerBetween(cell, 0, 9)) {
        throw new Error('Each cell must be an integer from 0 to 9.')
      }
    }
  }
}

/**
 * 检查 fixed 标记是否为合法的 9x9 二维数组。
 * fixed 用来表示哪些格子是题目原本给定、不能修改的。
 *
 * @param {boolean[][]} fixed fixed 标记数组
 */
function validateFixedMask(fixed) {
  if (!Array.isArray(fixed) || fixed.length !== 9) {
    throw new Error('Fixed mask must be a 9x9 array.')
  }

  for (const row of fixed) {
    if (!Array.isArray(row) || row.length !== 9) {
      throw new Error('Fixed mask must be a 9x9 array.')
    }

    for (const cell of row) {
      if (typeof cell !== 'boolean') {
        throw new Error('Each fixed mask cell must be boolean.')
      }
    }
  }
}

/**
 * 根据初始棋盘生成 fixed 标记。
 * 非 0 的位置说明原本就有数字，因此记为 true。
 * 0 的位置说明是空格，可以填写，因此记为 false。
 *
 * @param {number[][]} grid 数独棋盘
 * @returns {boolean[][]} fixed 标记数组
 */
function buildFixedMask(grid) {
  return grid.map((row) => row.map((cellValue) => cellValue !== 0))
}

/**
 * 检查行号、列号是否合法。
 *
 * @param {number} row 行号
 * @param {number} col 列号
 */
function validatePosition(row, col) {
  if (!isIntegerBetween(row, 0, 8)) {
    throw new Error('row must be an integer from 0 to 8.')
  }

  if (!isIntegerBetween(col, 0, 8)) {
    throw new Error('col must be an integer from 0 to 8.')
  }
}

/**
 * 规范化一次输入操作 move。
 * 支持：
 * - row: 0~8
 * - col: 0~8
 * - value: null 或 0~9
 *
 * 其中 null 会被转换成 0，表示清空该格子。
 *
 * @param {Object} move 用户输入的一步操作
 * @param {number} move.row 行号
 * @param {number} move.col 列号
 * @param {number|null} move.value 要填入的值
 * @returns {{row:number, col:number, value:number}} 规范化后的操作
 */
function normalizeMove(move) {
  if (!move || typeof move !== 'object') {
    throw new Error('move must be an object.')
  }

  const { row, col, value } = move

  validatePosition(row, col)

  const normalizedValue = value === null ? 0 : value

  if (!isIntegerBetween(normalizedValue, 0, 9)) {
    throw new Error('move.value must be null or an integer from 0 to 9.')
  }

  return {
    row,
    col,
    value: normalizedValue,
  }
}

/**
 * 判断某个格子当前位置是否发生冲突。
 * 冲突包括：
 * 1. 同一行重复
 * 2. 同一列重复
 * 3. 同一个 3x3 宫内重复
 *
 * 如果当前格子为 0，则认为不冲突。
 *
 * @param {number[][]} grid 数独棋盘
 * @param {number} row 行号
 * @param {number} col 列号
 * @returns {boolean} 是否冲突
 */
function hasConflictAt(grid, row, col) {
  const currentValue = grid[row][col]

  if (currentValue === 0) {
    return false
  }

  for (let currentCol = 0; currentCol < 9; currentCol++) {
    if (currentCol !== col && grid[row][currentCol] === currentValue) {
      return true
    }
  }

  for (let currentRow = 0; currentRow < 9; currentRow++) {
    if (currentRow !== row && grid[currentRow][col] === currentValue) {
      return true
    }
  }

  const boxStartRow = Math.floor(row / 3) * 3
  const boxStartCol = Math.floor(col / 3) * 3

  for (let currentRow = boxStartRow; currentRow < boxStartRow + 3; currentRow++) {
    for (let currentCol = boxStartCol; currentCol < boxStartCol + 3; currentCol++) {
      const isSameCell = currentRow === row && currentCol === col

      if (!isSameCell && grid[currentRow][currentCol] === currentValue) {
        return true
      }
    }
  }

  return false
}

/**
 * 判断 value 能不能放在指定位置。
 * 注意：这里不会修改棋盘，只是检查行、列、宫中是否已经有相同数字。
 *
 * @param {number[][]} grid 数独棋盘
 * @param {number} row 行号
 * @param {number} col 列号
 * @param {number} value 要检查的数字，必须是 1~9
 * @returns {boolean} 是否可以放置
 */
function canValueExistAt(grid, row, col, value) {
  if (!isIntegerBetween(value, 1, 9)) {
    return false
  }

  for (let currentCol = 0; currentCol < 9; currentCol++) {
    if (currentCol !== col && grid[row][currentCol] === value) {
      return false
    }
  }

  for (let currentRow = 0; currentRow < 9; currentRow++) {
    if (currentRow !== row && grid[currentRow][col] === value) {
      return false
    }
  }

  const boxStartRow = Math.floor(row / 3) * 3
  const boxStartCol = Math.floor(col / 3) * 3

  for (let currentRow = boxStartRow; currentRow < boxStartRow + 3; currentRow++) {
    for (let currentCol = boxStartCol; currentCol < boxStartCol + 3; currentCol++) {
      const isSameCell = currentRow === row && currentCol === col

      if (!isSameCell && grid[currentRow][currentCol] === value) {
        return false
      }
    }
  }

  return true
}

/**
 * 创建一个 Sudoku 领域对象。
 * 这个对象负责管理：
 * 1. 当前棋盘
 * 2. 哪些格子是固定的
 * 3. 棋盘状态判断
 * 4. HW2 提示功能的基础逻辑
 *
 * @param {number[][]} input 初始棋盘
 * @param {Object} [options={}] 可选配置
 * @param {boolean[][]} [options.fixed] 自定义 fixed 标记
 * @returns {Object} Sudoku 对象
 */
export function createSudoku(input, options = {}) {
  validateGrid(input)

  const fixedMask =
    options.fixed === undefined
      ? buildFixedMask(input)
      : cloneMatrix(options.fixed)

  validateFixedMask(fixedMask)

  /** @type {number[][]} 当前棋盘 */
  let currentGrid = cloneMatrix(input)

  /**
   * 获取当前棋盘的副本。
   * 返回副本而不是原对象，是为了避免外部直接修改内部状态。
   *
   * @returns {number[][]} 当前棋盘副本
   */
  function getGrid() {
    return cloneMatrix(currentGrid)
  }

  /**
   * 获取 fixed 标记的副本。
   *
   * @returns {boolean[][]} fixed 标记副本
   */
  function getFixedMask() {
    return cloneMatrix(fixedMask)
  }

  /**
   * 判断一个格子是不是题目原本给定的固定格。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {boolean} 是否固定
   */
  function isFixedCell(row, col) {
    validatePosition(row, col)
    return fixedMask[row][col]
  }

  /**
   * 在棋盘上尝试填写一次数字。
   * 规则：
   * 1. 固定格不能改
   * 2. 如果新值和原值一样，也不算修改
   * 3. 允许填 0，表示清空
   *
   * 注意：这里只负责修改，不负责阻止冲突。
   * 也就是说，即使填完后棋盘冲突，这一步仍然可以成功。
   *
   * @param {{row:number, col:number, value:number|null}} move 一次填写操作
   * @returns {boolean} 是否修改成功
   */
  function guess(move) {
    const { row, col, value } = normalizeMove(move)

    if (fixedMask[row][col]) {
      return false
    }

    if (currentGrid[row][col] === value) {
      return false
    }

    currentGrid[row][col] = value
    return true
  }

  /**
   * 判断某个值是否可以放入指定格子。
   * 这个函数不会修改棋盘，主要给 Hint / Explore / Game 使用。
   *
   * value 为 0 时表示清空，只要不是固定格，就认为可以。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @param {number|null} value 要尝试的值
   * @returns {boolean} 是否可以放置
   */
  function canPlaceValue(row, col, value) {
    validatePosition(row, col)

    const normalizedValue = value === null ? 0 : value

    if (!isIntegerBetween(normalizedValue, 0, 9)) {
      throw new Error('value must be null or an integer from 0 to 9.')
    }

    if (fixedMask[row][col]) {
      return false
    }

    if (normalizedValue === 0) {
      return true
    }

    return canValueExistAt(currentGrid, row, col, normalizedValue)
  }

  /**
   * 获取某个空格的候选数。
   *
   * 规则：
   * 1. 固定格没有候选数
   * 2. 已经填了数字的格子没有候选数
   * 3. 空格的候选数来自 1~9
   * 4. 候选数不能和当前行、列、宫冲突
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {number[]} 候选数数组
   */
  function getCandidates(row, col) {
    validatePosition(row, col)

    if (fixedMask[row][col]) {
      return []
    }

    if (currentGrid[row][col] !== 0) {
      return []
    }

    const candidates = []

    for (let value = 1; value <= 9; value++) {
      if (canValueExistAt(currentGrid, row, col, value)) {
        candidates.push(value)
      }
    }

    return candidates
  }

  /**
   * 获取某一个格子的提示信息。
   * 这是给 UI 使用的比较友好的接口。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {Object} 该格子的提示信息
   */
  function getHintForCell(row, col) {
    validatePosition(row, col)

    const currentValue = currentGrid[row][col]
    const fixed = fixedMask[row][col]

    if (fixed) {
      return {
        type: 'fixed',
        row,
        col,
        value: currentValue,
        candidates: [],
        message: 'This cell is fixed and cannot be changed.',
      }
    }

    if (currentValue !== 0) {
      return {
        type: 'filled',
        row,
        col,
        value: currentValue,
        candidates: [],
        message: 'This cell already has a value.',
      }
    }

    const candidates = getCandidates(row, col)

    if (candidates.length === 0) {
      return {
        type: 'noCandidate',
        row,
        col,
        value: null,
        candidates,
        message: 'This cell has no legal candidate. The board may already contain a contradiction.',
      }
    }

    if (candidates.length === 1) {
      return {
        type: 'singleCandidate',
        row,
        col,
        value: candidates[0],
        candidates,
        message: `Only ${candidates[0]} can be placed in this cell.`,
      }
    }

    return {
      type: 'candidates',
      row,
      col,
      value: null,
      candidates,
      message: `Possible candidates are: ${candidates.join(', ')}.`,
    }
  }

  /**
   * 获取所有空格的候选数列表。
   * 返回格式适合 Game 或 UI 继续处理。
   *
   * @returns {{row:number, col:number, candidates:number[]}[]} 所有空格候选数
   */
  function getCandidateList() {
    const result = []

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (!fixedMask[row][col] && currentGrid[row][col] === 0) {
          result.push({
            row,
            col,
            candidates: getCandidates(row, col),
          })
        }
      }
    }

    return result
  }

  /**
   * 获取 9x9 形式的候选数表。
   * 每个位置都是一个数组。
   * 固定格和已填格返回空数组。
   *
   * @returns {number[][][]} 9x9 候选数表
   */
  function getCandidateMap() {
    const map = []

    for (let row = 0; row < 9; row++) {
      const currentRow = []

      for (let col = 0; col < 9; col++) {
        currentRow.push(getCandidates(row, col))
      }

      map.push(currentRow)
    }

    return map
  }

  /**
   * 获取下一步提示。
   *
   * 这里使用的是比较容易理解的策略：
   * 1. 如果棋盘已经冲突，返回 conflict
   * 2. 如果某个空格没有任何候选数，返回 contradiction
   * 3. 如果某个空格只有一个候选数，返回 singleCandidate
   * 4. 如果没有唯一候选数，但还有空格，返回 explore，提示用户进入探索模式
   * 5. 如果棋盘已经完成，返回 complete
   *
   * @returns {Object|null} 下一步提示
   */
  function getNextHint() {
    const conflictCells = getConflictCells()

    if (conflictCells.length > 0) {
      return {
        type: 'conflict',
        row: conflictCells[0].row,
        col: conflictCells[0].col,
        value: currentGrid[conflictCells[0].row][conflictCells[0].col],
        candidates: [],
        message: 'The board has conflicts. Please fix the conflicting cells first.',
      }
    }

    if (isComplete()) {
      return {
        type: 'complete',
        row: null,
        col: null,
        value: null,
        candidates: [],
        message: 'The puzzle is complete.',
      }
    }

    const candidateList = getCandidateList()

    for (const item of candidateList) {
      if (item.candidates.length === 0) {
        return {
          type: 'contradiction',
          row: item.row,
          col: item.col,
          value: null,
          candidates: [],
          message: 'This empty cell has no legal candidate. The current path may be wrong.',
        }
      }
    }

    for (const item of candidateList) {
      if (item.candidates.length === 1) {
        return {
          type: 'singleCandidate',
          row: item.row,
          col: item.col,
          value: item.candidates[0],
          candidates: item.candidates,
          message: `Cell (${item.row + 1}, ${item.col + 1}) has only one candidate: ${item.candidates[0]}.`,
        }
      }
    }

    let bestExploreCell = null

    for (const item of candidateList) {
      if (item.candidates.length > 1) {
        if (
          bestExploreCell === null ||
          item.candidates.length < bestExploreCell.candidates.length
        ) {
          bestExploreCell = item
        }
      }
    }

    if (bestExploreCell !== null) {
      return {
        type: 'explore',
        row: bestExploreCell.row,
        col: bestExploreCell.col,
        value: null,
        candidates: bestExploreCell.candidates,
        message:
          `No single-candidate move is available. ` +
          `You can explore cell (${bestExploreCell.row + 1}, ${bestExploreCell.col + 1}) ` +
          `with candidates: ${bestExploreCell.candidates.join(', ')}.`,
      }
    }

    return null
  }

  /**
   * 复制当前 Sudoku 对象。
   * 新对象和原对象内容相同，但互不影响。
   *
   * @returns {Object} 新的 Sudoku 对象
   */
  function clone() {
    return createSudoku(getGrid(), { fixed: getFixedMask() })
  }

  /**
   * 判断指定位置的格子是否冲突。
   * 如果 row 或 col 超出范围，直接返回 false。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {boolean} 该格子是否冲突
   */
  function isConflictingCell(row, col) {
    if (!isIntegerBetween(row, 0, 8) || !isIntegerBetween(col, 0, 8)) {
      return false
    }

    return hasConflictAt(currentGrid, row, col)
  }

  /**
   * 获取当前所有冲突格子。
   * 这个方法可以给 Explore Mode 判断“探索失败”使用。
   *
   * @returns {{row:number, col:number, value:number}[]} 冲突格子列表
   */
  function getConflictCells() {
    const result = []

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (hasConflictAt(currentGrid, row, col)) {
          result.push({
            row,
            col,
            value: currentGrid[row][col],
          })
        }
      }
    }

    return result
  }

  /**
   * 判断当前棋盘是否存在冲突。
   *
   * @returns {boolean} 是否存在冲突
   */
  function hasConflict() {
    return getConflictCells().length > 0
  }

  /**
   * 判断整个棋盘当前是否有效。
   * 只要存在任意一个冲突格子，就说明棋盘无效。
   *
   * @returns {boolean} 当前棋盘是否有效
   */
  function isValidBoard() {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (hasConflictAt(currentGrid, row, col)) {
          return false
        }
      }
    }

    return true
  }

  /**
   * 获取所有空格。
   *
   * @returns {{row:number, col:number}[]} 空格列表
   */
  function getEmptyCells() {
    const result = []

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (currentGrid[row][col] === 0) {
          result.push({ row, col })
        }
      }
    }

    return result
  }

  /**
   * 获取当前空格数量。
   *
   * @returns {number} 空格数量
   */
  function countEmptyCells() {
    return getEmptyCells().length
  }

  /**
   * 判断当前棋盘是否已经完成。
   * 完成需要满足两个条件：
   * 1. 没有空格（没有 0）
   * 2. 整个棋盘没有冲突
   *
   * @returns {boolean} 是否完成
   */
  function isComplete() {
    return countEmptyCells() === 0 && isValidBoard()
  }

  /**
   * 获取当前棋盘的签名。
   * 这个方法主要给 Explore Mode 的“失败路径记忆”使用。
   *
   * 例如：
   * Game 可以把失败局面的 signature 存进 Set。
   * 以后探索到同一个 signature 时，就可以提示用户：
   * “这个探索路径之前已经失败过。”
   *
   * @returns {string} 当前棋盘签名
   */
  function getBoardSignature() {
    return JSON.stringify(currentGrid)
  }

  /**
   * 把当前 Sudoku 对象转成 JSON 数据。
   * 可用于保存、传输或恢复。
   *
   * @returns {{grid:number[][], fixed:boolean[][]}} 当前对象的 JSON 数据
   */
  function toJSON() {
    return {
      grid: getGrid(),
      fixed: getFixedMask(),
    }
  }

  /**
   * 把当前棋盘转成字符串，方便调试查看。
   * 空格会显示为 "."。
   *
   * @returns {string} 棋盘字符串
   */
  function toString() {
    const lines = []

    for (let row = 0; row < 9; row++) {
      const rowValues = currentGrid[row].map((cellValue) =>
        cellValue === 0 ? '.' : String(cellValue)
      )

      lines.push(
        rowValues.slice(0, 3).join(' ') +
          ' | ' +
          rowValues.slice(3, 6).join(' ') +
          ' | ' +
          rowValues.slice(6, 9).join(' ')
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

    guess,
    canPlaceValue,

    getCandidates,
    getHintForCell,
    getCandidateList,
    getCandidateMap,
    getNextHint,

    clone,
    toJSON,
    toString,

    isConflictingCell,
    getConflictCells,
    hasConflict,
    isValidBoard,
    isComplete,

    getEmptyCells,
    countEmptyCells,
    getBoardSignature,
  }
}

/**
 * 根据 JSON 数据恢复一个 Sudoku 对象。
 *
 * @param {{grid:number[][], fixed?:boolean[][]}} json 保存下来的 Sudoku 数据
 * @returns {Object} Sudoku 对象
 */
export function createSudokuFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid sudoku JSON.')
  }

  if (json.fixed === undefined) {
    return createSudoku(json.grid)
  }

  return createSudoku(json.grid, { fixed: json.fixed })
}
