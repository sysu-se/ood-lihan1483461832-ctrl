// src/domain/HintEngine.js

const SIZE = 9;
const EMPTY = 0;

/**
 * 深拷贝一个数独棋盘。
 *
 * 会先把传入的 grid 规范化成 9x9 的数字矩阵，
 * 然后再复制每一行，避免直接修改原数组。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 原始数独棋盘
 * @returns {number[][]} 新的 9x9 数独棋盘副本
 */
export function cloneGrid(grid) {
  return normalizeGrid(grid).map(row => row.slice());
}

/**
 * 将任意输入的棋盘数据规范化为 9x9 数字矩阵。
 *
 * 规则：
 * - 合法数字 1~9 会被保留；
 * - 非法值、空值、undefined、null 会被转换为 EMPTY，也就是 0；
 * - 如果传入的 grid 不完整，也会自动补成 9x9。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 原始棋盘
 * @returns {number[][]} 规范化后的 9x9 棋盘
 */
export function normalizeGrid(grid) {
  const result = [];

  for (let r = 0; r < SIZE; r++) {
    const row = [];

    for (let c = 0; c < SIZE; c++) {
      const value = grid && grid[r] ? Number(grid[r][c]) : EMPTY;
      row.push(Number.isInteger(value) && value >= 1 && value <= 9 ? value : EMPTY);
    }

    result.push(row);
  }

  return result;
}

/**
 * 生成当前棋盘的字符串签名。
 *
 * 这个签名可以用来判断两个棋盘状态是否相同。
 * 例如可以用于历史记录、撤销、缓存等功能。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 原始棋盘
 * @returns {string} 棋盘签名字符串
 */
export function gridSignature(grid) {
  return normalizeGrid(grid)
    .map(row => row.join(""))
    .join("|");
}

/**
 * 判断一个格子是否为空。
 *
 * @param {*} value 格子中的值
 * @returns {boolean} 如果是空值则返回 true
 */
function isEmpty(value) {
  return value === 0 || value === null || value === undefined || value === "";
}

/**
 * 根据行号或列号，计算它所在 3x3 宫格的起始下标。
 *
 * 例如：
 * - index 为 0、1、2 时，返回 0；
 * - index 为 3、4、5 时，返回 3；
 * - index 为 6、7、8 时，返回 6。
 *
 * @param {number} index 行号或列号
 * @returns {number} 对应 3x3 宫格的起始下标
 */
function boxStart(index) {
  return Math.floor(index / 3) * 3;
}

/**
 * 获取某个空格可以填写的候选数字。
 *
 * 会检查：
 * - 当前行已经使用过的数字；
 * - 当前列已经使用过的数字；
 * - 当前 3x3 宫格已经使用过的数字。
 *
 * 最后返回所有没有被使用过的数字。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 当前棋盘
 * @param {number} row 目标格子的行号，范围 0~8
 * @param {number} col 目标格子的列号，范围 0~8
 * @returns {number[]} 当前格子的候选数字数组
 */
export function getCandidates(grid, row, col) {
  const board = normalizeGrid(grid);

  if (!isEmpty(board[row][col])) {
    return [];
  }

  const used = new Set();

  for (let c = 0; c < SIZE; c++) {
    if (board[row][c] !== EMPTY) {
      used.add(board[row][c]);
    }
  }

  for (let r = 0; r < SIZE; r++) {
    if (board[r][col] !== EMPTY) {
      used.add(board[r][col]);
    }
  }

  const br = boxStart(row);
  const bc = boxStart(col);

  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) {
      if (board[r][c] !== EMPTY) {
        used.add(board[r][c]);
      }
    }
  }

  const candidates = [];

  for (let n = 1; n <= 9; n++) {
    if (!used.has(n)) {
      candidates.push(n);
    }
  }

  return candidates;
}

/**
 * 扫描一个单元中的重复数字。
 *
 * 这里的单元可以是：
 * - 一行 row；
 * - 一列 column；
 * - 一个 3x3 宫格 box。
 *
 * 如果同一个数字在同一个单元中出现多次，
 * 就会被记录为 conflict。
 *
 * @param {{ row: number, col: number, value: number }[]} cells 需要扫描的格子数组
 * @param {"row"|"column"|"box"} type 单元类型
 * @param {number} index 单元编号
 * @returns {{
 *   type: string,
 *   index: number,
 *   value: number,
 *   cells: { row: number, col: number }[]
 * }[]} 冲突信息数组
 */
function scanUnit(cells, type, index) {
  const byValue = new Map();

  for (const cell of cells) {
    if (cell.value === EMPTY) continue;

    if (!byValue.has(cell.value)) {
      byValue.set(cell.value, []);
    }

    byValue.get(cell.value).push(cell);
  }

  const conflicts = [];

  for (const [value, sameValueCells] of byValue.entries()) {
    if (sameValueCells.length > 1) {
      conflicts.push({
        type,
        index,
        value,
        cells: sameValueCells.map(cell => ({
          row: cell.row,
          col: cell.col
        }))
      });
    }
  }

  return conflicts;
}

/**
 * 查找整个棋盘中的冲突。
 *
 * 冲突指的是：
 * - 同一行出现重复数字；
 * - 同一列出现重复数字；
 * - 同一个 3x3 宫格出现重复数字。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 当前棋盘
 * @returns {{
 *   type: string,
 *   index: number,
 *   value: number,
 *   cells: { row: number, col: number }[]
 * }[]} 棋盘中的冲突信息
 */
