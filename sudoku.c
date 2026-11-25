#include <stdint.h>
#include <stddef.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define WASM_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define WASM_EXPORT
#endif

#define SIZE 9
#define CELL_COUNT 81
#define FULL_MASK 0x1FFu

typedef struct {
    int *board;
    uint16_t row_mask[SIZE];
    uint16_t col_mask[SIZE];
    uint16_t box_mask[SIZE];
} Sudoku;

static int box_index(int row, int col)
{
    return (row / 3) * 3 + (col / 3);
}

static int bit_count(uint16_t value)
{
#if defined(__GNUC__) || defined(__clang__)
    return __builtin_popcount((unsigned int)value);
#else
    int count = 0;
    while (value != 0) {
        value &= (uint16_t)(value - 1);
        ++count;
    }
    return count;
#endif
}

static int bit_to_digit(uint16_t bit)
{
#if defined(__GNUC__) || defined(__clang__)
    return __builtin_ctz((unsigned int)bit) + 1;
#else
    int digit = 1;
    while ((bit & 1u) == 0u) {
        bit >>= 1;
        ++digit;
    }
    return digit;
#endif
}

static int initialize(Sudoku *sudoku, int *board)
{
    int index;

    if (sudoku == NULL || board == NULL) {
        return 0;
    }

    sudoku->board = board;

    for (index = 0; index < SIZE; ++index) {
        sudoku->row_mask[index] = 0;
        sudoku->col_mask[index] = 0;
        sudoku->box_mask[index] = 0;
    }

    for (index = 0; index < CELL_COUNT; ++index) {
        int value = board[index];
        int row = index / SIZE;
        int col = index % SIZE;
        int box = box_index(row, col);
        uint16_t bit;

        if (value < 0 || value > 9) {
            return 0;
        }
        if (value == 0) {
            continue;
        }

        bit = (uint16_t)(1u << (value - 1));
        if ((sudoku->row_mask[row] & bit) != 0u ||
            (sudoku->col_mask[col] & bit) != 0u ||
            (sudoku->box_mask[box] & bit) != 0u) {
            return 0;
        }

        sudoku->row_mask[row] |= bit;
        sudoku->col_mask[col] |= bit;
        sudoku->box_mask[box] |= bit;
    }

    return 1;
}

static uint16_t candidates(const Sudoku *sudoku, int row, int col)
{
    int box = box_index(row, col);
    return (uint16_t)(
        FULL_MASK &
        ~(sudoku->row_mask[row] |
          sudoku->col_mask[col] |
          sudoku->box_mask[box])
    );
}

static int solve_recursive(Sudoku *sudoku)
{
    int best_index = -1;
    int best_count = 10;
    uint16_t best_candidates = 0;
    int index;

    for (index = 0; index < CELL_COUNT; ++index) {
        int row;
        int col;
        uint16_t mask;
        int count;

        if (sudoku->board[index] != 0) {
            continue;
        }

        row = index / SIZE;
        col = index % SIZE;
        mask = candidates(sudoku, row, col);
        count = bit_count(mask);

        if (count == 0) {
            return 0;
        }
        if (count < best_count) {
            best_index = index;
            best_count = count;
            best_candidates = mask;
            if (count == 1) {
                break;
            }
        }
    }

    if (best_index == -1) {
        return 1;
    }

    {
        int row = best_index / SIZE;
        int col = best_index % SIZE;
        int box = box_index(row, col);
        uint16_t remaining = best_candidates;

        while (remaining != 0u) {
            uint16_t bit = (uint16_t)(remaining & (uint16_t)(~remaining + 1u));
            int digit = bit_to_digit(bit);

            sudoku->board[best_index] = digit;
            sudoku->row_mask[row] |= bit;
            sudoku->col_mask[col] |= bit;
            sudoku->box_mask[box] |= bit;

            if (solve_recursive(sudoku)) {
                return 1;
            }

            sudoku->board[best_index] = 0;
            sudoku->row_mask[row] &= (uint16_t)~bit;
            sudoku->col_mask[col] &= (uint16_t)~bit;
            sudoku->box_mask[box] &= (uint16_t)~bit;

            remaining &= (uint16_t)(remaining - 1u);
        }
    }

    return 0;
}

/*
 * Zwracane wartości:
 *  1 - znaleziono rozwiązanie; board zawiera wynik,
 *  0 - poprawna plansza, ale brak rozwiązania,
 * -1 - nieprawidłowe dane wejściowe.
 */
WASM_EXPORT
int solve_sudoku(int *board)
{
    Sudoku sudoku;

    if (!initialize(&sudoku, board)) {
        return -1;
    }

    return solve_recursive(&sudoku);
}
