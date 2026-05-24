const MIN_GRID_SIZE = 64;
const MAX_GRID_SIZE = 4096;
const DEFAULT_GRID_SIZE = 512;
const MIN_PIECES = 1;
const MAX_PIECES = 5;
const DEFAULT_PIECES = 2;

export const PIECE_MOVES = {
  Knight: [2, 1],
  Fers: [1, 1],
  Vazir: [1, 0],
  Camel: [3, 1],
  Zebra: [3, 2],
  Antelope: [4, 3],
  Eland: [5, 3],
  Satrap: [2, 0],
  Aspbad: [2, 2],
  Spehbed: [3, 0],
  Marzban: [3, 3],
} as const;

export type PieceMoveKey = keyof typeof PIECE_MOVES;

export type PieceFormConfig = {
  moveKey: PieceMoveKey;
  color: number;
  attackedBy: number[];
};

export type FormConfig = {
  gridSize: number;
  pieces: PieceFormConfig[];
};

type Controls = {
  form: HTMLFormElement;
  resetButton: HTMLButtonElement;
  readConfig: () => FormConfig;
  writeConfigToUrl: (config: FormConfig) => void;
};

const PIECE_MOVE_KEYS = Object.keys(PIECE_MOVES) as PieceMoveKey[];
const DEFAULT_PIECE_COLORS = [0xff3333, 0x3366ff, 0x44aa00, 0xffaa00, 0xaa55ff];

