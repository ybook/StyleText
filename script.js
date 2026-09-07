(function () {
  "use strict";

  const Engine = window.TextStyleEngine;
  if (!Engine) {
    throw new Error("O motor de estilos não foi carregado.");
  }

  const SETTINGS = Object.freeze({
    exampleText: "Texto de exemplo",
    previewLimit: 72,
    styleStorageKey: "text-transformer-style",
    themeStorageKey: "text-transformer-theme",
    toastDuration: 1900,
    themeDuration: 760,
  });

  const elements = Object.freeze({
    root: document.documentElement,
    source: document.getElementById("sourceText"),
    result: document.getElementById("resultText"),
    styleTrigger: document.getElementById("styleTrigger"),
    styleTriggerValue: document.getElementById("styleTriggerValue"),
    popover: document.getElementById("stylePopover"),
    styleList: document.getElementById("styleList"),
    copyButton: document.getElementById("copyButton"),
    toast: document.getElementById("copyToast"),
    toastText: document.getElementById("copyToastText"),
    themeButton: document.getElementById("themeToggle"),
    themeWipe: document.getElementById("themeWipe"),
    themeColor: document.querySelector('meta[name="theme-color"]'),
  });

  const stylesById = new Map(
    Engine.styles.map(function (style) {
      return [style.id, style];
    }),
  );
  const optionsById = new Map();
  const previewsById = new Map();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const storage = {
    get: function (key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
      }
    },
  };

  const state = {
    currentStyle: getStoredStyle(),
    toastTimer: 0,
    typeaheadTimer: 0,
    typeaheadValue: "",
    themeAnimating: false,
  };

  function getStoredStyle() {
    const savedId = storage.get(SETTINGS.styleStorageKey);
    return stylesById.get(savedId) || Engine.styles[0];
  }

  function getDisplaySource() {
    return elements.source.value.length
      ? elements.source.value
      : SETTINGS.exampleText;
  }

  function getShortPreview(text) {
    const graphemes = Engine.splitGraphemes(text);
    const preview = graphemes.slice(0, SETTINGS.previewLimit).join("");
    return graphemes.length > SETTINGS.previewLimit ? preview + "…" : preview;
  }

  function normalizeForSearch(value) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  function resizeTextarea() {
    elements.source.style.height = "auto";

    const computed = window.getComputedStyle(elements.source);
    const minimum = Number.parseFloat(computed.minHeight) || 0;
    const maximum = Number.parseFloat(computed.maxHeight) || 235;
    const height = Math.min(
      Math.max(elements.source.scrollHeight, minimum),
      maximum,
    );

    elements.source.style.height = height + "px";
    elements.source.style.overflowY =
      elements.source.scrollHeight > maximum ? "auto" : "hidden";
  }

  function buildStyleOptions() {
    const fragment = document.createDocumentFragment();

    Engine.styles.forEach(function (style) {
      const option = document.createElement("button");
      const name = document.createElement("span");
      const preview = document.createElement("span");

      option.type = "button";
      option.className = "style-option";
      option.dataset.styleId = style.id;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      option.tabIndex = -1;

      name.className = "style-option-name";
      name.textContent = style.name;

      preview.className = "style-option-preview";

      option.append(name, preview);
      fragment.appendChild(option);
      optionsById.set(style.id, option);
      previewsById.set(style.id, preview);
    });

    elements.styleList.appendChild(fragment);
  }

  function render() {
    const isExample = elements.source.value.length === 0;
    const source = getDisplaySource();
    const previewSource = getShortPreview(source);

    elements.result.textContent = Engine.transform(source, state.currentStyle);
    elements.result.classList.toggle("is-example", isExample);
    elements.styleTriggerValue.textContent = state.currentStyle.name;
    elements.styleTrigger.setAttribute(
      "aria-label",
      "Escolher estilo. Atual: " + state.currentStyle.name,
    );

    Engine.styles.forEach(function (style) {
      const selected = style.id === state.currentStyle.id;
      const option = optionsById.get(style.id);
      option.setAttribute("aria-selected", String(selected));
      option.tabIndex = selected ? 0 : -1;
      previewsById.get(style.id).textContent = Engine.transform(
        previewSource,
        style,
      );
    });
  }

  const styleMenu = {
    isOpen: function () {
      return elements.popover.classList.contains("is-open");
    },

    select: function (styleId) {
      state.currentStyle = stylesById.get(styleId) || Engine.styles[0];
      storage.set(SETTINGS.styleStorageKey, state.currentStyle.id);
      render();
      this.close(true);
    },

    position: function () {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.visualViewport
        ? window.visualViewport.height
        : window.innerHeight;
      const margin = viewportWidth <= 620 ? 10 : 14;
      const gap = 8;
      const triggerRect = elements.styleTrigger.getBoundingClientRect();
      const width = Math.min(360, viewportWidth - margin * 2);

      elements.popover.style.width = width + "px";
      elements.popover.style.maxHeight =
        viewportHeight - margin * 2 + "px";

      const height = Math.min(
        elements.popover.offsetHeight,
        viewportHeight - margin * 2,
      );
      const roomAbove = triggerRect.top - margin;
      const roomBelow = viewportHeight - triggerRect.bottom - margin;
      const placeAbove = roomAbove >= height + gap || roomAbove > roomBelow;
      const top = placeAbove
        ? Math.max(margin, triggerRect.top - height - gap)
        : Math.min(
            viewportHeight - height - margin,
            triggerRect.bottom + gap,
          );
      const left = Math.min(
        Math.max(triggerRect.left, margin),
        viewportWidth - width - margin,
      );

      elements.popover.dataset.placement = placeAbove ? "top" : "bottom";
      elements.popover.style.top = Math.round(top) + "px";
      elements.popover.style.left = Math.round(left) + "px";
    },

    focus: function (index) {
      const options = Array.from(optionsById.values());
      const safeIndex = (index + options.length) % options.length;

      options.forEach(function (option, optionIndex) {
        option.tabIndex = optionIndex === safeIndex ? 0 : -1;
      });

      options[safeIndex].focus({ preventScroll: true });
      options[safeIndex].scrollIntoView({
        block: "nearest",
        behavior: reducedMotion.matches ? "auto" : "smooth",
      });
    },

    open: function (focusIndex) {
      if (this.isOpen()) return;

      elements.popover.removeAttribute("inert");
      elements.popover.setAttribute("aria-hidden", "false");
      elements.styleTrigger.setAttribute("aria-expanded", "true");
      this.position();
      elements.popover.classList.add("is-open");

      const selectedIndex = Engine.styles.findIndex(function (style) {
        return style.id === state.currentStyle.id;
      });
      const nextIndex =
        typeof focusIndex === "number" ? focusIndex : selectedIndex;

      window.requestAnimationFrame(function () {
        styleMenu.focus(nextIndex);
      });
    },

    close: function (restoreFocus) {
      if (!this.isOpen()) return;

      elements.popover.classList.remove("is-open");
      elements.popover.setAttribute("aria-hidden", "true");
      elements.popover.setAttribute("inert", "");
      elements.styleTrigger.setAttribute("aria-expanded", "false");
      render();

      if (restoreFocus) {
        elements.styleTrigger.focus({ preventScroll: true });
      }
    },

    typeahead: function (key) {
      window.clearTimeout(state.typeaheadTimer);
      state.typeaheadValue += key;

      const query = normalizeForSearch(state.typeaheadValue);
      const activeId = document.activeElement.dataset.styleId;
      const activeIndex = Math.max(
        0,
        Engine.styles.findIndex(function (style) {
          return style.id === activeId;
        }),
      );

      for (let step = 1; step <= Engine.styles.length; step += 1) {
        const index = (activeIndex + step) % Engine.styles.length;
        if (normalizeForSearch(Engine.styles[index].name).startsWith(query)) {
          this.focus(index);
          break;
        }
      }

      state.typeaheadTimer = window.setTimeout(function () {
        state.typeaheadValue = "";
      }, 700);
    },
  };

  const clipboard = {
    fallbackCopy: function (text) {
      const temporary = document.createElement("textarea");
      const previousFocus = document.activeElement;

      temporary.value = text;
      temporary.setAttribute("readonly", "");
      temporary.style.position = "fixed";
      temporary.style.left = "-9999px";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.select();
      temporary.setSelectionRange(0, temporary.value.length);

      const copied = document.execCommand("copy");
      temporary.remove();

      if (previousFocus instanceof HTMLElement) {
        previousFocus.focus({ preventScroll: true });
      }
      if (!copied) throw new Error("Cópia não autorizada.");
    },

    copy: async function () {
      const text = elements.result.textContent || "";

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else {
          this.fallbackCopy(text);
        }
        toast.show("Texto copiado");
      } catch (error) {
        try {
          this.fallbackCopy(text);
          toast.show("Texto copiado");
        } catch (fallbackError) {
          toast.show("Não foi possível copiar");
        }
      }
    },
  };

  const toast = {
    show: function (message) {
      window.clearTimeout(state.toastTimer);
      elements.toastText.textContent = message;
      elements.toast.classList.remove("is-visible");

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          elements.toast.classList.add("is-visible");
        });
      });

      state.toastTimer = window.setTimeout(function () {
        elements.toast.classList.remove("is-visible");
      }, SETTINGS.toastDuration);
    },
  };

  const theme = {
    current: function () {
      return elements.root.dataset.theme === "light" ? "light" : "dark";
    },

    apply: function (nextTheme) {
      elements.root.dataset.theme = nextTheme;
      elements.root.style.colorScheme = nextTheme;
      elements.themeColor.setAttribute(
        "content",
        nextTheme === "light" ? "#f5f5f3" : "#050505",
      );
      storage.set(SETTINGS.themeStorageKey, nextTheme);
      this.updateButton();
    },

    updateButton: function () {
      const target = this.current() === "dark" ? "claro" : "escuro";
      const label = "Ativar tema " + target;
      elements.themeButton.setAttribute("aria-label", label);
      elements.themeButton.setAttribute("title", label);
    },

    geometry: function () {
      const rect = elements.themeButton.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const farthestX = Math.max(x, window.innerWidth - x);
      const farthestY = Math.max(y, window.innerHeight - y);
      const radius = Math.hypot(farthestX, farthestY);

      return {
        x: x,
        y: y,
        radius: radius,
        scale: (radius * 2) / 22 + 0.2,
      };
    },

    fallback: async function (nextTheme, geometry) {
      const wipe = elements.themeWipe;
      wipe.dataset.nextTheme = nextTheme;
      wipe.style.left = geometry.x + "px";
      wipe.style.top = geometry.y + "px";
      wipe.style.setProperty("--wipe-scale", geometry.scale);
      wipe.classList.add("is-active");

      await new Promise(function (resolve) {
        window.setTimeout(resolve, SETTINGS.themeDuration);
      });

      elements.root.classList.add("theme-transitioning");
      this.apply(nextTheme);
      wipe.classList.add("is-fading");

      await new Promise(function (resolve) {
        window.setTimeout(resolve, 180);
      });

      wipe.classList.remove("is-active", "is-fading");
      elements.root.classList.remove("theme-transitioning");
    },

    toggle: async function () {
      if (state.themeAnimating) return;

      const nextTheme = this.current() === "dark" ? "light" : "dark";
      const geometry = this.geometry();
      elements.root.style.setProperty("--theme-x", geometry.x + "px");
      elements.root.style.setProperty("--theme-y", geometry.y + "px");
      elements.root.style.setProperty(
        "--theme-radius",
        geometry.radius + "px",
      );

      if (reducedMotion.matches) {
        this.apply(nextTheme);
        return;
      }

      state.themeAnimating = true;

      if (typeof document.startViewTransition !== "function") {
        await this.fallback(nextTheme, geometry);
        state.themeAnimating = false;
        return;
      }

      elements.root.classList.add("theme-transitioning");
      try {
        const transition = document.startViewTransition(
          function () {
            theme.apply(nextTheme);
          },
        );
        await transition.finished;
      } catch (error) {
        this.apply(nextTheme);
      } finally {
        elements.root.classList.remove("theme-transitioning");
        state.themeAnimating = false;
      }
    },
  };

  function bindEvents() {
    elements.source.addEventListener("input", function () {
      resizeTextarea();
      render();
    });

    elements.styleTrigger.addEventListener("click", function () {
      if (styleMenu.isOpen()) {
        styleMenu.close(true);
      } else {
        styleMenu.open();
      }
    });

    elements.styleTrigger.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

      event.preventDefault();
      const selectedIndex = Engine.styles.findIndex(function (style) {
        return style.id === state.currentStyle.id;
      });
      styleMenu.open(
        event.key === "ArrowDown"
          ? Math.min(selectedIndex + 1, Engine.styles.length - 1)
          : Math.max(selectedIndex - 1, 0),
      );
    });

    elements.styleList.addEventListener("click", function (event) {
      const option = event.target.closest(".style-option");
      if (option) styleMenu.select(option.dataset.styleId);
    });

    elements.popover.addEventListener("keydown", function (event) {
      const options = Array.from(optionsById.values());
      const currentIndex = options.indexOf(document.activeElement);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        styleMenu.focus(currentIndex + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        styleMenu.focus(currentIndex - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        styleMenu.focus(0);
      } else if (event.key === "End") {
        event.preventDefault();
        styleMenu.focus(options.length - 1);
      } else if (event.key === "Escape") {
        event.preventDefault();
        styleMenu.close(true);
      } else if (event.key === "Tab") {
        event.preventDefault();
        styleMenu.close(false);
        (event.shiftKey ? elements.source : elements.copyButton).focus({
          preventScroll: true,
        });
      } else if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        styleMenu.typeahead(event.key);
      }
    });

     // created by ybook | https://github.com/ybook

    elements.copyButton.addEventListener("click", function () {
      clipboard.copy();
    });

    elements.themeButton.addEventListener("click", function () {
      theme.toggle();
    });

    document.addEventListener("pointerdown", function (event) {
      if (
        styleMenu.isOpen() &&
        !elements.popover.contains(event.target) &&
        !elements.styleTrigger.contains(event.target)
      ) {
        styleMenu.close(false);
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && styleMenu.isOpen()) {
        event.preventDefault();
        styleMenu.close(true);
      }
    });

    window.addEventListener("resize", function () {
      resizeTextarea();
      if (styleMenu.isOpen()) styleMenu.position();
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        if (styleMenu.isOpen()) styleMenu.position();
      });
    }
  }

  function init() {
    buildStyleOptions();
    render();
    resizeTextarea();
    theme.apply(theme.current());
    bindEvents();
  }

  init();
})();