export function findConflicts(grid) {
  const board = normalizeGrid(grid);
  const conflicts = [];

  for (let r = 0; r < SIZE; r++) {
    const cells = [];

    for (let c = 0; c < SIZE; c++) {
      cells.push({
        row: r,
        col: c,
        value: board[r][c]
      });
    }

    conflicts.push(...scanUnit(cells, "row", r));
  }

  for (let c = 0; c < SIZE; c++) {
    const cells = [];

    for (let r = 0; r < SIZE; r++) {
      cells.push({
        row: r,
        col: c,
        value: board[r][c]
      });
    }

    conflicts.push(...scanUnit(cells, "column", c));
  }

  let boxIndex = 0;

  for (let br = 0; br < SIZE; br += 3) {
    for (let bc = 0; bc < SIZE; bc += 3) {
      const cells = [];

      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          cells.push({
            row: r,
            col: c,
            value: board[r][c]
          });
        }
      }

      conflicts.push(...scanUnit(cells, "box", boxIndex));
      boxIndex++;
    }
  }

  return conflicts;
}

/**
 * 查找棋盘中的矛盾格子。
 *
 * 注意：
 * 如果棋盘本身已经有重复数字冲突，
 * 这里不会继续判断空格候选数，而是直接返回空数组。
 *
 * 只有当棋盘没有冲突时，才会检查：
 * 某个空格是否已经没有任何可填数字。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 当前棋盘
 * @returns {{
 *   row: number,
 *   col: number,
 *   reason: string
 * }[]} 矛盾格子数组
 */
export function findContradictions(grid) {
  const board = normalizeGrid(grid);
  const contradictions = [];

  if (findConflicts(board).length > 0) {
    return contradictions;
  }

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === EMPTY) {
        const candidates = getCandidates(board, r, c);

        if (candidates.length === 0) {
          contradictions.push({
            row: r,
            col: c,
            reason: "This empty cell has no possible candidate."
          });
        }
      }
    }
  }

  return contradictions;
}

/**
 * 获取某一个格子的提示信息。
 *
 * 根据格子状态返回不同类型：
 * - filled：这个格子已经填过；
 * - failed：这个格子没有任何合法候选数；
 * - single：这个格子只有一个候选数，可以直接填写；
 * - candidates：这个格子有多个候选数。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 当前棋盘
 * @param {number} row 目标格子的行号
 * @param {number} col 目标格子的列号
 * @returns {{
 *   type: "filled"|"failed"|"single"|"candidates",
 *   row: number,
 *   col: number,
 *   value: number|null,
 *   candidates: number[],
 *   reason: string
 * }} 当前格子的提示信息
 */
export function getCellHint(grid, row, col) {
  const board = normalizeGrid(grid);
  const value = board[row][col];

  if (value !== EMPTY) {
    return {
      type: "filled",
      row,
      col,
      value,
      candidates: [],
      reason: "This cell is already filled."
    };
  }

  const candidates = getCandidates(board, row, col);

  if (candidates.length === 0) {
    return {
      type: "failed",
      row,
      col,
      value: null,
      candidates: [],
      reason: "This cell has no valid candidate."
    };
  }

  if (candidates.length === 1) {
    return {
      type: "single",
      row,
      col,
      value: candidates[0],
      candidates,
      reason: "Only one candidate is possible for this cell."
    };
  }

  return {
    type: "candidates",
    row,
    col,
    value: null,
    candidates,
    reason: "These numbers are currently possible for this cell."
  };
}

/**
 * 获取下一步推荐提示。
 *
 * 判断顺序：
 * 1. 如果棋盘有冲突，先返回 conflict；
 * 2. 如果某个空格没有候选数，返回 failed；
 * 3. 如果存在唯一候选数的格子，返回 single；
 * 4. 如果没有唯一解法，选择候选数最少的格子，返回 explore；
 * 5. 如果没有空格，返回 solved。
 *
 * @param {Array<Array<number|string|null|undefined>>} grid 当前棋盘
 * @returns {{
 *   type: string,
 *   row?: number,
 *   col?: number,
 *   value: number|null,
 *   candidates: number[],
 *   conflicts?: object[],
 *   reason: string
 * }} 下一步提示信息
 */
export function getNextHint(grid) {
  const board = normalizeGrid(grid);
  const conflicts = findConflicts(board);

  if (conflicts.length > 0) {
    return {
      type: "conflict",
      value: null,
      candidates: [],
      conflicts,
      reason: "The board already contains a conflict."
    };
  }

  const singles = [];
  const choices = [];

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] !== EMPTY) continue;

      const hint = getCellHint(board, r, c);

      if (hint.type === "failed") {
        return hint;
      }

      if (hint.type === "single") {
        singles.push(hint);
      } else {
        choices.push(hint);
      }
    }
  }

  if (singles.length > 0) {
    return singles[0];
  }

  if (choices.length > 0) {
    choices.sort((a, b) => a.candidates.length - b.candidates.length);

    return {
      ...choices[0],
      type: "explore",
      reason: "No unique move is currently available. This cell is a good place to start exploring."
    };
  }

  return {
    type: "solved",
    value: null,
    candidates: [],
    reason: "The puzzle is solved."
  };
}
