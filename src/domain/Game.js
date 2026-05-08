import { createSudokuFromJSON } from './Sudoku.js'

/**
 * 使用 JSON 的方式做深拷贝。
 * 本项目里保存的快照都是普通对象和数组，所以这种方式够用。
 *
 * @param {any} value 要复制的数据
 * @returns {any} 复制后的新数据
 */
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * 复制一组历史快照。
 * undoStack / redoStack / exploreStack 里保存的都是 Sudoku 的 JSON 快照。
 *
 * @param {Array<Object>} list 快照数组
 * @returns {Array<Object>} 复制后的快照数组
 */
function copySnapshotList(list) {
  return list.map((item) => deepCopy(item))
}

/**
 * 判断两个快照是否相同。
 * 这里用于提交 Explore 时判断棋盘有没有真的发生变化。
 *
 * @param {Object} a 快照 A
 * @param {Object} b 快照 B
 * @returns {boolean} 是否相同
 */
function isSameSnapshot(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * 创建 Game 对象的内部函数。
 *
 * Game 负责：
 * 1. 持有当前 Sudoku
 * 2. 管理普通模式下的 Undo / Redo
 * 3. 管理 Explore 模式下的独立 Undo / Redo
 * 4. 提供 Hint 相关接口
 * 5. 记录失败的探索路径
 *
 * @param {Object} options 配置对象
 * @param {Object} options.sudoku 当前数独对象
 * @param {Array<Object>} [options.undoStack=[]] 普通 undo 历史
 * @param {Array<Object>} [options.redoStack=[]] 普通 redo 历史
 * @param {'normal'|'explore'} [options.mode='normal'] 当前模式
 * @param {Object|null} [options.exploreBaseSnapshot=null] 探索起点快照
 * @param {Array<Object>} [options.exploreUndoStack=[]] 探索 undo 历史
 * @param {Array<Object>} [options.exploreRedoStack=[]] 探索 redo 历史
 * @param {Array<string>} [options.failedExploreSignatures=[]] 已失败探索局面签名
 * @returns {Object} Game 对象
 */
function createGameInternal({
  sudoku,
  undoStack = [],
  redoStack = [],
  mode = 'normal',
  exploreBaseSnapshot = null,
  exploreUndoStack = [],
  exploreRedoStack = [],
  failedExploreSignatures = [],
}) {
  if (!sudoku || typeof sudoku.clone !== 'function' || typeof sudoku.toJSON !== 'function') {
    throw new Error('createGame requires a valid sudoku object.')
  }

  /** 当前真正使用的 Sudoku 对象 */
  let currentSudoku = sudoku.clone()

  /** 普通模式 undo 栈 */
  let undoStackData = copySnapshotList(undoStack)

  /** 普通模式 redo 栈 */
  let redoStackData = copySnapshotList(redoStack)

  /**
   * 当前 Game 模式。
   * normal：正常填写
   * explore：探索模式
   */
  let gameMode = mode === 'explore' ? 'explore' : 'normal'

  /**
   * 探索模式开始时的棋盘快照。
   * 放弃探索时，回到这个快照。
   * 提交探索时，把这个快照压入普通 undo 栈。
   */
  let exploreBaseSnapshotData = exploreBaseSnapshot === null
    ? null
    : deepCopy(exploreBaseSnapshot)

  /** 探索模式独立 undo 栈 */
  let exploreUndoStackData = copySnapshotList(exploreUndoStack)

  /** 探索模式独立 redo 栈 */
  let exploreRedoStackData = copySnapshotList(exploreRedoStack)

  /**
   * 失败探索路径记忆。
   * 用 Set 是因为我们只关心某个棋盘签名是否已经失败过。
   */
  let failedExploreSignaturesData = new Set(
    Array.isArray(failedExploreSignatures) ? failedExploreSignatures : []
  )

  /**
   * 如果从 JSON 恢复时 mode 是 explore，
   * 但没有 exploreBaseSnapshot，则自动把当前局面作为探索起点。
   */
  if (gameMode === 'explore' && exploreBaseSnapshotData === null) {
    exploreBaseSnapshotData = currentSudoku.toJSON()
  }

  /**
   * 获取当前数独对象的副本。
   * 返回 clone，防止 UI 或外部代码直接修改 Game 内部状态。
   *
   * @returns {Object} 当前 Sudoku 的副本
   */
  function getSudoku() {
    return currentSudoku.clone()
  }

  /**
   * 获取当前游戏模式。
   *
   * @returns {'normal'|'explore'} 当前模式
   */
  function getMode() {
    return gameMode
  }

  /**
   * 判断当前是否处于探索模式。
   *
   * @returns {boolean} 是否正在探索
   */
  function isExploring() {
    return gameMode === 'explore'
  }

  /**
   * 获取当前棋盘签名。
   * 用于失败探索路径记忆。
   *
   * @returns {string} 当前棋盘签名
   */
  function getCurrentBoardSignature() {
    if (typeof currentSudoku.getBoardSignature === 'function') {
      return currentSudoku.getBoardSignature()
    }

    return JSON.stringify(currentSudoku.getGrid())
  }

  /**
   * 分析当前局面是否是失败探索局面。
   *
   * 失败包括三种：
   * 1. 当前局面以前已经被记录为失败
   * 2. 当前棋盘存在冲突
   * 3. 当前棋盘出现了没有候选数的空格
   *
   * @returns {Object} 失败分析结果
   */
  function analyzeCurrentFailure() {
    const signature = getCurrentBoardSignature()

    if (failedExploreSignaturesData.has(signature)) {
      return {
        failed: true,
        reason: 'knownFailedPath',
        signature,
        message: 'This board was already recorded as a failed explore path.',
      }
    }

    if (
      typeof currentSudoku.hasConflict === 'function' &&
      currentSudoku.hasConflict()
    ) {
      return {
        failed: true,
        reason: 'conflict',
        signature,
        conflictCells:
          typeof currentSudoku.getConflictCells === 'function'
            ? currentSudoku.getConflictCells()
            : [],
        message: 'The current explore board has conflicts.',
      }
    }

    if (typeof currentSudoku.getNextHint === 'function') {
      const hint = currentSudoku.getNextHint()

      if (hint && hint.type === 'contradiction') {
        return {
          failed: true,
          reason: 'contradiction',
          signature,
          hint,
          message: 'The current explore board has an empty cell with no legal candidate.',
        }
      }
    }

    return {
      failed: false,
      reason: null,
      signature,
      message: 'The current board is not known as a failed explore path.',
    }
  }

  /**
   * 如果当前探索局面已经失败，就把它记录进失败路径集合。
   *
   * @returns {boolean} 是否记录了失败路径
   */
  function rememberFailedExploreIfNeeded() {
    const failure = analyzeCurrentFailure()

    if (
      failure.failed &&
      failure.reason !== 'knownFailedPath' &&
      failure.signature
    ) {
      failedExploreSignaturesData.add(failure.signature)
      return true
    }

    return false
  }

  /**
   * 执行一次填数操作。
   *
   * 普通模式：
   * - 使用普通 undoStack / redoStack
   *
   * 探索模式：
   * - 使用 exploreUndoStack / exploreRedoStack
   * - 不污染主历史
   *
   * @param {Object} move 一次操作的信息
   * @returns {boolean} 是否修改成功
   */
  function guess(move) {
    const oldSnapshot = currentSudoku.toJSON()
    const success = currentSudoku.guess(move)

    if (!success) {
      return false
    }

    if (isExploring()) {
      exploreUndoStackData.push(oldSnapshot)
      exploreRedoStackData = []
      rememberFailedExploreIfNeeded()
    } else {
      undoStackData.push(oldSnapshot)
      redoStackData = []
    }

    return true
  }

  /**
   * 撤销上一步操作。
   *
   * 普通模式下撤销普通历史；
   * 探索模式下撤销探索历史。
   *
   * @returns {boolean} 是否撤销成功
   */
  function undo() {
    if (isExploring()) {
      if (exploreUndoStackData.length === 0) {
        return false
      }

      const currentSnapshot = currentSudoku.toJSON()
      exploreRedoStackData.push(currentSnapshot)

      const previousSnapshot = exploreUndoStackData.pop()
      currentSudoku = createSudokuFromJSON(previousSnapshot)

      return true
    }

    if (undoStackData.length === 0) {
      return false
    }

    const currentSnapshot = currentSudoku.toJSON()
    redoStackData.push(currentSnapshot)

    const previousSnapshot = undoStackData.pop()
    currentSudoku = createSudokuFromJSON(previousSnapshot)

    return true
  }

  /**
   * 重做上一次被撤销的操作。
   *
   * 普通模式下重做普通历史；
   * 探索模式下重做探索历史。
   *
   * @returns {boolean} 是否重做成功
   */
  function redo() {
    if (isExploring()) {
      if (exploreRedoStackData.length === 0) {
        return false
      }

      const currentSnapshot = currentSudoku.toJSON()
      exploreUndoStackData.push(currentSnapshot)

      const nextSnapshot = exploreRedoStackData.pop()
      currentSudoku = createSudokuFromJSON(nextSnapshot)

      rememberFailedExploreIfNeeded()
      return true
    }

    if (redoStackData.length === 0) {
      return false
    }

    const currentSnapshot = currentSudoku.toJSON()
    undoStackData.push(currentSnapshot)

    const nextSnapshot = redoStackData.pop()
    currentSudoku = createSudokuFromJSON(nextSnapshot)

    return true
  }

  /**
   * 判断当前是否可以撤销。
   *
   * @returns {boolean} 是否可以 undo
   */
  function canUndo() {
    return isExploring()
      ? exploreUndoStackData.length > 0
      : undoStackData.length > 0
  }

  /**
   * 判断当前是否可以重做。
   *
   * @returns {boolean} 是否可以 redo
   */
  function canRedo() {
    return isExploring()
      ? exploreRedoStackData.length > 0
      : redoStackData.length > 0
  }

  /**
   * 获取某个格子的候选数。
   * 具体候选数计算交给 Sudoku，Game 只是作为 UI 的入口。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {number[]} 候选数
   */
  function getCandidates(row, col) {
    return currentSudoku.getCandidates(row, col)
  }

  /**
   * 获取某个格子的提示信息。
   *
   * @param {number} row 行号
   * @param {number} col 列号
   * @returns {Object} 提示信息
   */
  function getHintForCell(row, col) {
    return currentSudoku.getHintForCell(row, col)
  }

  /**
   * 获取下一步提示。
   *
   * 可能返回：
   * - conflict
   * - contradiction
   * - singleCandidate
   * - explore
   * - complete
   *
   * @returns {Object|null} 下一步提示
   */
  function getNextHint() {
    return currentSudoku.getNextHint()
  }

  /**
   * 获取整个棋盘的候选数表。
   *
   * @returns {number[][][]} 9x9 候选数表
   */
  function getCandidateMap() {
    return currentSudoku.getCandidateMap()
  }

  /**
   * 自动应用下一步唯一候选数提示。
   * 只有 getNextHint() 返回 singleCandidate 时才会真正填写。
   *
   * @returns {boolean} 是否成功填写
   */
  function applyNextHint() {
    const hint = getNextHint()

    if (!hint || hint.type !== 'singleCandidate') {
      return false
    }

    return guess({
      row: hint.row,
      col: hint.col,
      value: hint.value,
    })
  }

  /**
   * 进入探索模式。
   *
   * 进入时保存当前局面作为探索起点。
   * 探索过程中的输入不会直接进入主历史。
   *
   * @returns {boolean} 是否成功进入探索模式
   */
  function startExplore() {
    if (isExploring()) {
      return false
    }

    gameMode = 'explore'
    exploreBaseSnapshotData = currentSudoku.toJSON()
    exploreUndoStackData = []
    exploreRedoStackData = []

    return true
  }

  /**
   * startExplore 的别名。
   * 这样 UI 里想叫 enterExplore 也可以。
   *
   * @returns {boolean} 是否成功进入探索模式
   */
  function enterExplore() {
    return startExplore()
  }

  /**
   * 将探索局面重置回探索起点。
   * 这个方法用于“快速回到探索开始处，换另一个候选值试”。
   *
   * @returns {boolean} 是否成功重置
   */
  function resetExploreToStart() {
    if (!isExploring() || exploreBaseSnapshotData === null) {
      return false
    }

    currentSudoku = createSudokuFromJSON(exploreBaseSnapshotData)
    exploreUndoStackData = []
    exploreRedoStackData = []

    return true
  }

  /**
   * 判断当前探索结果是否可以提交。
   * 失败路径不能提交。
   *
   * @returns {boolean} 是否可以提交探索结果
   */
  function canCommitExplore() {
    if (!isExploring()) {
      return false
    }

    const failure = analyzeCurrentFailure()
    return !failure.failed
  }

  /**
   * 提交探索结果。
   *
   * 提交后：
   * 1. 当前探索局面变成主局面
   * 2. 探索起点进入普通 undo 栈
   * 3. 普通 redo 栈清空
   * 4. 退出探索模式
   *
   * @returns {boolean} 是否提交成功
   */
  function commitExplore() {
    if (!isExploring() || exploreBaseSnapshotData === null) {
      return false
    }

    const failure = analyzeCurrentFailure()

    if (failure.failed) {
      rememberFailedExploreIfNeeded()
      return false
    }

    const currentSnapshot = currentSudoku.toJSON()

    if (!isSameSnapshot(currentSnapshot, exploreBaseSnapshotData)) {
      undoStackData.push(deepCopy(exploreBaseSnapshotData))
      redoStackData = []
    }

    gameMode = 'normal'
    exploreBaseSnapshotData = null
    exploreUndoStackData = []
    exploreRedoStackData = []

    return true
  }

  /**
   * 放弃探索结果。
   *
   * 放弃后：
   * 1. 如果当前探索局面失败，则记录失败路径
   * 2. 当前棋盘回到探索起点
   * 3. 退出探索模式
   *
   * @returns {boolean} 是否成功放弃探索
   */
  function cancelExplore() {
    if (!isExploring() || exploreBaseSnapshotData === null) {
      return false
    }

    rememberFailedExploreIfNeeded()

    currentSudoku = createSudokuFromJSON(exploreBaseSnapshotData)

    gameMode = 'normal'
    exploreBaseSnapshotData = null
    exploreUndoStackData = []
    exploreRedoStackData = []

    return true
  }

  /**
   * cancelExplore 的别名。
   *
   * @returns {boolean} 是否成功放弃探索
   */
  function abandonExplore() {
    return cancelExplore()
  }

  /**
   * 手动把当前探索局面记为失败。
   * 这个方法不是必须给普通用户使用，但适合调试或后续 UI 扩展。
   *
   * @returns {boolean} 是否记录成功
   */
  function markCurrentExploreAsFailed() {
    if (!isExploring()) {
      return false
    }

    failedExploreSignaturesData.add(getCurrentBoardSignature())
    return true
  }

  /**
   * 获取探索模式状态。
   * UI 可以用这个方法显示：
   * - 是否正在探索
   * - 是否失败
   * - 失败原因
   * - 是否可以提交
   *
   * @returns {Object} 探索状态
   */
  function getExploreStatus() {
    const failure = analyzeCurrentFailure()

    if (
      isExploring() &&
      failure.failed &&
      failure.reason !== 'knownFailedPath' &&
      failure.signature
    ) {
      failedExploreSignaturesData.add(failure.signature)
    }

    return {
      mode: gameMode,
      exploring: isExploring(),
      failed: failure.failed,
      reason: failure.reason,
      message: failure.message,
      canCommit: canCommitExplore(),
      canUndo: canUndo(),
      canRedo: canRedo(),
      failedPathCount: failedExploreSignaturesData.size,
    }
  }

  /**
   * 判断当前局面是否是已经失败过的探索路径。
   *
   * @returns {boolean} 是否是已知失败路径
   */
  function isKnownFailedExplorePath() {
    return failedExploreSignaturesData.has(getCurrentBoardSignature())
  }

  /**
   * 获取已失败探索路径数量。
   *
   * @returns {number} 失败路径数量
   */
  function getFailedExploreCount() {
    return failedExploreSignaturesData.size
  }

  /**
   * 把整个游戏状态转成 JSON。
   *
   * 注意：
   * 除了 HW1 的 sudoku / undoStack / redoStack，
   * HW2 还需要保存：
   * - 当前模式
   * - 探索起点
   * - 探索历史
   * - 失败探索路径记忆
   *
   * @returns {Object} 当前游戏状态 JSON
   */
  function toJSON() {
    return {
      sudoku: currentSudoku.toJSON(),

      undoStack: copySnapshotList(undoStackData),
      redoStack: copySnapshotList(redoStackData),

      mode: gameMode,
      exploreBaseSnapshot:
        exploreBaseSnapshotData === null ? null : deepCopy(exploreBaseSnapshotData),
      exploreUndoStack: copySnapshotList(exploreUndoStackData),
      exploreRedoStack: copySnapshotList(exploreRedoStackData),

      failedExploreSignatures: Array.from(failedExploreSignaturesData),
    }
  }

  /**
   * 返回当前游戏的字符串描述。
   * 主要用于调试。
   *
   * @returns {string} 游戏状态字符串
   */
  function toString() {
    return [
      '[Game]',
      `mode=${gameMode}`,
      `canUndo=${canUndo()}`,
      `canRedo=${canRedo()}`,
      `failedExploreCount=${failedExploreSignaturesData.size}`,
      currentSudoku.toString(),
    ].join('\n')
  }

  return {
    getSudoku,

    guess,
    undo,
    redo,
    canUndo,
    canRedo,

    getMode,
    isExploring,

    getCandidates,
    getHintForCell,
    getNextHint,
    getCandidateMap,
    applyNextHint,

    startExplore,
    enterExplore,
    resetExploreToStart,
    canCommitExplore,
    commitExplore,
    cancelExplore,
    abandonExplore,

    getExploreStatus,
    markCurrentExploreAsFailed,
    isKnownFailedExplorePath,
    getFailedExploreCount,

    toJSON,
    toString,
  }
}

/**
 * 创建一个新的游戏对象。
 *
 * @param {Object} options 配置对象
 * @param {Object} options.sudoku 初始数独对象
 * @returns {Object} Game 对象
 */
export function createGame({ sudoku }) {
  return createGameInternal({ sudoku })
}

/**
 * 根据 JSON 数据恢复一个游戏对象。
 *
 * 兼容 HW1 的旧 JSON：
 * 如果没有 HW2 的 explore 字段，也能正常恢复。
 *
 * @param {Object} json 保存下来的游戏 JSON
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

    mode: json.mode === 'explore' ? 'explore' : 'normal',
    exploreBaseSnapshot: json.exploreBaseSnapshot || null,
    exploreUndoStack: Array.isArray(json.exploreUndoStack)
      ? json.exploreUndoStack
      : [],
    exploreRedoStack: Array.isArray(json.exploreRedoStack)
      ? json.exploreRedoStack
      : [],

    failedExploreSignatures: Array.isArray(json.failedExploreSignatures)
      ? json.failedExploreSignatures
      : [],
  })
}
}
