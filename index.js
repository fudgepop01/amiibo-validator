const colors = require("colors"); // for colorful console output
const maboii = require("maboii"); // to decrypt amiibo bins
const { createInterface } = require("readline"); // to make sure the window doesn't IMMEDIATELY close upon finishing
const { readFileSync, readdirSync, writeFileSync, mkdirSync } = require("fs");

let out = '';
const sep = ' | '.white.bgBlack;
const newLine = '\n  '.bgBlack;
const addHeadings = (opts, maxCharNameLength) => {
  out += `amiibo stats:${newLine}`.underline;
  let outHeadings = '';
  outHeadings += `${'name'.padStart(maxCharNameLength, ' ')}`.black.bgWhite;
  outHeadings += sep + 'banned?'.black.bgWhite;
  if (opts.SHOULD_BAN_ABILITIES) outHeadings += sep + 'abilities'.black.bgWhite;
  if (opts.LIMIT_STAT_MODIFICATION) outHeadings += sep + 'stats'.black.bgWhite;
  if (opts.SHOULD_BAN_TYPING) outHeadings += sep + 'typing'.black.bgWhite;
  if (opts.BAN_AMIIBOX) outHeadings += sep + 'amiibox'.black.bgWhite;
  out += outHeadings + newLine + ''.padStart(colors.stripColors(outHeadings).length, '-') + newLine;
}

let outLine = '';
const addToOut = (stat, didPass) => {
  outLine += sep;
  if (didPass) outLine += 'pass'.padStart(stat.length, ' ').green.bgGreen;
  else outLine += 'fail'.padStart(stat.length, ' ').red.bgRed;
}

const newOutLine = () => {
  out += outLine + newLine;
  outLine = '';
}

const parseOpts = () => {
  const out = {
    AUTO_SORT: true,
    BAN_AMIIBOX: true,
    LIMIT_STAT_MODIFICATION: true,
    MAX_DEFENSE: 0,
    MIN_DEFENSE: 0,
    MAX_ATTACK: 0,
    MIN_ATTACK: 0,
    STAT_TOTAL_MAX: 0,
    SHOULD_BAN_TYPING: true,
    BANNED_TYPES: [
      'attack',
      'defense',
      'grab'
    ],
    SHOULD_BAN_ABILITIES: true,
    ABILITY_BAN_MODE: 'exclude',
    ABILITIES: [],
    _abilities: undefined,
    get ABILITY_LIST() {
      if (!this._abilities)
        this._abilities = readFileSync('./abilities.txt', 'utf8').replace(/\r/g, '').split('\n');
      return this._abilities;
    }
  }

  const files = readdirSync('.');
  let cfg = '';
  if (!files.includes('rules.txt')) return out;
  else cfg = readFileSync('./rules.txt', 'utf8');

  let inArray = false;
  let arrayName = '';
  const validParams = Object.keys(out);
  for (const line of cfg.replace(/\r/g, '').split('\n').map(l => l.trim())) {
    if (line.length === 0 || line.startsWith('#')) continue;

    if (inArray) {
      if (line.endsWith(']')) {
        inArray = false;
        continue;
      }
      out[arrayName].push(line.replace(/,/g, ''));
    } else {
      const data = line.split('=').map(str => str.trim());
      if (validParams.includes(data[0])) {
        out[data[0]] = undefined;
        switch(data[1]) {
          case '[':
            out[data[0]] = [];
            inArray = true;
            arrayName = data[0];
            continue;
          case 'true':
            out[data[0]] = true;
            break;
          case 'false':
            out[data[0]] = false;
            break;
          case 'include':
          case 'exclude':
            out[data[0]] = data[1];
            break;
          default:
            out[data[0]] = parseInt(data[1]);
            break;
        }
      }
    }
  }

  return out;
}

const opts = parseOpts();
if (opts.SHOULD_BAN_ABILITIES && opts.ABILITIES.length !== 0) {
  opts.ABILITIES = opts.ABILITIES.map(a => opts.ABILITY_LIST.indexOf(a));
}
if (opts.SHOULD_BAN_TYPING) {
  opts.BANNED_TYPES = opts.BANNED_TYPES.map(type => {
    switch(type) {
      case 'normal': return 0;
      case 'attack': return 1;
      case 'defense': return 2;
      case 'grab': return 3;
    }
  })
}
if (opts.AUTO_SORT) {
  const files = readdirSync('.');
  if (!files.includes('fail')) mkdirSync('./fail');
  if (!files.includes('pass')) mkdirSync('./pass');
}

const binFileList = readdirSync(`./to_validate`);
const maxCharNameLength = binFileList.reduce((r, e) => r.length < e.length ? e : r, "").length;

addHeadings(opts, maxCharNameLength);

const keys = maboii.loadMasterKeys([...readFileSync(`${__dirname}/key_retail.bin`)]);
for (const bin of binFileList) {
  const file = readFileSync(`./to_validate/${bin}`);
  const buf = Buffer.from(
    maboii.unpack(
      keys, // keys
      [...file] // array of bytes that make up the amiibo bin
    ).unpacked
  );

  const abilities = [
    buf.readUInt8(0xEC), // slot 1
    buf.readUInt8(0xED), // slot 2
    buf.readUInt8(0xEE)  // slot 3
  ];
  const stats = [
    buf.readInt16LE(0x150), // attack
    buf.readInt16LE(0x152)  // defense
  ];
  const type = buf.readUInt8(0xE3) // amiibo type (attack, defense, grab, untyped)

  let isBanned = false;

  if (opts.SHOULD_BAN_ABILITIES) {
    let hasBannedAbility = false;
    for (const ability of abilities) {
      if (ability === 0) continue;
      if (opts.ABILITY_BAN_MODE === 'include') {
        if (opts.ABILITIES.includes('ability')) hasBannedAbility = true;
      }
      else if (!opts.ABILITIES.includes(ability)) {
        hasBannedAbility = true;
      }
    }
    if (hasBannedAbility) {
      isBanned = true;
      addToOut('abilities', false);
    }
    else addToOut('abilities', true);
  }

  if (opts.LIMIT_STAT_MODIFICATION) {
    if (
      stats[0] < opts.MIN_ATTACK || opts.MAX_ATTACK < stats[0]
      || stats[1] < opts.MIN_DEFENSE || opts.MAX_DEFENSE < stats[0]
      || Math.abs(stats[0]) + Math.abs(stats[1]) > opts.STAT_TOTAL_MAX
    ) {
      isBanned = true;
      addToOut('stats', false);
    } else {
      addToOut('stats', true);
    }
  }

  if (opts.SHOULD_BAN_TYPING) {
    if (opts.BANNED_TYPES.includes((type & 0b11000000) >> 6)) {
      isBanned = true;
      addToOut('typing', false);
    } else {
      addToOut('typing', true);
    }
  }

  if (opts.BAN_AMIIBOX) {
    if (type & 1 !== 0) {
      isBanned = true;
      addToOut('amiibox', false);
    } else {
      addToOut('amiibox', true);
    }
  }

  if (opts.AUTO_SORT) {
    if (isBanned) writeFileSync('./fail/' + bin, file);
    else writeFileSync('./pass/' + bin, file);
  }

  out += bin.padStart(maxCharNameLength, ' ').black.bgWhite + sep;
  if (isBanned) {
    out += '   fail'.red.bgRed;
  } else {
    out += '   pass'.green.bgGreen;
  }

  newOutLine();
}

console.log(out);

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.setPrompt("finished! press enter to exit");
rl.prompt();
rl.on("line", () => {
  rl.close();
})