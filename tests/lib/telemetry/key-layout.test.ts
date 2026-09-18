import { PHYSICAL_KEYS, buildKeyCountMap } from "@/lib/telemetry/key-layout";
import { KeyCounts } from "@/lib/telemetry/types";

describe("PHYSICAL_KEYS", () => {
  it("has unique key IDs", () => {
    const ids = PHYSICAL_KEYS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every tracked key has at least one data label", () => {
    for (const key of PHYSICAL_KEYS) {
      // Touch ID is a physical key with no telemetry data labels.
      if (key.id === "Touch ID") continue;
      expect(key.labels.length).toBeGreaterThan(0);
    }
  });

  it("includes the function row (Esc + F1-F12)", () => {
    const ids = PHYSICAL_KEYS.map((k) => k.id);
    expect(ids).toContain("Esc");
    for (let i = 1; i <= 12; i++) {
      expect(ids).toContain(`F${i}`);
    }
    expect(ids.filter((id) => /^F\d+$/.test(id)).length).toBe(12);
  });

  it("includes UK-specific Section key (key left of 1)", () => {
    const sectionKey = PHYSICAL_KEYS.find((k) => k.id === "Section");
    expect(sectionKey).toBeDefined();
    expect(sectionKey!.labels).toContain("§");
    expect(sectionKey!.labels).toContain("±");
  });

  it("includes modifier keys in bottom row", () => {
    const ids = PHYSICAL_KEYS.map((k) => k.id);
    expect(ids).toContain("Fn");
    expect(ids).toContain("Left Ctrl");
    expect(ids).toContain("Left Option");
    expect(ids).toContain("Left Cmd");
    expect(ids).toContain("Space");
    expect(ids).toContain("Right Cmd");
    expect(ids).toContain("Right Option");
  });

  it("includes arrow keys", () => {
    const ids = PHYSICAL_KEYS.map((k) => k.id);
    expect(ids).toContain("Left Arrow");
    expect(ids).toContain("Right Arrow");
    expect(ids).toContain("Up Arrow");
    expect(ids).toContain("Down Arrow");
  });

  it("does not include external-keyboard keys (F13-F20, media, keypad)", () => {
    // These keys exist only on external keyboards / macOS keycodes and are
    // intentionally not rendered on the M3 Air layout.
    const ids = PHYSICAL_KEYS.map((k) => k.id);
    for (let i = 13; i <= 20; i++) {
      expect(ids).not.toContain(`F${i}`);
    }
    expect(ids).not.toContain("Volume Up");
    expect(ids).not.toContain("Volume Down");
    expect(ids).not.toContain("Mute");
    expect(ids).not.toContain("Keypad 0");
    expect(ids).not.toContain("Keypad 9");
    expect(ids).not.toContain("Keypad Enter");
  });

  it("includes Touch ID, ordered after the function keys", () => {
    const ids = PHYSICAL_KEYS.map((key) => key.id);
    const touchId = ids.indexOf("Touch ID");
    expect(touchId).toBeGreaterThan(-1);
    expect(touchId).toBeGreaterThan(ids.indexOf("F12"));
  });
});

describe("buildKeyCountMap", () => {
  it("returns an empty map for empty input", () => {
    const result = buildKeyCountMap({});
    expect(result.size).toBe(0);
  });

  it("maps a single data label to its physical key", () => {
    const keys: KeyCounts = { A: 10 };
    const result = buildKeyCountMap(keys);
    expect(result.get("A")).toBe(10);
  });

  it("aggregates multiple labels onto the same physical key", () => {
    // The "1" key produces "1", "!" on UK Mac
    const keys: KeyCounts = { "1": 20, "!": 5 };
    const result = buildKeyCountMap(keys);
    expect(result.get("1")).toBe(25);
  });

  it("aggregates Section + Grave labels onto the Section key", () => {
    const keys: KeyCounts = { Section: 5, Grave: 3, "§": 7, "±": 2 };
    const result = buildKeyCountMap(keys);
    expect(result.get("Section")).toBe(17);
  });

  it("aggregates shift variants onto letter keys", () => {
    // Letters map via char.upper(), but shifted letters also upper() to
    // the same letter.  The key layout maps the uppercase letter directly.
    const keys: KeyCounts = { E: 10, "€": 3 };
    const result = buildKeyCountMap(keys);
    // E key: labels = ["E"]. "€" (option+2) is intentionally not tracked as a
    // currency symbol, so it never lands on the "2" key.
    expect(result.get("E")).toBe(10);
    expect(result.has("2")).toBe(false);
  });

  it("maps Forward Delete onto the Delete key (Fn+Delete)", () => {
    const keys: KeyCounts = { Delete: 50, "Forward Delete": 10, Help: 2 };
    const result = buildKeyCountMap(keys);
    expect(result.get("Delete")).toBe(62);
  });

  it("maps Fn+Arrow combos (Home/End/PageUp/PageDown) onto arrow keys", () => {
    const keys: KeyCounts = {
      "Left Arrow": 40,
      Home: 10,
      "Right Arrow": 35,
      End: 8,
      "Up Arrow": 20,
      "Page Up": 5,
      "Down Arrow": 25,
      "Page Down": 4,
    };
    const result = buildKeyCountMap(keys);
    expect(result.get("Left Arrow")).toBe(50);
    expect(result.get("Right Arrow")).toBe(43);
    expect(result.get("Up Arrow")).toBe(25);
    expect(result.get("Down Arrow")).toBe(29);
  });

  it("maps Numpad Enter onto Return key", () => {
    const keys: KeyCounts = { Return: 30, "Numpad Enter": 5 };
    const result = buildKeyCountMap(keys);
    expect(result.get("Return")).toBe(35);
  });

  it("silently ignores labels not in the layout", () => {
    const keys: KeyCounts = { UnknownKey: 99, A: 10 };
    const result = buildKeyCountMap(keys);
    expect(result.get("A")).toBe(10);
    expect(result.has("UnknownKey")).toBe(false);
  });

  it("maps shifted symbols onto their physical keys", () => {
    // UK Mac base with @/" swapped to US-style: shift+2 = @, shift+' = "
    const keys: KeyCounts = {
      "3": 10,
      "£": 5, // shift+3 — intentionally not tracked (currency symbol)
      "#": 2, // option+3 on UK Mac
      "'": 8,
      '"': 4, // shift+' → " on the Quote key
      ";": 12,
      ":": 3, // shift+; on UK Mac
      "@": 6, // shift+2 → @ on the "2" key
    };
    const result = buildKeyCountMap(keys);
    // "3" key = "3" + "#"; the "£" press is dropped from the count.
    expect(result.get("3")).toBe(12);
    expect(result.get("Quote")).toBe(12);
    expect(result.get("Semicolon")).toBe(15);
    expect(result.get("2")).toBe(6);
  });
});

