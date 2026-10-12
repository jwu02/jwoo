import {
  RESUME_LOCALE_KEY,
  clearLocale,
  localeServerSnapshot,
  localeSnapshot,
  saveLocale,
  subscribeLocale,
} from "@/components/resume/locale-store"

beforeEach(() => {
  window.localStorage.clear()
})

describe("the resume's locale", () => {
  it("is English before any visit chooses", () => {
    expect(localeSnapshot()).toBe("en")
  })

  it("reads back the locale a visit chose", () => {
    saveLocale("zh")
    expect(localeSnapshot()).toBe("zh")

    saveLocale("en")
    expect(localeSnapshot()).toBe("en")
  })

  it("writes the choice under its own key", () => {
    saveLocale("zh")
    expect(window.localStorage.getItem(RESUME_LOCALE_KEY)).toBe("zh")
  })

  it("is English when the stored value names no locale", () => {
    window.localStorage.setItem(RESUME_LOCALE_KEY, "fr")
    expect(localeSnapshot()).toBe("en")
  })

  // The server has no storage to read, so it renders English and hydration
  // settles any difference.
  it("serves English to the server", () => {
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh")
    expect(localeServerSnapshot()).toBe("en")
  })
})

describe("clearing the resume's locale", () => {
  it("leaves the visitor where a first visit finds them", () => {
    saveLocale("zh")
    expect(localeSnapshot()).toBe("zh")

    clearLocale()

    expect(localeSnapshot()).toBe("en")
    expect(window.localStorage.getItem(RESUME_LOCALE_KEY)).toBeNull()
  })
})

describe("locale storage that cannot be used", () => {
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
      saveLocale("zh")
      expect(localeSnapshot()).toBe("zh")
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
    }
    const storage = jest
      .spyOn(window, "localStorage", "get")
      .mockReturnValue(failing as unknown as Storage)

    try {
      saveLocale("zh")
      expect(localeSnapshot()).toBe("zh")
    } finally {
      storage.mockRestore()
    }
  })

  // A clear must not look like it worked and then revert on the next read.
  it("drops the visit's own choice when storage refuses everything", () => {
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
      saveLocale("zh")
      clearLocale()

      expect(localeSnapshot()).toBe("en")
    } finally {
      storage.mockRestore()
    }
  })
})

describe("a locale change", () => {
  it("tells this tab's subscribers", () => {
    saveLocale("en")
    const onChange = jest.fn()
    const unsubscribe = subscribeLocale(onChange)

    saveLocale("zh")

    expect(onChange).toHaveBeenCalled()
    unsubscribe()
  })

  it("shows another tab's choice when storage changes", () => {
    // Establish this tab's own choice first, so the assertion below can only
    // pass by reading storage — not by whatever the last test left in memory.
    saveLocale("en")
    expect(localeSnapshot()).toBe("en")

    const onChange = jest.fn()
    const unsubscribe = subscribeLocale(onChange)

    // What another tab's write looks like here: the value lands in storage,
    // then the browser fires one event.
    window.localStorage.setItem(RESUME_LOCALE_KEY, "zh")
    window.dispatchEvent(
      new StorageEvent("storage", { key: RESUME_LOCALE_KEY })
    )

    expect(onChange).toHaveBeenCalled()
    expect(localeSnapshot()).toBe("zh")

    unsubscribe()
  })
})
