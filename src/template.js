const { evaluate } = require('./evaluator');

const dictionary = {};
const iteratorName = '_iterator_';

function getProgram(str) {
  const re = /{{\s*([^}]+)\s*}}/g;
  let lastIndex = 0;
  const programBlock = { type: 'program', blocks: [], parent: null };
  let currentBlock = programBlock;
  let slice;
  let match = re.exec(str);
  while (match != null) {
    slice = { type: 'literal', text: str.slice(lastIndex, match.index) };
    currentBlock.blocks.push(slice);
    const expression = match[1].trim();
    if (expression.startsWith('#')) {
      const block = {
        type: 'forEach',
        text: str.slice(match.index, match.index + match[0].length),
        value: expression.slice(1),
        blocks: [],
        parent: currentBlock,
      };
      currentBlock.blocks.push(block);
      currentBlock = block;
    } else if (expression.startsWith('/#')) {
      currentBlock = currentBlock.parent;
    } else {
      slice = {
        type: 'expression',
        text: str.slice(match.index, match.index + match[0].length),
        value: expression,
      };
      currentBlock.blocks.push(slice);
    }
    lastIndex = match.index + match[0].length;
    match = re.exec(str);
  }
  slice = { type: 'literal', text: str.slice(lastIndex) };
  if (slice.text) {
    currentBlock.blocks.push(slice);
  }
  return programBlock;
}

function executeBlock(block, context) {
  if (block.type === 'forEach') {
    const value = evaluate(block.value, context);
    if (Array.isArray(value)) {
      const result = [];
      for (let i = 0; i < value.length; i += 1) {
        const item = value[i];
        const itemContext = { ...item, _parent_: context, _current_: item };
        for (let j = 0; j < block.blocks.length; j += 1) {
          const child = block.blocks[j];
          result.push(executeBlock(child, itemContext));
        }
      }
      return result.join('');
    }
    return '';
  }
  if (block.type === 'literal') {
    return block.text;
  }
  if (block.type === 'expression') {
    const value = evaluate(block.value, context);
    return value !== null && value !== undefined ? value : '';
  }
  if (block.type === 'program') {
    return block.blocks.map((x) => executeBlock(x, context)).join('');
  }
  return '';
}

function processString(str, context) {
  if (dictionary[str] === undefined) {
    dictionary[str] = getProgram(str);
  }
  const program = dictionary[str];
  return executeBlock(program, context);
}

function process(obj, context) {
  if (typeof obj === 'string') {
    return processString(obj, context);
  }
  if (Array.isArray(obj)) {
    const result = [];
    for (let i = 0; i < obj.length; i += 1) {
      const item = obj[i];
      if (
        item &&
        item[iteratorName] &&
        typeof item[iteratorName] === 'string' &&
        item[iteratorName].startsWith('#')
      ) {
        const iterable = context[item[iteratorName].slice(1)];
        for (let j = 0; j < iterable.length; j += 1) {
          const subitem = iterable[j];
          const itemContext = {
            ...subitem,
            _parent_: context,
            _current_: subitem,
          };
          const subresult = process(item, itemContext);
          delete subresult[iteratorName];
          result.push(subresult);
        }
      } else {
        result.push(process(item, context));
      }
    }
    return result;
  }
  if (obj !== null && typeof obj === 'object') {
    const keys = Object.keys(obj);
    const result = {};
    for (let i = 0; i < keys.length; i += 1) {
      result[keys[i]] = process(obj[keys[i]], context);
    }
    return result;
  }
  return obj;
}

function compile(str) {
  return (context = {}) => process(str, context);
}

function template(str, context) {
  return compile(str)(context);
}

module.exports = {
  compile,
  template,
};
