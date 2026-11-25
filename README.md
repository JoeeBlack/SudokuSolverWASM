# Sudoku Solver (C + WebAssembly)

Minimalistyczna, responsywna aplikacja internetowa do rozwiązywania Sudoku 9×9 bez backendu i bez zewnętrznych frameworków. Algorytm rozwiązujący (z wykorzystaniem masek bitowych oraz heurystyki MRV) został napisany w języku C i kompilowany do WebAssembly przy użyciu Emscripten.

## Funkcje

- Plansza 9×9 z wyraźnym podziałem bloków 3×3 i podświetlaniem aktywnego wiersza, kolumny oraz bloku.
- Walidacja planszy przed rozwiązaniem z zaznaczaniem wszystkich konfliktujących pól.
- Rozróżnienie cyfr wpisanych przez użytkownika od cyfr uzupełnionych przez solver.
- Obsługa urządzeń mobilnych (`inputmode="numeric"`, wygodne pola dotykowe od szerokości 320 px, brak blokowania powiększania strony).
- Obsługa klawiatury na komputerze (cyfry `1–9`, `Backspace`, `Delete`, strzałki, automatyczne przejście do następnego pola).
- Wklejanie całej planszy jako ciągu 81 znaków (`1–9`, `0` lub `.`) w dowolne pole.
- Przyciski **Rozwiąż**, **Wyczyść** (z potwierdzeniem) i **Cofnij**.
- Automatyczny motyw jasny i ciemny (`prefers-color-scheme`) oraz wsparcie dla czytników ekranu (`aria-live="polite"`, `aria-label`, `aria-invalid`).

## Wymagania

- **Emscripten (`emcc`)** — do kompilacji pliku `sudoku.c` do WebAssembly.
- **Python 3** (lub inny prosty serwer HTTP) — do lokalnego uruchomienia aplikacji.
- **`make`** (opcjonalnie) — do wygodnego budowania przez `Makefile`.

## Kompilacja przez Emscripten

Po zainstalowaniu i aktywowaniu środowiska `emsdk` uruchom w katalogu głównym projektu:

```bash
make
```

Lub bezpośrednio poleceniem `emcc`:

```bash
mkdir -p dist
cp index.html style.css app.js dist/
emcc sudoku.c \
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
  -s FILESYSTEM=0 \
  -o dist/sudoku-wasm.js
```

W katalogu `dist/` powstaną m.in. pliki `sudoku-wasm.js` oraz `sudoku-wasm.wasm` wraz ze skopiowanymi plikami statycznymi (`index.html`, `style.css`, `app.js`).

## Uruchomienie lokalne (serwer HTTP)

> **Ważne:** Nie otwieraj pliku `index.html` bezpośrednio z dysku przez protokół `file://`. Przeglądarki ze względów bezpieczeństwa blokują ładowanie modułów WebAssembly (`.wasm`) z lokalnego systemu plików przez `fetch`/`WebAssembly.instantiateStreaming`.

Po zbudowaniu katalogu `dist/` uruchom lokalny serwer HTTP:

```bash
cd dist
python3 -m http.server 8080
```

Lub z katalogu głównego:

```bash
make serve
```

Następnie otwórz w przeglądarce adres:

```text
http://localhost:8080
```

## Publikacja przez GitHub Pages (GitHub Actions)

Projekt zawiera gotowy workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), który automatycznie buduje WebAssembly i publikuje katalog `dist/` na GitHub Pages przy każdym pushu do gałęzi `master` (lub `main`).

1. Utwórz repozytorium na GitHubie i wypchnij kod na gałąź `master`.
2. W ustawieniach repozytorium przejdź do **Settings → Pages**.
3. W sekcji **Build and deployment** jako **Source** wybierz **GitHub Actions**.
4. Po zakończeniu pracy workflow strona będzie dostępna pod adresem:
   `https://<nazwa-użytkownika>.github.io/<nazwa-repozytorium>/`

Wszystkie ścieżki w projekcie są względne (`./style.css`, `./app.js`, `./sudoku-wasm.js`), dzięki czemu aplikacja działa poprawnie również w podkatalogu repozytorium.

## Struktura projektu

```text
.
├── .github/
│   └── workflows/
│       └── deploy.yml    # Automatyczne budowanie Emscripten i publikacja na GitHub Pages
├── .gitignore            # Ignorowanie katalogu dist/ oraz wygenerowanych plików WASM/JS
├── Makefile              # Skrypt budowania do katalogu dist/ i lokalnego serwowania
├── README.md             # Dokumentacja projektu
├── app.js                # Obsługa interfejsu, walidacji, historii zmian i komunikacji z WASM
├── index.html            # Struktura strony HTML5 z obsługą dostępności
├── style.css             # Style CSS3 (responsywność od 320 px, motyw jasny/ciemny)
└── sudoku.c              # Solver Sudoku w języku C (maski bitowe + MRV)
```
