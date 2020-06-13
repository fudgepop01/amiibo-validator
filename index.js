const colors = require("colors"); // for colorful console output
const maboii = require("maboii"); // to decrypt amiibo bins
const {createInterface} = require("readline"); // to make sure the window doesn't IMMEDIATELY close upon finishing
const {readFileSync, readdirSync} = require("fs");

const newLine = ' \n '.bgBlack.white;
const keys = maboii.loadMasterKeys([...readFileSync(`${__dirname}/key_retail.bin`)]);
let out = 'amiibo list:'.bgWhite.black + newLine;
const binFileList = readdirSync(`./to_validate`);
const longestFileLen = binFileList.reduce((r, e) => r.length < e.length ? e : r, "").length;

out += `${'name'.padEnd(longestFileLen, ' ')} | vanilla? | spirits | stats | type`.bgWhite.black + newLine;
out += `${''.padEnd(longestFileLen, '-')}--------------------------------------${newLine}`.bgBlack.white;

for (const bin of binFileList) {
  const buf = Buffer.from(
    maboii.unpack(
      keys, // keys
      [...readFileSync(`./to_validate/${bin}`)] // array of bytes that make up the amiibo bin
    ).unpacked
  );

  const spirits = [
    buf.readUInt8(0xEC), // slot 1
    buf.readUInt8(0xED), // slot 2
    buf.readUInt8(0xEE)  // slot 3
  ];
  const stats = [
    buf.readInt16LE(0x150), // attack
    buf.readInt16LE(0x152)  // defense
  ];
  const type = buf.readUInt8(0xE3) // amiibo type (attack, defense, grab, untyped)
  let spiritMod = false,
      statMod = false,
      typeMod = false;

  if (!(spirits[0] === 0 && spirits[1] === 0 && spirits[2] === 0)) {
    spiritMod = true;
  }
  if (!(stats[0] === 0 && stats[1] === 0)) {
    statMod = true;
  }
  if (!(type === 0)) {
    typeMod = true;
  }
  let line = '';
  const sep = ' | '.bgBlack.white;
  const nameOut = bin.padStart(longestFileLen, ' ').bgWhite.black;
  const modifiedOut = (spiritMod || statMod || typeMod) ? '        '.bgRed : '        '.bgGreen;
  const spiritModOut = (spiritMod) ? '       '.bgRed : '       '.bgGreen;
  const statModOut = (spiritMod) ? '     '.bgRed : '     '.bgGreen;
  const typeModOut = (typeMod) ? '    '.bgRed : '    '.bgGreen;
  out += `${nameOut}${sep}${modifiedOut}${sep}${spiritModOut}${sep}${statModOut}${sep}${typeModOut}${newLine}`;
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