// Extract Lucide icon nodes (from a lucide-react install) into icons.json: node icons.mjs <lucide esm icons dir> <out.json> names...
import fs from 'fs';
const [,, dir, out, ...names] = process.argv;
const res = {};
for (const n of names) {
  const src = fs.readFileSync(`${dir}/${n}.mjs`, 'utf8');
  const m = src.match(/const __iconNode = (\[[\s\S]*?\]);\n/);
  const node = Function(`return ${m[1]}`)();
  res[n] = node.map(([t, a]) => { const { key, ...r } = a; return [t, r]; });
}
fs.writeFileSync(out, JSON.stringify(res));
console.log(Object.keys(res).length, 'icons');