function clampInteger(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isPieceMoveKey(value: string): value is PieceMoveKey {
  return PIECE_MOVE_KEYS.includes(value as PieceMoveKey);
}

function parseOptionalInteger(value: string | null, min: number, max: number, fallback: number) {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  return clampInteger(Number(value), min, max, fallback);
}

function allOtherPieceIds(pieceId: number, pieceCount: number) {
  return Array.from({ length: pieceCount }, (_, index) => index + 1)
    .filter((attackerId) => attackerId !== pieceId);
}

function normalizeAttackedBy(attackedBy: number[], pieceId: number, pieceCount: number) {
  return [...new Set(attackedBy)]
    .filter((attackerId) => Number.isInteger(attackerId))
    .filter((attackerId) => attackerId >= 1 && attackerId <= pieceCount && attackerId !== pieceId)
    .sort((a, b) => a - b);
}

function defaultColorForPiece(pieceId: number) {
  return DEFAULT_PIECE_COLORS[(pieceId - 1) % DEFAULT_PIECE_COLORS.length];
}

function colorNumberToInputValue(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function parseColorValue(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const normalizedValue = value.startsWith('#') ? value.slice(1) : value;
  if (!/^[0-9a-fA-F]{6}$/.test(normalizedValue)) {
    return fallback;
  }

  return Number.parseInt(normalizedValue, 16);
}

function defaultPieceConfig(pieceId: number, pieceCount: number): PieceFormConfig {
  return {
    moveKey: 'Knight',
    color: defaultColorForPiece(pieceId),
    attackedBy: allOtherPieceIds(pieceId, pieceCount),
  };
}

function parseFormConfigFromUrl(): FormConfig {
  const params = new URLSearchParams(window.location.search);
  const gridSize = parseOptionalInteger(params.get('size'), MIN_GRID_SIZE, MAX_GRID_SIZE, DEFAULT_GRID_SIZE);
  const pieceCount = parseOptionalInteger(params.get('pieces'), MIN_PIECES, MAX_PIECES, DEFAULT_PIECES);
  const moveKeys = params.get('moves')?.split(',') ?? [];
  const colors = params.get('colors')?.split(',') ?? [];
  const attackedByGroups = params.get('attacks')?.split('|') ?? [];

  return {
    gridSize,
    pieces: Array.from({ length: pieceCount }, (_, index) => {
      const pieceId = index + 1;
      const defaultConfig = defaultPieceConfig(pieceId, pieceCount);
      const rawMoveKey = moveKeys[index] ?? '';
      const moveKey: PieceMoveKey = isPieceMoveKey(rawMoveKey) ? rawMoveKey : defaultConfig.moveKey;
      const color = parseColorValue(colors[index] ?? null, defaultConfig.color);
      const attackedBy = attackedByGroups[index] === undefined
        ? defaultConfig.attackedBy
        : normalizeAttackedBy(
          attackedByGroups[index]
            .split(',')
            .map((attackerId) => Number(attackerId)),
          pieceId,
          pieceCount,
        );

      return { moveKey, color, attackedBy };
    }),
  };
}

function writeFormConfigToUrl(config: FormConfig) {
  const params = new URLSearchParams(window.location.search);
  params.set('size', String(config.gridSize));
  params.set('pieces', String(config.pieces.length));
  params.set('moves', config.pieces.map((piece) => piece.moveKey).join(','));
  params.set('colors', config.pieces.map((piece) => colorNumberToInputValue(piece.color).slice(1)).join(','));
  params.set('attacks', config.pieces.map((piece) => piece.attackedBy.join(',')).join('|'));

  window.history.replaceState(null, '', `${window.location.pathname}?${params}${window.location.hash}`);
}

function readPieceFormConfig(pieceId: number, pieceCount: number): PieceFormConfig {
  const moveSelect = document.getElementById(`piece-${pieceId}-move`);
  const moveKey = moveSelect instanceof HTMLSelectElement && isPieceMoveKey(moveSelect.value)
    ? moveSelect.value
    : defaultPieceConfig(pieceId, pieceCount).moveKey;
  const colorInput = document.getElementById(`piece-${pieceId}-color`);
  const color = colorInput instanceof HTMLInputElement
    ? parseColorValue(colorInput.value, defaultColorForPiece(pieceId))
    : defaultColorForPiece(pieceId);

  const attackedBy: number[] = [];
  for (let attackerId = 1; attackerId <= pieceCount; attackerId++) {
    if (attackerId === pieceId) {
      continue;
    }
    const checkbox = document.getElementById(`piece-${pieceId}-attacked-by-${attackerId}`);
    if (!(checkbox instanceof HTMLInputElement) || checkbox.checked) {
      attackedBy.push(attackerId);
    }
  }

  return { moveKey, color, attackedBy: normalizeAttackedBy(attackedBy, pieceId, pieceCount) };
}

function pieceMoveOptionHtml(selectedMoveKey: PieceMoveKey) {
  return PIECE_MOVE_KEYS.map((moveKey) => {
    const [x, y] = PIECE_MOVES[moveKey];
    const selected = moveKey === selectedMoveKey ? ' selected' : '';
    return `<option value="${moveKey}"${selected}>${moveKey} (${x}, ${y})</option>`;
  }).join('');
}

function attackedByCheckboxHtml(pieceId: number, pieceCount: number, attackedBy: number[]) {
  return Array.from({ length: pieceCount }, (_, index) => index + 1)
    .filter((attackerId) => attackerId !== pieceId)
    .map((attackerId) => {
      const checked = attackedBy.includes(attackerId) ? ' checked' : '';
      return `
        <label class="attack-option">
          <input
            id="piece-${pieceId}-attacked-by-${attackerId}"
            type="checkbox"
            ${checked}
          >
          Piece ${attackerId}
        </label>
      `;
    })
    .join('');
}

export function createControls(): Controls {
  const initialConfig = parseFormConfigFromUrl();
  const form = document.createElement('form');
  form.id = 'controls';
  form.innerHTML = `
    <div class="controls-header">
      <div>
        <h1>Simulation Controls</h1>
        <p>Shareable settings live in the URL.</p>
      </div>
      <button
        id="toggle-controls"
        class="secondary-button"
        type="button"
        aria-expanded="true"
        aria-controls="controls-body"
      >
        Hide
      </button>
    </div>
    <div id="controls-body">
      <div class="control-grid">
        <label>
          <span>Board</span>
          <input
            id="grid-size"
            type="number"
            min="${MIN_GRID_SIZE}"
            max="${MAX_GRID_SIZE}"
            step="64"
            value="${initialConfig.gridSize}"
          >
        </label>
        <div class="piece-count-control">
          <span>Pieces</span>
          <div class="piece-count-actions">
            <button id="remove-piece" class="secondary-button piece-count-button" type="button" aria-label="Remove piece">-</button>
            <output id="piece-count" aria-live="polite">${initialConfig.pieces.length}</output>
            <button id="add-piece" class="secondary-button piece-count-button" type="button" aria-label="Add piece">+</button>
          </div>
        </div>
      </div>
      <div id="piece-controls"></div>
      <button id="reset-simulation" type="submit">Reset Simulation</button>
    </div>
  `;
  document.body.appendChild(form);

  const gridSizeInput = document.getElementById('grid-size') as HTMLInputElement;
  const controlsBody = document.getElementById('controls-body') as HTMLDivElement;
  const toggleControlsButton = document.getElementById('toggle-controls') as HTMLButtonElement;
  const pieceCountOutput = document.getElementById('piece-count') as HTMLOutputElement;
  const removePieceButton = document.getElementById('remove-piece') as HTMLButtonElement;
  const addPieceButton = document.getElementById('add-piece') as HTMLButtonElement;
  const pieceControls = document.getElementById('piece-controls') as HTMLDivElement;
  const resetButton = document.getElementById('reset-simulation') as HTMLButtonElement;
  let pieceCount = initialConfig.pieces.length;

  const readConfig = (): FormConfig => {
    const gridSize = clampInteger(Number(gridSizeInput.value), MIN_GRID_SIZE, MAX_GRID_SIZE, DEFAULT_GRID_SIZE);
    gridSizeInput.value = String(gridSize);

    return {
      gridSize,
      pieces: Array.from({ length: pieceCount }, (_, index) => readPieceFormConfig(index + 1, pieceCount)),
    };
  };

  const updatePieceCountButtons = () => {
    pieceCountOutput.value = String(pieceCount);
    pieceCountOutput.textContent = String(pieceCount);
    removePieceButton.disabled = pieceCount <= MIN_PIECES;
    addPieceButton.disabled = pieceCount >= MAX_PIECES;
  };

  const renderPieceControls = (pieceConfigs?: PieceFormConfig[]) => {
    const configs = Array.from(
      { length: pieceCount },
      (_, index) => {
        const pieceId = index + 1;
        const config = pieceConfigs?.[index] ?? readPieceFormConfig(pieceId, pieceCount);
        return {
          ...config,
          attackedBy: normalizeAttackedBy(config.attackedBy, pieceId, pieceCount),
        };
      },
    );

    pieceControls.innerHTML = configs.map((config, index) => {
      const pieceId = index + 1;
      return `
        <fieldset class="piece-control">
          <legend>
            <span class="piece-swatch" style="background: ${colorNumberToInputValue(config.color)}"></span>
            Piece ${pieceId}
          </legend>
          <div class="piece-fields">
            <label class="move-field">
              <span>Move</span>
              <select id="piece-${pieceId}-move">
                ${pieceMoveOptionHtml(config.moveKey)}
              </select>
            </label>
            <label class="color-field">
              <span>Color</span>
              <input
                id="piece-${pieceId}-color"
                type="color"
                value="${colorNumberToInputValue(config.color)}"
              >
            </label>
          </div>
          <div class="attacked-by-group">
            <span>Attacked by</span>
            <div class="attack-options">
              ${attackedByCheckboxHtml(pieceId, pieceCount, config.attackedBy)}
            </div>
          </div>
        </fieldset>
      `;
    }).join('');
    updatePieceCountButtons();
  };

  const setCollapsed = (isCollapsed: boolean) => {
    form.classList.toggle('is-collapsed', isCollapsed);
    controlsBody.hidden = isCollapsed;
    toggleControlsButton.textContent = isCollapsed ? 'Show' : 'Hide';
    toggleControlsButton.setAttribute('aria-expanded', String(!isCollapsed));
  };

  const updatePieceCount = (nextPieceCount: number) => {
    const previousPieceCount = pieceCount;
    const currentConfigs = Array.from(
      { length: previousPieceCount },
      (_, index) => readPieceFormConfig(index + 1, previousPieceCount),
    );
    pieceCount = clampInteger(nextPieceCount, MIN_PIECES, MAX_PIECES, pieceCount);
    const configs = Array.from(
      { length: pieceCount },
      (_, index) => {
        const pieceId = index + 1;
        const config = currentConfigs[index] ?? defaultPieceConfig(pieceId, pieceCount);
        const addedAttackerIds = pieceCount > previousPieceCount
          ? Array.from(
            { length: pieceCount - previousPieceCount },
            (_, addedIndex) => previousPieceCount + addedIndex + 1,
          )
          : [];
        return {
          ...config,
          attackedBy: normalizeAttackedBy([...config.attackedBy, ...addedAttackerIds], pieceId, pieceCount),
        };
      },
    );

    renderPieceControls(configs);
    writeFormConfigToUrl(readConfig());
  };

  toggleControlsButton.addEventListener('click', () => setCollapsed(!form.classList.contains('is-collapsed')));
  removePieceButton.addEventListener('click', () => updatePieceCount(pieceCount - 1));
  addPieceButton.addEventListener('click', () => updatePieceCount(pieceCount + 1));
  form.addEventListener('change', () => writeFormConfigToUrl(readConfig()));

  renderPieceControls(initialConfig.pieces);
  setCollapsed(window.matchMedia('(max-width: 700px)').matches);

  return {
    form,
    resetButton,
    readConfig,
    writeConfigToUrl: writeFormConfigToUrl,
  };
}
