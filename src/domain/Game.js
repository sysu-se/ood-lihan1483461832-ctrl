import { createSudokuFromJSON } from './Sudoku.js'

/**
 * Game 领域对象。
 *
 * Sudoku 只关心“盘面”，Game 关心“一局游戏”：
 * - 普通模式下的 undo / redo
 * - 探索模式下的临时分支
 * - 探索失败路径的记录与检测
 * - 提示功能的统一入口
 */

/**
 * 使用 JSON 的方式深拷贝普通数据。
 *
 * @param {any} value 要复制的数据
 * @returns {any} 深拷贝后的数据
 */
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 复制一组历史快照。
 *
 * @param {Array<Object>} list 快照数组
 * @returns {Array<Object>} 新数组
 */
function copySnapshotList(list) {
  return Array.isArray(list) ? list.map((item) => deepCopy(item)) : []
}

/**
 * 把数字坐标标准化成 row / col。
 * UI 中常用 x/y，领域层常用 row/col，这里统一转换。
 *
 * @param {{row?: number, col?: number, x?: number, y?: number}} pos 坐标对象
 * @returns {{row: number, col: number}} 标准坐标
 */
function normalizePosition(pos) {
  return {
    row: Number.isInteger(pos?.row) ? pos.row : pos?.y,
    col: Number.isInteger(pos?.col) ? pos.col : pos?.x,
  }
}

/**
 * 创建一个用于显示的状态对象。
 *
 * @param {string} mode 当前模式
 * @param {boolean} failed 是否失败
 * @param {string} message 提示消息
 * @returns {{mode: string, failed: boolean, message: string}}
 */
function createStatus(mode, failed, message) {
  return { mode, failed, message }
}

/**
 * 创建 Game 对象的内部函数。
 *
 * @param {Object} options 配置对象
 * @param {Object} options.sudoku 当前主线数独
 * @param {Array<Object>} [options.undoStack=[]] 主线 undo 历史
 * @param {Array<Object>} [options.redoStack=[]] 主线 redo 历史
 * @param {string[]} [options.failedBoardKeys=[]] 已知失败探索局面
 * @param {Object|null} [options.exploration=null] 探索模式数据
 * @returns {Object} Game 对象
 */
