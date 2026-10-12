import {
  APPEARANCE_KEY,
  appearanceScript,
  appearanceServerSnapshot,
  appearanceSnapshot,
  clearAppearance,
  saveAppearance,
  subscribeAppearance,
} from "@/components/os/appearance"

/** Whether the OS is currently drawn in the dark appearance. */
function isDark() {
  return document.documentElement.classList.contains("dark")
}

/** Answer `prefers-color-scheme` the way a visitor's system does. jsdom
 * implements no matchMedia, so the fresh-visit default is light unless a test
 * says otherwise. */
function mockSystem(dark: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: dark && query === "(prefers-color-scheme: dark)",
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(() => false),
  }))
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove("dark")
  Reflect.deleteProperty(window, "matchMedia")
})

describe("the appearance", () => {
  it("follows the visitor's system before any visit chooses", () => {
    mockSystem(true)
    expect(appearanceSnapshot()).toBe("dark")

    mockSystem(false)
    expect(appearanceSnapshot()).toBe("light")
  })

  it("reads back the appearance a visit chose", () => {
    saveAppearance("light")
    expect(appearanceSnapshot()).toBe("light")

    saveAppearance("dark")
    expect(appearanceSnapshot()).toBe("dark")
  })

  it("puts the appearance in effect on the document", () => {
    saveAppearance("light")
    expect(isDark()).toBe(false)

    saveAppearance("dark")
    expect(isDark()).toBe(true)
  })

  it("follows the system when the stored value names neither appearance", () => {
    mockSystem(true)
    window.localStorage.setItem(APPEARANCE_KEY, "sepia")

    expect(appearanceSnapshot()).toBe("dark")
  })

  it("is the appearance the server renders when nothing is stored", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "light")
    expect(appearanceServerSnapshot()).toBe("dark")
  })
})

describe("clearing the appearance", () => {
  // What a later ticket's Data section deletes: back to where a first visit
  // finds the visitor, not back to dark.
  it("leaves the visitor where a first visit finds them", () => {
    mockSystem(false)
    saveAppearance("dark")
    expect(isDark()).toBe(true)

    clearAppearance()

    expect(appearanceSnapshot()).toBe("light")
    expect(isDark()).toBe(false)
    expect(window.localStorage.getItem(APPEARANCE_KEY)).toBeNull()
  })
})

describe("appearance storage that cannot be used", () => {
  // A private-mode browser has storage that throws rather than stores.
  it("remembers the choice for this visit when storage refuses everything", () => {
    const failing = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    }
    failing.getItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    failing.setItem.mockImplementation(() => {
      throw new Error("storage disabled")
    })
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      saveAppearance("dark")
      expect(appearanceSnapshot()).toBe("dark")
      expect(isDark()).toBe(true)
    } finally {
      storage.mockRestore()
    }
  })

  // A store that reads but refuses to write would otherwise hand the next
  // snapshot the nothing it has stored, losing the visit's own choice.
  it("remembers the choice when storage refuses to write", () => {
    const failing = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(() => {
        throw new Error("quota exceeded")
      }),
      removeItem: jest.fn(),
    }
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      saveAppearance("dark")
      expect(appearanceSnapshot()).toBe("dark")
    } finally {
      storage.mockRestore()
    }
  })
})

describe("another tab's choice", () => {
  it("shows here and says so when storage changes", () => {
    // Establish this tab's own choice first, so the assertion below can only
    // pass by reading storage — not by whatever the last test left in memory.
    saveAppearance("light")
    expect(isDark()).toBe(false)

    const onChange = jest.fn()
    const unsubscribe = subscribeAppearance(onChange)

    // What another tab's write looks like here: the value lands in storage,
    // then the browser fires one event.
    window.localStorage.setItem(APPEARANCE_KEY, "dark")
    window.dispatchEvent(new StorageEvent("storage", { key: APPEARANCE_KEY }))

    expect(onChange).toHaveBeenCalled()
    expect(isDark()).toBe(true)

    unsubscribe()
  })
})

describe("the pre-paint script", () => {
  // The script restates the store's own resolution as a string the document can
  // run, so it is run here against the same storage the store reads.
  function runScript() {
    new Function(appearanceScript)()
  }

  it("applies a stored choice", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "light")
    runScript()
    expect(isDark()).toBe(false)

    window.localStorage.setItem(APPEARANCE_KEY, "dark")
    runScript()
    expect(isDark()).toBe(true)
  })

  it("falls back to the system when nothing usable is stored", () => {
    window.localStorage.setItem(APPEARANCE_KEY, "sepia")
    mockSystem(true)

    runScript()

    expect(isDark()).toBe(true)
  })

  it("still resolves the system when storage throws", () => {
    mockSystem(true)
    const failing = {
      getItem: jest.fn(() => {
        throw new Error("storage disabled")
      }),
    }
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      runScript()
      expect(isDark()).toBe(true)
    } finally {
      storage.mockRestore()
    }
  })
})
