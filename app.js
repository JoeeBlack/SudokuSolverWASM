(() => {
  "use strict";

  const SIZE = 9;
  const CELL_COUNT = 81;
  const MAX_UNDO = 200;

  const boardEl = document.getElementById("board");
  const solveBtn = document.getElementById("solve-btn");
  const clearBtn = document.getElementById("clear-btn");
  const undoBtn = document.getElementById("undo-btn");
  const statusEl = document.getElementById("status");

  /** @type {HTMLInputElement[]} */
  const cellInputs = [];

  /** @type {{ value: number, source: "empty" | "user" | "solver" }[]} */
  let boardState = createEmptyState();

  /** @type {{ value: number, source: "empty" | "user" | "solver" }[][]} */
  const undoStack = [];

  let activeIndex = -1;
  let wasmReady = false;
  let isSolving = false;

  function createEmptyState() {
    return Array.from({ length: CELL_COUNT }, () => ({
      value: 0,
      source: "empty",
    }));
  }

  function cloneState(state) {
    return state.map((cell) => ({
      value: cell.value,
      source: cell.source,
    }));
  }

  function statesEqual(a, b) {
    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (a[i].value !== b[i].value || a[i].source !== b[i].source) {
        return false;
      }
    }
    return true;
  }

  function pushUndo(snapshot) {
    if (statesEqual(snapshot, boardState)) {
      return;
    }
    undoStack.push(snapshot);
    if (undoStack.length > MAX_UNDO) {
      undoStack.shift();
    }
  }

  function setStatus(message, tone = "neutral") {
    statusEl.textContent = message;
    statusEl.dataset.tone = tone;
  }

  function getBoxIndex(row, col) {
    return Math.floor(row / 3) * 3 + Math.floor(col / 3);
  }

  function updateHighlights() {
    const activeRow = activeIndex >= 0 ? Math.floor(activeIndex / SIZE) : -1;
    const activeCol = activeIndex >= 0 ? activeIndex % SIZE : -1;
    const activeBox =
      activeIndex >= 0 ? getBoxIndex(activeRow, activeCol) : -1;

    for (let i = 0; i < CELL_COUNT; i += 1) {
      const input = cellInputs[i];
      const row = Math.floor(i / SIZE);
      const col = i % SIZE;
      const box = getBoxIndex(row, col);

      const isActive = i === activeIndex;
      const isRelated =
        activeIndex >= 0 &&
        !isActive &&
        (row === activeRow || col === activeCol || box === activeBox);

      input.classList.toggle("is-active", isActive);
      input.classList.toggle("is-related", isRelated);
    }
  }

  function validateBoard() {
    const conflictIndices = new Set();
    let filledCount = 0;
    let hasInvalidValue = false;

    const rowMap = Array.from({ length: SIZE }, () => new Map());
    const colMap = Array.from({ length: SIZE }, () => new Map());
    const boxMap = Array.from({ length: SIZE }, () => new Map());

    for (let i = 0; i < CELL_COUNT; i += 1) {
      const value = boardState[i].value;
      if (value === 0) {
        continue;
      }
      if (!Number.isInteger(value) || value < 1 || value > 9) {
        hasInvalidValue = true;
        conflictIndices.add(i);
        continue;
      }

      filledCount += 1;
      const row = Math.floor(i / SIZE);
      const col = i % SIZE;
      const box = getBoxIndex(row, col);

      recordUnitOccurrence(rowMap[row], value, i, conflictIndices);
      recordUnitOccurrence(colMap[col], value, i, conflictIndices);
      recordUnitOccurrence(boxMap[box], value, i, conflictIndices);
    }

    for (let i = 0; i < CELL_COUNT; i += 1) {
      const isConflict = conflictIndices.has(i);
      const input = cellInputs[i];
      input.classList.toggle("is-conflict", isConflict);
      if (isConflict) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    }

    return {
      isValid: !hasInvalidValue && conflictIndices.size === 0,
      filledCount,
    };
  }

  function recordUnitOccurrence(unitMap, digit, index, conflictIndices) {
    if (unitMap.has(digit)) {
      conflictIndices.add(unitMap.get(digit));
      conflictIndices.add(index);
    } else {
      unitMap.set(digit, index);
    }
  }

  function updateActionButtons() {
    solveBtn.disabled = !wasmReady || isSolving;
    undoBtn.disabled = isSolving || undoStack.length === 0;
    clearBtn.disabled = isSolving;
  }

  function renderBoard() {
    for (let i = 0; i < CELL_COUNT; i += 1) {
      const cell = boardState[i];
      const input = cellInputs[i];
      const text = cell.value === 0 ? "" : String(cell.value);
      if (input.value !== text) {
        input.value = text;
      }
      input.dataset.source = cell.source;
    }

    const validation = validateBoard();
    updateHighlights();
    updateActionButtons();
    return validation;
  }

  function focusCell(index) {
    if (index < 0 || index >= CELL_COUNT) {
      return;
    }
    cellInputs[index].focus();
  }

  function setSingleCell(index, digit, advanceFocus) {
    const prevSnapshot = cloneState(boardState);
    const nextValue = digit >= 1 && digit <= 9 ? digit : 0;
    const nextSource = nextValue === 0 ? "empty" : "user";

    boardState[index] = { value: nextValue, source: nextSource };
    pushUndo(prevSnapshot);

    const { isValid } = renderBoard();
    if (!isValid) {
      setStatus("Plansza jest nieprawidłowa.", "error");
    } else if (statusEl.dataset.tone === "error" || statusEl.dataset.tone === "warning") {
      setStatus("", "neutral");
    }

    if (advanceFocus && nextValue !== 0 && index < CELL_COUNT - 1) {
      focusCell(index + 1);
    }
  }

  function handleKeyDown(event) {
    const index = Number(event.currentTarget.dataset.index);
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (row > 0) {
        focusCell((row - 1) * SIZE + col);
      }
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (row < SIZE - 1) {
        focusCell((row + 1) * SIZE + col);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (col > 0) {
        focusCell(row * SIZE + (col - 1));
      }
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (col < SIZE - 1) {
        focusCell(row * SIZE + (col + 1));
      }
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      if (boardState[index].value !== 0) {
        setSingleCell(index, 0, false);
      } else if (index > 0) {
        focusCell(index - 1);
      }
      return;
    }

    if (event.key === "Delete") {
      event.preventDefault();
      if (boardState[index].value !== 0) {
        setSingleCell(index, 0, false);
      }
      return;
    }

    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        setSingleCell(index, Number(event.key), true);
        return;
      }
      if (event.key.length === 1) {
        // Ignoruj 0, litery, spacje i inne znaki na klawiaturze fizycznej
        event.preventDefault();
      }
    }
  }

  function handleInput(event) {
    const input = event.currentTarget;
    const index = Number(input.dataset.index);
    const raw = input.value;

    if (raw === "") {
      if (boardState[index].value !== 0) {
        setSingleCell(index, 0, false);
      }
      return;
    }

    const digits = raw.replace(/[^1-9]/g, "");
    if (digits.length === 0) {
      // Przywróć poprzednią wartość (ignoruj 0, spacje, litery)
      input.value = boardState[index].value === 0 ? "" : String(boardState[index].value);
      return;
    }

    let chosenChar = digits.charAt(digits.length - 1);
    if (digits.length > 1 && boardState[index].value !== 0) {
      const prevChar = String(boardState[index].value);
      const otherChar = [...digits].find((ch) => ch !== prevChar);
      if (otherChar) {
        chosenChar = otherChar;
      }
    }

    setSingleCell(index, Number(chosenChar), true);
  }

  function handlePaste(event) {
    event.preventDefault();
    const index = Number(event.currentTarget.dataset.index);
    const clipboard = event.clipboardData || window.clipboardData;
    const text = clipboard ? clipboard.getData("text") : "";
    const compact = text.replace(/\s+/g, "");

    if (compact.length === CELL_COUNT && /^[0-9.]{81}$/.test(compact)) {
      const prevSnapshot = cloneState(boardState);
      const nextState = createEmptyState();

      for (let i = 0; i < CELL_COUNT; i += 1) {
        const ch = compact.charAt(i);
        if (ch >= "1" && ch <= "9") {
          nextState[i] = { value: Number(ch), source: "user" };
        }
      }

      boardState = nextState;
      pushUndo(prevSnapshot);

      const { isValid } = renderBoard();
      if (isValid) {
        setStatus("Wklejono planszę Sudoku.", "neutral");
      } else {
        setStatus("Plansza jest nieprawidłowa.", "error");
      }
      return;
    }

    if (/^[1-9]$/.test(compact)) {
      setSingleCell(index, Number(compact), true);
      return;
    }

    setStatus(
      "Wklej pojedynczą cyfrę 1–9 lub ciąg 81 znaków (1–9, 0 albo .).",
      "warning"
    );
  }

  function buildBoard() {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < CELL_COUNT; i += 1) {
      const row = Math.floor(i / SIZE);
      const col = i % SIZE;
      const box = getBoxIndex(row, col);

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "numeric";
      input.pattern = "[1-9]*";
      input.maxLength = 1;
      input.autocomplete = "off";
      input.className = "cell";
      input.dataset.index = String(i);
      input.dataset.row = String(row);
      input.dataset.col = String(col);
      input.dataset.box = String(box);
      input.dataset.source = "empty";
      input.setAttribute("aria-label", `Wiersz ${row + 1}, kolumna ${col + 1}`);

      input.addEventListener("focus", () => {
        activeIndex = i;
        updateHighlights();
      });
      input.addEventListener("blur", () => {
        if (activeIndex === i) {
          activeIndex = -1;
          updateHighlights();
        }
      });
      input.addEventListener("keydown", handleKeyDown);
      input.addEventListener("input", handleInput);
      input.addEventListener("paste", handlePaste);

      cellInputs.push(input);
      fragment.appendChild(input);
    }

    boardEl.appendChild(fragment);
  }

  function getHeap32() {
    if (window.Module && window.Module.HEAP32) {
      return window.Module.HEAP32;
    }
    if (typeof HEAP32 !== "undefined") {
      return HEAP32;
    }
    if (window.Module && window.Module.wasmMemory) {
      return new Int32Array(window.Module.wasmMemory.buffer);
    }
    return null;
  }

  function runWasmSolver(boardInts) {
    const mod = window.Module;
    if (!mod || typeof mod._malloc !== "function" || typeof mod._free !== "function") {
      throw new Error("Brak interfejsu pamięci WebAssembly.");
    }

    const byteLength = CELL_COUNT * Int32Array.BYTES_PER_ELEMENT;
    const ptr = mod._malloc(byteLength);
    if (!ptr) {
      throw new Error("Nie udało się przydzielić pamięci WebAssembly.");
    }

    try {
      const heapBefore = getHeap32();
      if (!heapBefore) {
        throw new Error("Brak dostępu do bufora HEAP32.");
      }

      const offset = ptr >> 2;
      if (offset < 0 || offset + CELL_COUNT > heapBefore.length) {
        throw new Error("Nieprawidłowy zakres pamięci WebAssembly.");
      }

      heapBefore.set(boardInts, offset);

      let result;
      if (typeof mod.ccall === "function") {
        result = mod.ccall("solve_sudoku", "number", ["number"], [ptr]);
      } else if (typeof mod._solve_sudoku === "function") {
        result = mod._solve_sudoku(ptr);
      } else {
        throw new Error("Brak funkcji solve_sudoku w module WebAssembly.");
      }

      const heapAfter = getHeap32();
      if (!heapAfter || offset + CELL_COUNT > heapAfter.length) {
        throw new Error("Nieprawidłowy zakres pamięci po rozwiązaniu.");
      }

      const solved = new Int32Array(CELL_COUNT);
      solved.set(heapAfter.subarray(offset, offset + CELL_COUNT));

      return { statusCode: result, solved };
    } finally {
      mod._free(ptr);
    }
  }

  async function handleSolve() {
    if (!wasmReady || isSolving) {
      return;
    }

    const { isValid, filledCount } = validateBoard();
    if (filledCount === 0) {
      setStatus("Wprowadź przynajmniej jedną cyfrę.", "warning");
      return;
    }
    if (!isValid) {
      setStatus("Plansza jest nieprawidłowa.", "error");
      return;
    }

    isSolving = true;
    solveBtn.setAttribute("aria-busy", "true");
    updateActionButtons();
    setStatus("Rozwiązywanie…", "neutral");

    // Oddaj kontrolę przeglądarce na jedną klatkę, aby zablokowany stan przycisku był widoczny
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const inputBoard = new Int32Array(CELL_COUNT);
      for (let i = 0; i < CELL_COUNT; i += 1) {
        inputBoard[i] = boardState[i].value;
      }

      const { statusCode, solved } = runWasmSolver(inputBoard);

      if (statusCode === 1) {
        const prevSnapshot = cloneState(boardState);
        for (let i = 0; i < CELL_COUNT; i += 1) {
          if (boardState[i].value === 0) {
            boardState[i] = { value: solved[i], source: "solver" };
          }
        }
        pushUndo(prevSnapshot);
        renderBoard();
        setStatus("Sudoku zostało rozwiązane.", "success");
      } else if (statusCode === 0) {
        setStatus("Sudoku nie ma rozwiązania.", "error");
      } else {
        setStatus("Plansza jest nieprawidłowa.", "error");
      }
    } catch (error) {
      setStatus("Wystąpił błąd podczas uruchamiania solvera.", "error");
    } finally {
      isSolving = false;
      solveBtn.removeAttribute("aria-busy");
      updateActionButtons();
    }
  }

  function handleClear() {
    if (isSolving) {
      return;
    }

    const hasData = boardState.some((cell) => cell.value !== 0);
    if (!hasData) {
      setStatus("Plansza jest już pusta.", "neutral");
      return;
    }

    const confirmed = window.confirm(
      "Czy na pewno chcesz wyczyścić całą planszę?"
    );
    if (!confirmed) {
      return;
    }

    const prevSnapshot = cloneState(boardState);
    boardState = createEmptyState();
    pushUndo(prevSnapshot);
    renderBoard();
    setStatus("Plansza została wyczyszczona.", "neutral");
    focusCell(0);
  }

  function handleUndo() {
    if (isSolving || undoStack.length === 0) {
      return;
    }

    const prevSnapshot = undoStack.pop();
    boardState = prevSnapshot;
    const { isValid } = renderBoard();
    if (!isValid) {
      setStatus("Cofnięto ostatnią zmianę. Plansza zawiera konflikty.", "error");
    } else {
      setStatus("Cofnięto ostatnią zmianę.", "neutral");
    }
  }

  function setupWasmModule() {
    if (window.location.protocol === "file:") {
      setStatus(
        "Otwórz stronę przez serwer HTTP (np. python3 -m http.server 8080), nie przez file://.",
        "error"
      );
      return;
    }

    const wasmScript = document.querySelector('script[src$="sudoku-wasm.js"]');
    if (wasmScript) {
      wasmScript.addEventListener("error", () => {
        wasmReady = false;
        updateActionButtons();
        setStatus(
          "Nie udało się wczytać pliku sudoku-wasm.js. Upewnij się, że projekt został skompilowany.",
          "error"
        );
      });
    }

    window.addEventListener("load", () => {
      if (
        !wasmReady &&
        typeof window.Module.ccall !== "function" &&
        typeof window.Module._solve_sudoku !== "function"
      ) {
        setStatus(
          "Nie udało się wczytać pliku sudoku-wasm.js. Upewnij się, że projekt został skompilowany i uruchomiony przez HTTP.",
          "error"
        );
      }
    });

    window.Module = {
      locateFile(path) {
        return `./${path}`;
      },
      onRuntimeInitialized() {
        wasmReady = true;
        updateActionButtons();
        setStatus("Gotowe. Wpisz cyfry i naciśnij „Rozwiąż”.", "neutral");
      },
      onAbort() {
        wasmReady = false;
        updateActionButtons();
        setStatus("Nie udało się uruchomić modułu WebAssembly.", "error");
      },
    };
  }

  buildBoard();
  renderBoard();
  setupWasmModule();

  solveBtn.addEventListener("click", handleSolve);
  clearBtn.addEventListener("click", handleClear);
  undoBtn.addEventListener("click", handleUndo);
})();
