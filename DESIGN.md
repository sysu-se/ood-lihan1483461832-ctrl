# HW2 Object-Oriented Design Notes

本次 HW2 在 HW1.1 的 Svelte 数独项目基础上，把核心游戏逻辑抽到 `src/domain` 目录中，UI 只负责显示和调用接口。

## 1. 导入自 HW1.1 的文件

从 HW1.1 仓库导入并继续扩展：

- `src/domain/Sudoku.js`
- `src/domain/Game.js`
- `src/domain/index.js`

这三个文件是领域层核心。HW2 新增的候选数、下一步提示、探索模式、失败路径记录都放在这里完成。

## 2. 类/对象职责

### Sudoku

`Sudoku` 表示一个 9x9 盘面，职责包括：

- 保存当前棋盘 `grid`
- 保存固定格 `fixedMask`
- 判断某格候选数 `getCandidates(row, col)`
- 返回全盘候选数 `getAllCandidates()`
- 查找下一步提示 `findNextHint()`
- 检查冲突格 `getConflictCells()`
- 判断盘面是否失败/完成
- 提供 `clone()`、`toJSON()`、`createSudokuFromJSON()`

### Game

`Game` 表示一局游戏，职责包括：

- 持有当前主线 Sudoku
- 管理普通模式的 undo / redo
- 管理探索模式的临时分支
- 提交或放弃探索结果
- 记录已经失败的探索棋盘 key
- 当再次走到失败棋盘时给出失败提示
- 统一提供候选数与下一步提示接口

## 3. 探索模式设计

点击“开始探索”时，`Game` 会复制当前主线盘面到 `explorationData.sudoku`。

探索模式中的填数、撤销、重做都只作用于探索分支，不会直接修改主线盘面。

- “提交探索”：如果探索盘面没有失败，把探索盘面合并到主线，并作为主线的一次 undo 历史。
- “放弃探索”：丢弃探索盘面，回到进入探索前的主线盘面。
- 如果探索盘面发生冲突，记录该棋盘 key，并阻止提交。

## 4. 失败路径记录

`Sudoku.getBoardKey()` 会把 9x9 棋盘压缩成字符串。`Game` 用 `Set` 保存已经失败的棋盘 key。

当玩家在新的探索路径中又走到同一个 key，`Game.getExploreStatus()` 会返回失败提示：

> 你又走到了一个之前已经失败过的局面。

这样实现了“多路径探索到已经失败路径某一棋盘”的判断。

## 5. UI 对接

UI 层主要修改：

- `src/node_modules/@sudoku/stores/grid.js`
  - 用 `Game` 管理真实游戏状态
  - 新增探索模式 store：`isExploring`、`exploreFailed`、`exploreMessage`、`canCommitExplore`
  - 新增 `showCandidates()`、`showNextHint()`、`enterExplore()`、`commitExplore()`、`discardExplore()`

- `src/node_modules/@sudoku/stores/candidates.js`
  - 新增 `set()` 和 `clearAll()`，便于显示领域层算出的候选数

- `src/components/Controls/ActionBar/Actions.svelte`
  - 新增“候选”“下一步”“开始探索”“提交探索”“放弃探索”按钮
  - undo / redo 连接到领域层 Game

## 6. 设计原则

- UI 不直接修改二维数组，而是调用 `Game.guess()`。
- `Sudoku` 不知道 undo / redo，也不知道 Svelte。
- `Game` 不知道按钮和页面，只返回普通数据。
- 每次 `getGrid()` / `getSudoku()` 都返回副本，避免外部误改内部状态。
