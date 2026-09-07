(function (global) {
  "use strict";

  const ASCII = Object.freeze({
    upper: Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
    lower: Array.from("abcdefghijklmnopqrstuvwxyz"),
    digits: Array.from("0123456789"),
  });

  function codePointRange(start, length) {
    return Array.from({ length }, function (_, index) {
      return String.fromCodePoint(start + index);
    });
  }

  function rangeWithOverrides(start, length, overrides) {
    const sequence = codePointRange(start, length);
    Object.keys(overrides).forEach(function (index) {
      sequence[Number(index)] = overrides[index];
    });
    return sequence;
  }

  function createCharacterMap(definition) {
    const map = new Map();

    ["upper", "lower", "digits"].forEach(function (group) {
      if (!definition[group]) return;

      const target = Array.from(definition[group]);
      if (target.length !== ASCII[group].length) {
        throw new Error("Mapa de caracteres inválido: " + group);
      }

      ASCII[group].forEach(function (character, index) {
        map.set(character, target[index]);
      });
    });

    return map;
  }

  function createFullwidthMap() {
    const map = new Map();
    for (let code = 33; code <= 126; code += 1) {
      map.set(String.fromCodePoint(code), String.fromCodePoint(code + 0xfee0));
    }
    return map;
  }

  function createCircledMap() {
    return createCharacterMap({
      upper: codePointRange(0x24b6, 26),
      lower: codePointRange(0x24d0, 26),
      digits: [String.fromCodePoint(0x24ea)].concat(
        codePointRange(0x2460, 9),
      ),
    });
  }

  function createParenthesizedMap() {
    const map = createCharacterMap({
      lower: codePointRange(0x249c, 26),
    });

    codePointRange(0x2474, 9).forEach(function (character, index) {
      map.set(String(index + 1), character);
    });
    return map;
  }

  const MAPS = Object.freeze({
    bold: createCharacterMap({
      upper: codePointRange(0x1d400, 26),
      lower: codePointRange(0x1d41a, 26),
      digits: codePointRange(0x1d7ce, 10),
    }),
    italic: createCharacterMap({
      upper: codePointRange(0x1d434, 26),
      lower: rangeWithOverrides(0x1d44e, 26, {
        7: String.fromCodePoint(0x210e),
      }),
    }),
    boldItalic: createCharacterMap({
      upper: codePointRange(0x1d468, 26),
      lower: codePointRange(0x1d482, 26),
    }),
    script: createCharacterMap({
      upper: rangeWithOverrides(0x1d49c, 26, {
        1: String.fromCodePoint(0x212c),
        4: String.fromCodePoint(0x2130),
        5: String.fromCodePoint(0x2131),
        7: String.fromCodePoint(0x210b),
        8: String.fromCodePoint(0x2110),
        11: String.fromCodePoint(0x2112),
        12: String.fromCodePoint(0x2133),
        17: String.fromCodePoint(0x211b),
      }),
      lower: rangeWithOverrides(0x1d4b6, 26, {
        4: String.fromCodePoint(0x212f),
        6: String.fromCodePoint(0x210a),
        14: String.fromCodePoint(0x2134),
      }),
    }),
    boldScript: createCharacterMap({
      upper: codePointRange(0x1d4d0, 26),
      lower: codePointRange(0x1d4ea, 26),
    }),
    fraktur: createCharacterMap({
      upper: rangeWithOverrides(0x1d504, 26, {
        2: String.fromCodePoint(0x212d),
        7: String.fromCodePoint(0x210c),
        8: String.fromCodePoint(0x2111),
        17: String.fromCodePoint(0x211c),
        25: String.fromCodePoint(0x2128),
      }),
      lower: codePointRange(0x1d51e, 26),
    }),
    boldFraktur: createCharacterMap({
      upper: codePointRange(0x1d56c, 26),
      lower: codePointRange(0x1d586, 26),
    }),
    doubleStruck: createCharacterMap({
      upper: rangeWithOverrides(0x1d538, 26, {
        2: String.fromCodePoint(0x2102),
        7: String.fromCodePoint(0x210d),
        13: String.fromCodePoint(0x2115),
        15: String.fromCodePoint(0x2119),
        16: String.fromCodePoint(0x211a),
        17: String.fromCodePoint(0x211d),
        25: String.fromCodePoint(0x2124),
      }),
      lower: codePointRange(0x1d552, 26),
      digits: codePointRange(0x1d7d8, 10),
    }),
    monospace: createCharacterMap({
      upper: codePointRange(0x1d670, 26),
      lower: codePointRange(0x1d68a, 26),
      digits: codePointRange(0x1d7f6, 10),
    }),
    sansSerif: createCharacterMap({
      upper: codePointRange(0x1d5a0, 26),
      lower: codePointRange(0x1d5ba, 26),
      digits: codePointRange(0x1d7e2, 10),
    }),
    sansSerifBold: createCharacterMap({
      upper: codePointRange(0x1d5d4, 26),
      lower: codePointRange(0x1d5ee, 26),
      digits: codePointRange(0x1d7ec, 10),
    }),
    sansSerifItalic: createCharacterMap({
      upper: codePointRange(0x1d608, 26),
      lower: codePointRange(0x1d622, 26),
    }),
    sansSerifBoldItalic: createCharacterMap({
      upper: codePointRange(0x1d63c, 26),
      lower: codePointRange(0x1d656, 26),
    }),
    smallCaps: createCharacterMap({
      upper: Array.from("ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ"),
      lower: Array.from("ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘꞯʀꜱᴛᴜᴠᴡxʏᴢ"),
    }),
    circled: createCircledMap(),
    parenthesized: createParenthesizedMap(),
    fullwidth: createFullwidthMap(),
  });  // created by ybook | https://github.com/ybook

  let letterOrNumberPattern;
  let emojiPattern;

  try {
    letterOrNumberPattern = new RegExp("[\\p{L}\\p{N}]", "u");
    emojiPattern = new RegExp("\\p{Extended_Pictographic}", "u");
  } catch (error) {
    letterOrNumberPattern = /[A-Za-z0-9À-ÖØ-öø-ÿ]/;
    emojiPattern = /$^/;
  }

  const segmenter =
    typeof Intl !== "undefined" && typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("pt-BR", { granularity: "grapheme" })
      : null;

  function splitGraphemes(text) {
    if (!segmenter) return Array.from(text);
    return Array.from(segmenter.segment(text), function (part) {
      return part.segment;
    });
  }

  function replaceCharacters(text, map) {
    return Array.from(text, function (character) {
      return map.get(character) || character;
    }).join("");
  }

  function addCombiningMark(text, mark) {
    return splitGraphemes(text)
      .map(function (grapheme) {
        const isEmoji =
          emojiPattern.test(grapheme) ||
          grapheme.includes("\ufe0f") ||
          grapheme.includes("\u20e3");

        if (
          isEmoji ||
          !letterOrNumberPattern.test(grapheme) ||
          grapheme.includes(mark)
        ) {
          return grapheme;
        }
        return grapheme + mark;
      })
      .join("");
  }

  const STYLES = Object.freeze([
    { id: "normal", name: "Normal" },
    { id: "bold", name: "Negrito", map: MAPS.bold },
    { id: "italic", name: "Itálico", map: MAPS.italic },
    { id: "bold-italic", name: "Negrito itálico", map: MAPS.boldItalic },
    { id: "serif-bold", name: "Serifado em negrito", map: MAPS.bold },
    { id: "serif-italic", name: "Serifado em itálico", map: MAPS.italic },
    { id: "script", name: "Script", map: MAPS.script },
    { id: "bold-script", name: "Script em negrito", map: MAPS.boldScript },
    { id: "fraktur", name: "Fraktur", map: MAPS.fraktur },
    {
      id: "bold-fraktur",
      name: "Fraktur em negrito",
      map: MAPS.boldFraktur,
    },
    {
      id: "double-struck",
      name: "Double-struck",
      map: MAPS.doubleStruck,
    },
    { id: "monospace", name: "Monoespaçado", map: MAPS.monospace },
    { id: "sans-serif", name: "Sans-serif", map: MAPS.sansSerif },
    {
      id: "sans-serif-bold",
      name: "Sans-serif em negrito",
      map: MAPS.sansSerifBold,
    },
    {
      id: "sans-serif-italic",
      name: "Sans-serif em itálico",
      map: MAPS.sansSerifItalic,
    },
    {
      id: "sans-serif-bold-italic",
      name: "Sans-serif em negrito e itálico",
      map: MAPS.sansSerifBoldItalic,
    },
    {
      id: "small-caps",
      name: "Small caps aproximado",
      map: MAPS.smallCaps,
    },
    { id: "circled", name: "Texto circulado", map: MAPS.circled },
    {
      id: "parenthesized",
      name: "Texto entre parênteses",
      map: MAPS.parenthesized,
    },
    { id: "fullwidth", name: "Fullwidth", map: MAPS.fullwidth },
    {
      id: "underline",
      name: "Sublinhado",
      transform: function (text) {
        return addCombiningMark(text, "\u0332");
      },
    },
    {
      id: "strikethrough",
      name: "Tachado",
      transform: function (text) {
        return addCombiningMark(text, "\u0336");
      },
    },
  ]);

  const STYLE_BY_ID = new Map(
    STYLES.map(function (style) {
      return [style.id, style];
    }),
  );

  function getStyle(styleId) {
    return STYLE_BY_ID.get(styleId) || STYLES[0];
  }

  function transform(text, styleOrId) {
    const style =
      typeof styleOrId === "string" ? getStyle(styleOrId) : styleOrId;
    if (style.transform) return style.transform(text);
    if (style.map) return replaceCharacters(text, style.map);
    return text;
  }

  global.TextStyleEngine = Object.freeze({
    styles: STYLES,
    getStyle: getStyle,
    splitGraphemes: splitGraphemes,
    transform: transform,
  });
})(window);