function createGameInternal({
  sudoku,
  undoStack = [],
  redoStack = [],
  failedBoardKeys = [],
  exploration = null,
}) {
  if (!sudoku || typeof sudoku.clone !== 'function' || typeof sudoku.toJSON !== 'function') {
    throw new Error('createGame requires a valid sudoku object.')
  }

  /** @type {Object} 普通模式的主线盘面。 */
  let currentSudoku = sudoku.clone()

  /** @type {Array<Object>} 普通模式 undo 栈。 */
  let undoStackData = copySnapshotList(undoStack)

  /** @type {Array<Object>} 普通模式 redo 栈。 */
  let redoStackData = copySnapshotList(redoStack)

  /** @type {Set<string>} 已经证明失败的探索局面。 */
  const failedBoardKeySet = new Set(failedBoardKeys)

  /**
   * 探索模式状态。
   * 为 null 表示当前不是探索模式。
   *
   * @type {{sudoku: Object, undoStack: Array<Object>, redoStack: Array<Object>, base: Object}|null}
   */
  let explorationData = exploration
    ? {
        sudoku: createSudokuFromJSON(exploration.sudoku),
        undoStack: copySnapshotList(exploration.undoStack),
        redoStack: copySnapshotList(exploration.redoStack),
        base: deepCopy(exploration.base),
      }
    : null

  /**
   * 获取当前正在操作的状态。
   * 探索模式下操作探索盘面；普通模式下操作主线盘面。
   *
   * @returns {{sudoku: Object, undoStack: Array<Object>, redoStack: Array<Object>}}
   */
  function getActiveState() {
    if (explorationData) return explorationData

    return {
      sudoku: currentSudoku,
      undoStack: undoStackData,
      redoStack: redoStackData,
    }
  }

  /**
   * 把 active state 中的栈写回真实变量。
   * 普通模式下 getActiveState 返回的是临时对象，所以改完栈后需要同步。
   *
   * @param {{sudoku: Object, undoStack: Array<Object>, redoStack: Array<Object>}} active 当前活动状态
   */
  function saveActiveState(active) {
    if (explorationData) {
      explorationData.sudoku = active.sudoku
      explorationData.undoStack = active.undoStack
      explorationData.redoStack = active.redoStack
    } else {
      currentSudoku = active.sudoku
      undoStackData = active.undoStack
      redoStackData = active.redoStack
    }
  }

  /**
   * 判断当前局面是否是失败探索局面。
   * 如果盘面本身冲突，会记录为失败路径；如果盘面 key 已经记录过，也会提示失败。
   *
   * @param {Object} sudokuToCheck 要检查的数独对象
   * @returns {{failed: boolean, message: string}}
   */
  function checkFailedBoard(sudokuToCheck) {
    const boardKey = sudokuToCheck.getBoardKey()

    if (!sudokuToCheck.isValidBoard()) {
      failedBoardKeySet.add(boardKey)
      return {
        failed: true,
        message: '探索失败：当前盘面出现同行、同列或同宫冲突。可以撤销，或放弃本次探索。',
      }
    }

    if (failedBoardKeySet.has(boardKey)) {
      return {
        failed: true,
        message: '探索失败：你又走到了一个之前已经失败过的局面。建议回退并换一条路径。',
      }
    }

    return {
      failed: false,
      message: explorationData
        ? '探索中：当前分支暂时没有冲突。可以继续尝试、提交或放弃。'
        : '',
    }
  }

  /**
   * 获取当前显示给玩家看的数独。
   * 探索模式下返回探索分支，否则返回主线盘面。
   *
   * @returns {Object} 当前数独副本
   */
  function getSudoku() {
    return getActiveState().sudoku.clone()
  }

  /**
   * 执行一次填数。
   *
   * @param {Object} move 一次操作的信息
   * @returns {boolean} 是否修改成功
   */
  function guess(move) {
    const active = getActiveState()
    const oldSnapshot = active.sudoku.toJSON()
    const success = active.sudoku.guess(move)

    if (!success) return false

    active.undoStack.push(oldSnapshot)
    active.redoStack = []
    saveActiveState(active)

    if (explorationData) {
      checkFailedBoard(explorationData.sudoku)
    }

    return true
  }

  /**
   * 撤销上一步。
   * 探索模式下只撤销探索分支，不影响主线历史。
   *
   * @returns {boolean} 是否撤销成功
   */
  function undo() {
    const active = getActiveState()

    if (active.undoStack.length === 0) return false

    active.redoStack.push(active.sudoku.toJSON())
    active.sudoku = createSudokuFromJSON(active.undoStack.pop())
    saveActiveState(active)
    return true
  }

  /**
   * 重做一步。
   * 探索模式下只重做探索分支。
   *
   * @returns {boolean} 是否重做成功
   */
  function redo() {
    const active = getActiveState()

    if (active.redoStack.length === 0) return false

    active.undoStack.push(active.sudoku.toJSON())
    active.sudoku = createSudokuFromJSON(active.redoStack.pop())
    saveActiveState(active)
    return true
  }

  /**
   * 判断当前模式下是否可以撤销。
   *
   * @returns {boolean} 是否可以撤销
   */
  function canUndo() {
    return getActiveState().undoStack.length > 0
  }

  /**
   * 判断当前模式下是否可以重做。
   *
   * @returns {boolean} 是否可以重做
   */
  function canRedo() {
    return getActiveState().redoStack.length > 0
  }

  /**
   * 进入探索模式。
   * 探索分支会从当前主线盘面复制一份，之后的尝试不会直接污染主线。
   *
   * @returns {boolean} 是否成功进入探索模式
   */
  function enterExplore() {
    if (explorationData) return false

    explorationData = {
      sudoku: currentSudoku.clone(),
      undoStack: [],
      redoStack: [],
      base: currentSudoku.toJSON(),
    }

    return true
  }

  /**
   * 提交探索结果。
   * 只有探索分支没有失败时，才允许把分支合并到主线。
   *
   * @returns {boolean} 是否提交成功
   */
  function commitExplore() {
    if (!explorationData) return false

    const status = checkFailedBoard(explorationData.sudoku)
    if (status.failed) return false

    undoStackData.push(currentSudoku.toJSON())
    redoStackData = []
    currentSudoku = explorationData.sudoku.clone()
    explorationData = null
    return true
  }

  /**
   * 放弃探索结果，回到进入探索前的主线局面。
   *
   * @returns {boolean} 是否成功放弃探索
   */
  function discardExplore() {
    if (!explorationData) return false

    checkFailedBoard(explorationData.sudoku)
    explorationData = null
    return true
  }

  /**
   * 当前是否处于探索模式。
   *
   * @returns {boolean} 是否探索中
   */
  function isExploring() {
    return explorationData !== null
  }

  /**
   * 当前探索分支是否已经失败。
   *
   * @returns {boolean} 是否失败
   */
  function isExploreFailed() {
    if (!explorationData) return false
    return checkFailedBoard(explorationData.sudoku).failed
  }

  /**
   * 返回探索模式状态，用于 UI 显示。
   *
   * @returns {{mode: string, failed: boolean, message: string}} 状态对象
   */
  function getExploreStatus() {
    if (!explorationData) {
      return createStatus('normal', false, '')
    }

    const result = checkFailedBoard(explorationData.sudoku)
    return createStatus('explore', result.failed, result.message)
  }

  /**
   * 获取某格候选数。
   *
   * @param {{row?: number, col?: number, x?: number, y?: number}} pos 坐标
   * @returns {number[]} 候选数
   */
  function getCandidates(pos) {
    const { row, col } = normalizePosition(pos)
    return getActiveState().sudoku.getCandidates(row, col)
  }

  /**
   * 获取下一步提示。
   *
   * @returns {Object} 提示对象
   */
  function getHint() {
    return deepCopy(getActiveState().sudoku.findNextHint())
  }

  /**
   * 返回已经记录的失败局面 key。
   *
   * @returns {string[]} 失败局面 key 列表
   */
  function getFailedBoardKeys() {
    return Array.from(failedBoardKeySet)
  }

  /**
   * 把游戏状态转成普通 JSON。
   *
   * @returns {Object} 当前游戏状态
   */
  function toJSON() {
    return {
      sudoku: currentSudoku.toJSON(),
      undoStack: copySnapshotList(undoStackData),
      redoStack: copySnapshotList(redoStackData),
      failedBoardKeys: getFailedBoardKeys(),
      exploration: explorationData
        ? {
            sudoku: explorationData.sudoku.toJSON(),
            undoStack: copySnapshotList(explorationData.undoStack),
            redoStack: copySnapshotList(explorationData.redoStack),
            base: deepCopy(explorationData.base),
          }
        : null,
    }
  }

  /**
   * 返回当前游戏的可读描述。
   *
   * @returns {string} 游戏状态字符串
   */
  function toString() {
    const status = getExploreStatus()

    return [
      '[Game]',
      `mode=${status.mode}`,
      `canUndo=${canUndo()}`,
      `canRedo=${canRedo()}`,
      `exploreFailed=${status.failed}`,
      getActiveState().sudoku.toString(),
    ].join('\n')
  }

  return {
    getSudoku,
    guess,
    undo,
    redo,
    canUndo,
    canRedo,
    enterExplore,
    startExplore: enterExplore,
    beginExplore: enterExplore,
    commitExplore,
    commitExploration: commitExplore,
    discardExplore,
    discardExploration: discardExplore,
    isExploring,
    isExploreFailed,
    getExploreStatus,
    getCandidates,
    getHint,
    getFailedBoardKeys,
    toJSON,
    toString,
  }
}

/**
 * 创建一个新的 Game 对象。
 *
 * @param {{sudoku: Object}} options 配置对象
 * @returns {Object} Game 对象
 */
export function createGame({ sudoku }) {
  return createGameInternal({ sudoku })
}

/**
 * 根据 JSON 数据恢复 Game 对象。
 *
 * @param {Object} json 保存下来的游戏数据
 * @returns {Object} Game 对象
 */
export function createGameFromJSON(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid game JSON.')
  }

  return createGameInternal({
    sudoku: createSudokuFromJSON(json.sudoku),
    undoStack: Array.isArray(json.undoStack) ? json.undoStack : [],
    redoStack: Array.isArray(json.redoStack) ? json.redoStack : [],
    failedBoardKeys: Array.isArray(json.failedBoardKeys) ? json.failedBoardKeys : [],
    exploration: json.exploration || null,
  })
}