describe("label coverage", () => {
  // All labels that the Python telemetry client (keymap.py + keyboard.py)
  // can emit for a UK Mac keyboard.  Every label must map to at least one
  // physical key so no data is silently dropped.
  const ALL_EXPECTED_LABELS = [
    // Letters
    "A","B","C","D","E","F","G","H","I","J","K","L","M",
    "N","O","P","Q","R","S","T","U","V","W","X","Y","Z",
    // Digits
    "0","1","2","3","4","5","6","7","8","9",
    // Modifiers
    "Left Shift","Right Shift","Left Ctrl","Right Ctrl",
    "Left Option","Right Option","Left Cmd","Right Cmd","Fn",
    // Editing / special
    "Return","Tab","Space","Delete","Escape","Caps Lock",
    "Forward Delete",
    // Navigation
    "Left Arrow","Right Arrow","Up Arrow","Down Arrow",
    "Home","End","Page Up","Page Down","Help",
    // Function keys
    "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
    "F13","F14","F15","F16","F17","F18","F19","F20",
    // Punctuation (UK Mac key labels from keymap)
    "Section","Grave","Minus","Equal","Left Bracket","Right Bracket",
    "Semicolon","Quote","Comma","Period","Slash","Backslash",
    // UK Mac shifted / option characters that keyboard.py may produce
    "!","\"","£","$","%","^","&","*","(",")","_","+",
    "{","}",";",":","'","@",",","<",">",".","?","/",
    "\\","|","§","±","#","€",
    // Media
    "Volume Up","Volume Down","Mute",
    // Keypad
    "Keypad 0","Keypad 1","Keypad 2","Keypad 3","Keypad 4",
    "Keypad 5","Keypad 6","Keypad 7","Keypad 8","Keypad 9",
    "Keypad .","Keypad *","Keypad +","Keypad -","Keypad /",
    "Keypad Enter","Keypad =","Keypad Clear","Numpad Enter",
  ];

  // Labels the Python client can emit but that are intentionally dropped:
  // external-keyboard / macOS keycodes (F13-F20, media, numpad) not rendered on
  // the M3 Air layout, plus the £/€ currency symbols that are deliberately not
  // tracked as heatmap characters.
  const INTENTIONALLY_UNMAPPED = [
    "F13","F14","F15","F16","F17","F18","F19","F20",
    "Volume Up","Volume Down","Mute",
    "Keypad 0","Keypad 1","Keypad 2","Keypad 3","Keypad 4",
    "Keypad 5","Keypad 6","Keypad 7","Keypad 8","Keypad 9",
    "Keypad .","Keypad *","Keypad +","Keypad -","Keypad /",
    "Keypad Enter","Keypad =","Keypad Clear",
    "£","€",
  ];

  it("maps every expected label to a physical key", () => {
    const unmapped: string[] = [];
    for (const label of ALL_EXPECTED_LABELS) {
      // Try with a single-label input to see if it maps to any physical key.
      const single = buildKeyCountMap({ [label]: 1 });
      if (single.size === 0) {
        unmapped.push(label);
      }
    }

    // Every unmapped label must be one we intentionally drop; if a label
    // appears here unexpectedly it means the PHYSICAL_KEYS layout is
    // missing a mapping and data would be silently lost.
    expect([...unmapped].sort()).toEqual([...INTENTIONALLY_UNMAPPED].sort());
  });
});
