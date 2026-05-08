import { describe, expect, it } from 'vitest';
import { createGame, createSudoku, createGameFromJSON } from '../../src/domain/index.js';

const puzzle = [
	[5, 3, 0, 0, 7, 0, 0, 0, 0],
	[6, 0, 0, 1, 9, 5, 0, 0, 0],
	[0, 9, 8, 0, 0, 0, 0, 6, 0],
	[8, 0, 0, 0, 6, 0, 0, 0, 3],
	[4, 0, 0, 8, 0, 3, 0, 0, 1],
	[7, 0, 0, 0, 2, 0, 0, 0, 6],
	[0, 6, 0, 0, 0, 0, 2, 8, 0],
	[0, 0, 0, 4, 1, 9, 0, 0, 5],
	[0, 0, 0, 0, 8, 0, 0, 7, 9],
];

describe('HW2 Sudoku domain behavior', () => {
	it('computes candidates for an empty cell', () => {
		const sudoku = createSudoku(puzzle);
		expect(sudoku.getCandidates(0, 2)).toEqual([1, 2, 4]);
	});

	it('detects conflicting cells', () => {
		const sudoku = createSudoku(puzzle);
		sudoku.guess({ row: 0, col: 2, value: 5 });

		expect(sudoku.isValidBoard()).toBe(false);
		expect(sudoku.getConflictCells()).toEqual(
			expect.arrayContaining([
				{ row: 0, col: 0 },
				{ row: 0, col: 2 },
			]),
		);
	});

	it('keeps exploration changes separate until committed', () => {
		const game = createGame({ sudoku: createSudoku(puzzle) });
		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 4 });

		expect(game.getSudoku().getGrid()[0][2]).toBe(4);
		game.discardExplore();
		expect(game.getSudoku().getGrid()[0][2]).toBe(0);
	});

	it('blocks committing a failed exploration path and records the failed board', () => {
		const game = createGame({ sudoku: createSudoku(puzzle) });
		game.enterExplore();
		game.guess({ row: 0, col: 2, value: 5 });

		expect(game.isExploreFailed()).toBe(true);
		expect(game.commitExplore()).toBe(false);
		expect(game.getFailedBoardKeys().length).toBe(1);
	});

	it('serializes and restores game state', () => {
		const game = createGame({ sudoku: createSudoku(puzzle) });
		game.guess({ row: 0, col: 2, value: 4 });

		const restored = createGameFromJSON(game.toJSON());
		expect(restored.getSudoku().getGrid()[0][2]).toBe(4);
		expect(restored.canUndo()).toBe(true);
	});
});
