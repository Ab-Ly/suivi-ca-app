
const counts = {
    "200": "1",
    "0.5": "3", // User types 3
    "cents": "0.34"
};

let total = 0;

Object.entries(counts).forEach(([value, count]) => {
    console.log(`Processing ${value}: count=${count}`);
    if (value === 'cents') {
        const val = parseFloat(count) || 0;
        console.log(`  -> Cents: ${val}`);
        total += val;
    } else {
        const numCount = Number(count) || 0;
        const numValue = Number(value);
        const sub = numCount * numValue;
        console.log(`  -> Standard: ${numCount} * ${numValue} = ${sub}`);
        total += sub;
    }
});

console.log(`Total: ${total}`);
