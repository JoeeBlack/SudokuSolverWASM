EMCC ?= emcc
DIST_DIR ?= dist

EMCC_FLAGS = \
	-O3 \
	-flto \
	-Wall \
	-Wextra \
	-s WASM=1 \
	-s ALLOW_MEMORY_GROWTH=0 \
	-s INITIAL_MEMORY=16777216 \
	-s EXPORTED_FUNCTIONS='["_solve_sudoku","_malloc","_free"]' \
	-s EXPORTED_RUNTIME_METHODS='["ccall","HEAP32"]' \
	-s ENVIRONMENT='web' \
	-s FILESYSTEM=0

.PHONY: all wasm assets serve clean

all: assets wasm

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

assets: $(DIST_DIR)
	cp index.html style.css app.js $(DIST_DIR)/

wasm: $(DIST_DIR) sudoku.c
	$(EMCC) sudoku.c $(EMCC_FLAGS) -o $(DIST_DIR)/sudoku-wasm.js

serve: all
	python3 -m http.server 8080 --directory $(DIST_DIR)

clean:
	rm -rf $(DIST_DIR)
