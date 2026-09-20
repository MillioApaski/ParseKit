'use strict';
// Browser-native syntax validation + token-based rewriting: never round-trip JSON numbers through IEEE-754.
class RawJSONNumber {
  constructor(raw) { this.raw = raw; }
}
const JSON_TOKEN = /"(?:\\[\s\S]|[^"\\])*"|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/y;
function jsonTokens(source) {
  JSON.parse(source); // Validate grammar, strings, escapes and trailing junk before any rewriting.
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    while (i < source.length && /[ \n\r\t]/.test(source[i])) i++;
    if (i === source.length) break;
    JSON_TOKEN.lastIndex = i;
    const match = JSON_TOKEN.exec(source);
    if (!match) throw Error('无法扫描 JSON 字符 ' + i);
    tokens.push(match[0]);
    i = JSON_TOKEN.lastIndex;
  }
  return tokens;
}
function formatJSONLossless(source, indent = '  ', minify = false) {
  const tokens = jsonTokens(source);
  if (minify) return tokens.join('');
  let result = '', depth = 0;
  const pad = () => indent.repeat(depth);
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i], previous = tokens[i - 1], next = tokens[i + 1];
    if (token === '{' || token === '[') {
      result += token;
      depth++;
      if (next !== (token === '{' ? '}' : ']')) result += '\n' + pad();
    } else if (token === '}' || token === ']') {
      depth--;
      if (previous !== (token === '}' ? '{' : '[')) result += '\n' + pad();
      result += token;
    } else if (token === ',') {
      result += ',\n' + pad();
    } else if (token === ':') {
      result += ': ';
    } else {
      result += token;
    }
  }
  return result;
}
// For tree/Diff, retain every unsafe or non-integer numeric lexeme instead of rounding it.
function parseJSONLossless(source) {
  const tokens = jsonTokens(source);
  let at = 0;
  function parseValue(depth) {
    if (depth > 500) throw Error('JSON 嵌套超过结构视图的 500 层限制');
    const token = tokens[at++];
    if (token === '{') {
      const object = Object.create(null);
      if (tokens[at] === '}') { at++; return object; }
      while (at < tokens.length) {
        const key = JSON.parse(tokens[at++]);
        at++; // ':', already grammar-validated by JSON.parse above
        object[key] = parseValue(depth + 1);
        if (tokens[at++] === '}') break;
      }
      return object;
    }
    if (token === '[') {
      const array = [];
      if (tokens[at] === ']') { at++; return array; }
      while (at < tokens.length) {
        array.push(parseValue(depth + 1));
        if (tokens[at++] === ']') break;
      }
      return array;
    }
    if (token[0] === '"') return JSON.parse(token);
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    return /^-?(?:0|[1-9]\d*)$/.test(token) && Number.isSafeInteger(Number(token))
      ? Number(token) : new RawJSONNumber(token);
  }
  return parseValue(0);
}
