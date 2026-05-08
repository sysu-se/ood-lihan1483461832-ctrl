<script>
	import { candidates } from '@sudoku/stores/candidates';
	import {
		userGrid,
		canUndo,
		canRedo,
		isExploring,
		exploreFailed,
		exploreMessage,
		canCommitExplore,
	} from '@sudoku/stores/grid';
	import { cursor } from '@sudoku/stores/cursor';
	import { hints } from '@sudoku/stores/hints';
	import { notes } from '@sudoku/stores/notes';
	import { settings } from '@sudoku/stores/settings';
	import { keyboardDisabled } from '@sudoku/stores/keyboard';
	import { gamePaused } from '@sudoku/stores/game';

	$: hintsAvailable = $hints > 0;
	$: selectedCellEmpty = !$keyboardDisabled && $userGrid[$cursor.y][$cursor.x] === 0;

	/**
	 * 使用原项目的“直接填答案”提示。
	 * 这个按钮会真正把答案写入当前格。
	 */
	function handleHint() {
		if (!hintsAvailable || !selectedCellEmpty) return;

		if ($candidates.hasOwnProperty($cursor.x + ',' + $cursor.y)) {
			candidates.clear($cursor);
		}

		userGrid.applyHint($cursor);
	}

	/**
	 * 显示当前格的候选数。
	 * 这里只显示，不自动填写，适合学习数独推理。
	 */
	function handleCandidates() {
		if (!selectedCellEmpty) return;
		userGrid.showCandidates($cursor);
	}

	/**
	 * 让领域层帮我们找一个“下一步值得观察的格子”。
	 * 如果有唯一候选数，就显示那个唯一候选数；否则显示候选数最少的格子。
	 */
	function handleNextHint() {
		if (!hintsAvailable) return;
		userGrid.showNextHint();
	}
</script>

<div class="space-y-3">
	<div class="action-buttons space-x-3">

		<button class="btn btn-round" disabled={$gamePaused || !$canUndo} on:click={userGrid.undo} title="Undo">
			<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
			</svg>
		</button>

		<button class="btn btn-round" disabled={$gamePaused || !$canRedo} on:click={userGrid.redo} title="Redo">
			<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
			</svg>
		</button>

		<button class="btn btn-round btn-badge" disabled={!selectedCellEmpty} on:click={handleCandidates} title="Show candidates">
			<span class="btn-text">候选</span>
		</button>

		<button class="btn btn-round btn-badge" disabled={$gamePaused || !hintsAvailable} on:click={handleNextHint} title="Next logical hint ({$hints})">
			<span class="btn-text">下一步</span>
			{#if $settings.hintsLimited}
				<span class="badge" class:badge-primary={hintsAvailable}>{$hints}</span>
			{/if}
		</button>

		<button class="btn btn-round btn-badge" disabled={!selectedCellEmpty || !hintsAvailable} on:click={handleHint} title="Fill answer ({$hints})">
			<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
			</svg>

			{#if $settings.hintsLimited}
				<span class="badge" class:badge-primary={hintsAvailable}>{$hints}</span>
			{/if}
		</button>

		<button class="btn btn-round btn-badge" on:click={notes.toggle} title="Notes ({$notes ? 'ON' : 'OFF'})">
			<svg class="icon-outline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
			</svg>

			<span class="badge tracking-tighter" class:badge-primary={$notes}>{$notes ? 'ON' : 'OFF'}</span>
		</button>
	</div>

	<div class="explore-panel" class:explore-panel-active={$isExploring} class:explore-panel-failed={$exploreFailed}>
		<div class="explore-buttons space-x-2">
			<button class="btn btn-small" disabled={$gamePaused || $isExploring} on:click={userGrid.enterExplore}>开始探索</button>
			<button class="btn btn-small btn-primary" disabled={$gamePaused || !$canCommitExplore} on:click={userGrid.commitExplore}>提交探索</button>
			<button class="btn btn-small" disabled={$gamePaused || !$isExploring} on:click={userGrid.discardExplore}>放弃探索</button>
		</div>

		{#if $exploreMessage}
			<p class="explore-message">{$exploreMessage}</p>
		{/if}
	</div>
</div>

<style>
	.action-buttons {
		@apply flex flex-wrap justify-evenly self-end;
	}

	.btn-badge {
		@apply relative;
	}

	.btn-text {
		@apply text-sm font-semibold;
	}

	.badge {
		min-height: 20px;
		min-width:  20px;
		@apply p-1 rounded-full leading-none text-center text-xs text-white bg-gray-600 inline-block absolute top-0 left-0;
	}

	.badge-primary {
		@apply bg-primary;
	}

	.explore-panel {
		@apply rounded-xl bg-gray-100 border-2 border-gray-200 p-3 text-sm;
	}

	.explore-panel-active {
		@apply border-primary bg-primary-lighter;
	}

	.explore-panel-failed {
		@apply border-red-400 bg-red-100;
	}

	.explore-buttons {
		@apply flex flex-wrap justify-center;
	}

	.explore-message {
		@apply mt-2 text-center text-gray-700;
	}
</style>
