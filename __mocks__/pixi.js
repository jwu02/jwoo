function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffff;
  }
  return h || 0x000001;
}

class Container {
  constructor() {
    this.children = [];
    this.position = {
      x: 0,
      y: 0,
      set: (x, y) => {
        this.position.x = x;
        this.position.y = y;
      },
    };
    this.scale = {
      x: 1,
      y: 1,
      set: (x, y) => {
        this.scale.x = x;
        this.scale.y = y ?? x;
      },
    };
    this.eventMode = "none";
    this.visible = true;
    this.alpha = 1;
    this.label = "";
    this.x = 0;
    this.y = 0;
  }

  addChild(child) {
    this.children.push(child);
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
  }

  destroy() {
    this.children.length = 0;
  }
}

class Sprite extends Container {
  constructor(texture) {
    super();
    this.texture = texture;
    this.anchor = {
      x: 0,
      y: 0,
      set: (x, y) => {
        this.anchor.x = x;
        this.anchor.y = y ?? x;
      },
    };
    this.eventMode = "none";
    this.cursor = "default";
    this.tint = 0xffffff;
    this.width = 0;
    this.height = 0;
    this.rotation = 0;
    this.__handlers = {};
  }

  on(event, fn) {
    this.__handlers[event] = fn;
    return this;
  }

  off(event) {
    delete this.__handlers[event];
    return this;
  }

  emit(event, data) {
    const handler = this.__handlers[event];
    if (handler) handler(data);
  }
}

class Graphics extends Container {
  constructor() {
    super();
    this.__circleRadius = null;
  }
  circle(x, y, radius) {
    this.__circleRadius = radius;
    return this;
  }
  fill() {
    return this;
  }
}

class Texture {
  static WHITE = new Texture();
}

class Color {
  constructor(value) {
    this.value = String(value ?? "#000000");
  }
  toNumber() {
    return hashString(this.value);
  }
}

class Application {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.__pixiApp = this;
    this.stage = new Container();
    this.renderer = {
      generateTexture: (target) => {
        // Keep the source the texture was rasterized from so tests can assert
        // the resolution the node circle was drawn at.
        this.__textureSource = target;
        return new Texture();
      },
    };
    this.ticker = {
      add: () => {},
      remove: () => {},
    };
    this.__destroyed = false;
  }

  async init(options) {
    this.options = options;
  }

  destroy(rendererDestroyOptions, options) {
    // Mirror real PixiJS v8: destroying the Application destroys the stage's
    // children and nulls app.stage, so any later `app.stage.removeChild(...)`
    // throws. The mock previously left `stage` intact, hiding the bug.
    this.__destroyed = true;
    this.stage.destroy(options);
    this.stage = null;
    this.renderer = null;
  }
}

module.exports = {
  Application,
  Container,
  Sprite,
  Graphics,
  Texture,
  Color,
};
